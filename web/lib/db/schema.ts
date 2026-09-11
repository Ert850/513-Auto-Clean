import {
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

/**
 * Schema.
 *
 * Two rules hold throughout:
 *   1. All money is INTEGER CENTS. No floats, ever.
 *   2. All times are timestamptz stored UTC, rendered America/New_York.
 *
 * The single most important thing in this file is the exclusion constraint on
 * `bookings` (see ./constraints.sql). Drizzle cannot express it, so it lives in
 * a hand-written migration. It makes double-booking impossible at the database
 * level rather than something application code has to reason about.
 */

/* ============================ customers ============================ */

export const customers = pgTable(
  "customers",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    firstName: text("first_name").notNull(),
    lastName: text("last_name"),
    email: text("email"),
    /** E.164. Phone is identity here: everyone has one, not everyone gives an email. */
    phoneE164: text("phone_e164").notNull(),
    stripeCustomerId: text("stripe_customer_id"),
    notes: text("notes"),
    lifetimeValueCents: integer("lifetime_value_cents").notNull().default(0),
  },
  (t) => ({
    phoneIdx: uniqueIndex("customers_phone_idx").on(t.phoneE164),
    stripeIdx: index("customers_stripe_idx").on(t.stripeCustomerId),
  }),
);

export const addresses = pgTable(
  "addresses",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    customerId: uuid("customer_id").references(() => customers.id),
    line1: text("line1").notNull(),
    line2: text("line2"),
    city: text("city").notNull(),
    region: text("region").notNull(),
    postalCode: text("postal_code").notNull(),
    /** Google Place ID. THE cache key for drive time. */
    placeId: text("place_id"),
    lat: text("lat"),
    lng: text("lng"),
    /** County resolved from the ZIP, for the sales tax rate. */
    taxCounty: text("tax_county"),
    /** Customer said they have nowhere suitable to park for the detail. */
    needsLocationHelp: boolean("needs_location_help").notNull().default(false),
    locationNote: text("location_note"),
  },
  (t) => ({ placeIdx: index("addresses_place_idx").on(t.placeId) }),
);

/* ====================== drive time cache ====================== */

/**
 * Traffic patterns repeat weekly, so caching on (place, weekday, hour) collapses
 * repeat quotes to near-zero API calls. This is the single thing that keeps
 * traffic-aware routing affordable.
 */
export const driveTimeCache = pgTable(
  "drive_time_cache",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    placeId: text("place_id").notNull(),
    weekday: integer("weekday").notNull(), // 0 Sun to 6 Sat
    hourBucket: integer("hour_bucket").notNull(), // 0 to 23
    outboundMinutes: integer("outbound_minutes").notNull(),
    returnMinutes: integer("return_minutes").notNull(),
    computedAt: timestamp("computed_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    key: uniqueIndex("drive_cache_key").on(t.placeId, t.weekday, t.hourBucket),
  }),
);

