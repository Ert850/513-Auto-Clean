import Stripe from "stripe";

/**
 * Stripe.
 *
 * Payment mode maps to intent type:
 *
 *   deposit    PaymentIntent for the deposit, setup_future_usage off_session
 *   full       PaymentIntent for the total,   setup_future_usage off_session
 *   pay_after  SetupIntent, amount 0
 *
 * `setup_future_usage` on the deposit is the whole mechanism behind charging a
 * balance later without re-prompting the customer. One parameter, and the
 * difference between a smooth finish and chasing someone in a driveway.
 */

let cached: Stripe | null = null;

export function isConfigured(env: NodeJS.ProcessEnv = process.env): boolean {
  return Boolean(env.STRIPE_SECRET_KEY);
}

export function stripe(env: NodeJS.ProcessEnv = process.env): Stripe {
  if (cached) return cached;
  const key = env.STRIPE_SECRET_KEY;
  if (!key) throw new Error("STRIPE_SECRET_KEY is not set");
  // Pinned to the version this SDK ships with, so a Stripe-side API
  // change can never alter behaviour without a deliberate upgrade here.
  cached = new Stripe(key, { apiVersion: "2026-08-26.dahlia" });
  return cached;
}

export type PaymentMode = "deposit" | "full" | "pay_after";

export interface IntentInput {
  bookingId: string;
  ref: string;
  mode: PaymentMode;
  /** Charged now. Zero for pay_after. */
  amountCents: number;
  customerEmail?: string | null;
  customerName: string;
  customerPhone: string;
  stripeCustomerId?: string | null;
}

export interface IntentResult {
  clientSecret: string;
  intentId: string;
  stripeCustomerId: string;
  kind: "payment_intent" | "setup_intent";
}

export async function findOrCreateCustomer(
  input: IntentInput,
  env: NodeJS.ProcessEnv = process.env,
): Promise<string> {
  const s = stripe(env);
  if (input.stripeCustomerId) return input.stripeCustomerId;

  // Phone is our identity key, so reuse an existing customer where we can.
  const existing = await s.customers.search({
    query: `phone:'${input.customerPhone}'`,
    limit: 1,
  });
  if (existing.data[0]) return existing.data[0].id;

  const created = await s.customers.create({
    name: input.customerName,
    phone: input.customerPhone,
    ...(input.customerEmail ? { email: input.customerEmail } : {}),
  });
  return created.id;
}

export async function createIntent(
  input: IntentInput,
  env: NodeJS.ProcessEnv = process.env,
): Promise<IntentResult> {
  const s = stripe(env);
  const customerId = await findOrCreateCustomer(input, env);

  const metadata = {
    booking_id: input.bookingId,
    ref: input.ref,
    mode: input.mode,
  };

  // Idempotency keyed on the booking and what we are doing to it, so a retried
  // request can never create a second charge.
  const idempotencyKey = `${input.bookingId}:${input.mode}`;

  if (input.mode === "pay_after") {
    const si = await s.setupIntents.create(
      {
        customer: customerId,
        usage: "off_session",
        automatic_payment_methods: { enabled: true },
        metadata,
      },
      { idempotencyKey },
    );
    return {
      clientSecret: si.client_secret as string,
      intentId: si.id,
      stripeCustomerId: customerId,
      kind: "setup_intent",
    };
  }

  const pi = await s.paymentIntents.create(
    {
      amount: input.amountCents,
      currency: "usd",
      customer: customerId,
      setup_future_usage: "off_session",
      automatic_payment_methods: { enabled: true },
      statement_descriptor_suffix: "513AUTOCLEAN",
      description: `513 Auto Clean ${input.ref} (${input.mode})`,
      metadata,
    },
    { idempotencyKey },
  );

  return {
    clientSecret: pi.client_secret as string,
    intentId: pi.id,
    stripeCustomerId: customerId,
    kind: "payment_intent",
  };
}

/**
 * Charge a saved card off-session, for the balance after service or a
 * cancellation fee.
 *
 * `authentication_required` WILL happen on some cards. Handle it by texting the
 * customer a payment link rather than treating it as a failure; discovering
 * this for the first time in someone's driveway is miserable.
 */
export async function chargeSavedCard(
  args: {
    bookingId: string;
    ref: string;
    customerId: string;
    amountCents: number;
    kind: "balance" | "cancellation_fee" | "reschedule_fee";
  },
  env: NodeJS.ProcessEnv = process.env,
): Promise<{ ok: true; intentId: string } | { ok: false; needsAuth: boolean; message: string }> {
  const s = stripe(env);
  const methods = await s.paymentMethods.list({ customer: args.customerId, type: "card", limit: 1 });
  const pm = methods.data[0];
  if (!pm) return { ok: false, needsAuth: false, message: "No card on file for this customer." };

  try {
    const pi = await s.paymentIntents.create(
      {
        amount: args.amountCents,
        currency: "usd",
        customer: args.customerId,
        payment_method: pm.id,
        off_session: true,
        confirm: true,
        statement_descriptor_suffix: "513AUTOCLEAN",
        description: `513 Auto Clean ${args.ref} (${args.kind})`,
        metadata: { booking_id: args.bookingId, ref: args.ref, kind: args.kind },
      },
      { idempotencyKey: `${args.bookingId}:${args.kind}` },
    );
    return { ok: true, intentId: pi.id };
  } catch (err) {
    const e = err as Stripe.errors.StripeError;
    const needsAuth = e.code === "authentication_required";
    return {
      ok: false,
      needsAuth,
      message: needsAuth
        ? "The bank wants the customer to confirm. Send them a payment link."
        : (e.message ?? "Charge failed."),
    };
  }
}

export async function refund(
  args: { paymentIntentId: string; amountCents: number; reason?: string },
  env: NodeJS.ProcessEnv = process.env,
): Promise<string> {
  const s = stripe(env);
  const r = await s.refunds.create({
    payment_intent: args.paymentIntentId,
    amount: args.amountCents,
    ...(args.reason ? { metadata: { reason: args.reason } } : {}),
  });
  return r.id;
}

/**
 * Verify a webhook signature.
 *
 * MUST be given the RAW body string. Parsing it as JSON first breaks the
 * signature check, and this is the single most common Stripe integration bug.
 */
export function verifyWebhook(
  rawBody: string,
  signature: string,
  env: NodeJS.ProcessEnv = process.env,
): Stripe.Event {
  const secret = env.STRIPE_WEBHOOK_SECRET;
  if (!secret) throw new Error("STRIPE_WEBHOOK_SECRET is not set");
  return stripe(env).webhooks.constructEvent(rawBody, signature, secret);
}