/** Manual override for addresses Google gets wrong: gated roads, private lanes. */
export const mileageOverrides = pgTable("mileage_overrides", {
  id: uuid("id").primaryKey().defaultRandom(),
  placeId: text("place_id").notNull().unique(),
  oneWayMinutes: integer("one_way_minutes").notNull(),
  reason: text("reason"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

/* ============================ bookings ============================ */

export const bookingStatuses = [
  "held",
  "pending_payment",
  "confirmed",
  "provisional",
  "in_progress",
  "completed",
  "cancelled_by_customer",
  "cancelled_by_owner",
  "no_show",
  "expired",
  "rescheduled",
] as const;

export const bookings = pgTable(
  "bookings",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    /** Human reference, e.g. 513-8FQK2. */
    ref: text("ref").notNull().unique(),
    customerId: uuid("customer_id").notNull().references(() => customers.id),
    addressId: uuid("address_id").notNull().references(() => addresses.id),
    status: text("status").notNull().default("held"),

    startsAt: timestamp("starts_at", { withTimezone: true }).notNull(),
    endsAt: timestamp("ends_at", { withTimezone: true }).notNull(),
    /** Customer sees a one hour arrival window, not an exact minute. */
    arrivalWindowMin: integer("arrival_window_min").notNull().default(60),
    serviceDurationMin: integer("service_duration_min").notNull(),
    /** Measured drive time each way, not a flat guess. Counts against the calendar. */
    bufferBeforeMin: integer("buffer_before_min").notNull().default(0),
    bufferAfterMin: integer("buffer_after_min").notNull().default(0),

    /**
     * FROZEN price snapshot. Never recomputed from the catalog after creation,
     * so a later price change cannot silently alter an existing booking.
     */
    serviceSubtotalCents: integer("service_subtotal_cents").notNull(),
    surchargeCents: integer("surcharge_cents").notNull().default(0),
    surchargeBp: integer("surcharge_bp").notNull().default(0),
    mileageFeeCents: integer("mileage_fee_cents").notNull().default(0),
    driveMinutesUsed: integer("drive_minutes_used"),
    taxCents: integer("tax_cents").notNull().default(0),
    taxRateBp: integer("tax_rate_bp").notNull().default(0),
    tipCents: integer("tip_cents").notNull().default(0),
    totalCents: integer("total_cents").notNull(),

    depositCents: integer("deposit_cents").notNull(),
    amountPaidCents: integer("amount_paid_cents").notNull().default(0),
    amountRefundedCents: integer("amount_refunded_cents").notNull().default(0),
    /** 'deposit' | 'full' | 'pay_after' */
    paymentMode: text("payment_mode").notNull(),
    priorityBooking: boolean("priority_booking").notNull().default(false),

    /**
     * A slot without a deposit is provisional: another customer who pays can
     * take it, right up until this passes. See lib/booking/provisional.ts.
     */
    provisionalUntil: timestamp("provisional_until", { withTimezone: true }),
    holdExpiresAt: timestamp("hold_expires_at", { withTimezone: true }),

    gcalEventId: text("gcal_event_id"),
    /** Client-generated, so a double submit returns the same booking. */
    idempotencyKey: text("idempotency_key").unique(),
    /** 'web' | 'phone' | 'admin' | 'ai_agent' */
    source: text("source").notNull().default("web"),
    rescheduledFromId: uuid("rescheduled_from_id"),
    customerNotes: text("customer_notes"),
    internalNotes: text("internal_notes"),
    /** Asked after confirmation, not during booking: water, power, parking. */
    siteDetails: jsonb("site_details"),

    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    startsIdx: index("bookings_starts_idx").on(t.startsAt),
    statusIdx: index("bookings_status_idx").on(t.status),
    customerIdx: index("bookings_customer_idx").on(t.customerId),
  }),
);

/** One row per vehicle. Price and duration stack; travel is charged once. */
export const bookingVehicles = pgTable("booking_vehicles", {
  id: uuid("id").primaryKey().defaultRandom(),
  bookingId: uuid("booking_id").notNull().references(() => bookings.id, { onDelete: "cascade" }),
  position: integer("position").notNull(),
  label: text("label"),
  /** 'interior' | 'exterior' | 'both' */
  intent: text("intent"),
  showroomHours: integer("showroom_hours"),
  subtotalCents: integer("subtotal_cents").notNull().default(0),
});

/** The receipt ledger. Every line the customer was shown, frozen. */
export const bookingItems = pgTable("booking_items", {
  id: uuid("id").primaryKey().defaultRandom(),
  bookingId: uuid("booking_id").notNull().references(() => bookings.id, { onDelete: "cascade" }),
  vehicleId: uuid("vehicle_id").references(() => bookingVehicles.id, { onDelete: "cascade" }),
  /** Mirrors LineKind in lib/pricing/quote.ts */
  kind: text("kind").notNull(),
  refId: text("ref_id"),
  label: text("label").notNull(),
  amountCents: integer("amount_cents").notNull(),
  durationMin: integer("duration_min").notNull().default(0),
  sortOrder: integer("sort_order").notNull().default(0),
});

/* ============================= money ============================= */

export const payments = pgTable(
  "payments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    bookingId: uuid("booking_id").references(() => bookings.id),
    provider: text("provider").notNull().default("stripe"),
    /** 'deposit' | 'balance' | 'full' | 'setup' | 'cancellation_fee' | 'reschedule_fee' */
    kind: text("kind").notNull(),
    providerObjectId: text("provider_object_id").notNull(),
    providerCustomerId: text("provider_customer_id"),
    providerPaymentMethodId: text("provider_payment_method_id"),
    amountCents: integer("amount_cents").notNull().default(0),
    currency: text("currency").notNull().default("usd"),
    status: text("status").notNull(),
    capturedAt: timestamp("captured_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    raw: jsonb("raw"),
  },
  (t) => ({
    providerIdx: uniqueIndex("payments_provider_object_idx").on(t.provider, t.providerObjectId),
    bookingIdx: index("payments_booking_idx").on(t.bookingId),
  }),
);

export const refunds = pgTable("refunds", {
  id: uuid("id").primaryKey().defaultRandom(),
  paymentId: uuid("payment_id").references(() => payments.id),
  bookingId: uuid("booking_id").references(() => bookings.id),
  amountCents: integer("amount_cents").notNull(),
  /** 'owner_cancelled' | 'gt72h' | '24h_to_72h' | 'lt24h' | 'goodwill' */
  policyBucket: text("policy_bucket").notNull(),
  reason: text("reason"),
  providerRefundId: text("provider_refund_id"),
  status: text("status").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  createdBy: text("created_by"),
});

/**
 * Idempotency ledger. Stripe retries hard, so the FIRST statement of the
 * webhook handler inserts here with onConflictDoNothing and bails if the row
 * already existed. This is what stops two calendar events for one payment.
 */
export const webhookEvents = pgTable("webhook_events", {
  id: text("id").primaryKey(), // provider event id, e.g. evt_...
  provider: text("provider").notNull(),
  type: text("type").notNull(),
  receivedAt: timestamp("received_at", { withTimezone: true }).notNull().defaultNow(),
  processedAt: timestamp("processed_at", { withTimezone: true }),
  error: text("error"),
  payload: jsonb("payload"),
});

/* ============================= legal ============================= */

/**
 * Consent is stored with the EXACT sentence shown, not just a boolean. If a
 * customer ever disputes a charge or an opt-in, "they ticked a box" is weak;
 * "here is the wording they accepted, at this timestamp, from this IP" is not.
 */
export const consents = pgTable("consents", {
  id: uuid("id").primaryKey().defaultRandom(),
  customerId: uuid("customer_id").references(() => customers.id),
  bookingId: uuid("booking_id").references(() => bookings.id),
  /** 'terms' | 'cancellation_policy' | 'sms_transactional' | 'media_release' | 'cookies_analytics' */
  kind: text("kind").notNull(),
  granted: boolean("granted").notNull(),
  policyVersion: text("policy_version"),
  textShown: text("text_shown").notNull(),
  ip: text("ip"),
  userAgent: text("user_agent"),
  grantedAt: timestamp("granted_at", { withTimezone: true }).notNull().defaultNow(),
  revokedAt: timestamp("revoked_at", { withTimezone: true }),
  source: text("source").notNull().default("web"),
});

/* ======================== catalog and config ======================== */

export const pricingRules = pgTable("pricing_rules", {
  key: text("key").primaryKey(),
  valueInt: integer("value_int"),
  valueJson: jsonb("value_json"),
  label: text("label").notNull(),
  helpText: text("help_text"),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  updatedBy: text("updated_by"),
});

export const countyTaxRates = pgTable(
  "county_tax_rates",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    county: text("county").notNull(),
    state: text("state").notNull(),
    rateBp: integer("rate_bp").notNull(),
    /** Rates change. A stale year triggers an admin warning rather than a silent wrong charge. */
    verifiedYear: integer("verified_year").notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({ key: uniqueIndex("county_tax_key").on(t.county, t.state) }),
);

/** Every admin write, so a wrong price at 11pm is traceable. */
export const auditLog = pgTable("audit_log", {
  id: uuid("id").primaryKey().defaultRandom(),
  actor: text("actor").notNull(),
  entity: text("entity").notNull(),
  entityId: text("entity_id"),
  action: text("action").notNull(),
  before: jsonb("before"),
  after: jsonb("after"),
  at: timestamp("at", { withTimezone: true }).notNull().defaultNow(),
});

/** Abandoned funnel sessions, for recovery follow-ups. */
export const leads = pgTable("leads", {
  id: uuid("id").primaryKey().defaultRandom(),
  customerId: uuid("customer_id").references(() => customers.id),
  phone: text("phone"),
  email: text("email"),
  name: text("name"),
  stage: text("stage").notNull().default("new"),
  abandonedStep: text("abandoned_step"),
  cartSnapshot: jsonb("cart_snapshot"),
  utm: jsonb("utm"),
  lastContactedAt: timestamp("last_contacted_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

/** Live review count and rating, so JSON-LD never publishes a stale number. */
export const businessStats = pgTable("business_stats", {
  key: text("key").primaryKey(),
  valueJson: jsonb("value_json"),
  refreshedAt: timestamp("refreshed_at", { withTimezone: true }).notNull().defaultNow(),
});
