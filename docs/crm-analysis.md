# Open-source CRM review: what to borrow for 513 Auto Clean

Reviewed September 2026, before building CRM-like features (follow-ups, review
requests, rebooking nudges, abandoned-booking recovery, lead tracking).

**Conclusion up front:** borrow four *patterns*, copy zero *code*. Licensing
makes copying legally expensive, and our scope makes it unnecessary anyway.

---

## 1. The licensing finding, which decides everything else

Almost every major open-source CRM is **AGPL-3.0**, including all the ones
worth learning from:

| Repo | Stack | License | Can we copy code into 513autoclean.com? |
|------|-------|---------|------------------------------------------|
| twentyhq/twenty | TypeScript, NestJS, React | **AGPL-3.0** (some pkgs MIT, some files commercial-only) | No |
| frappe/crm | Python, Vue | **AGPL-3.0** | No |
| espocrm/espocrm | PHP | **AGPL-3.0** | No |
| SuiteCRM/SuiteCRM | PHP | **AGPL-3.0** | No |
| monicahq/monica | PHP, Laravel | **AGPL-3.0** | No |
| frappe/erpnext | Python | GPL-3.0 | No |
| Dolibarr/dolibarr | PHP | GPL-3.0 | No |
| krayin/laravel-crm | PHP, Laravel | **MIT** | Legally yes, but wrong stack |

**Why AGPL matters here specifically.** The AGPL's network clause is triggered
by running modified code *as a hosted service*, not by distributing binaries.
513autoclean.com is exactly that. Lifting an AGPL workflow engine into our
Netlify functions would oblige us to publish the source of the site that uses
it. Self-hosting an unmodified Twenty instance for internal use is fine; pasting
its code into our commercial booking site is not.

Krayin is MIT and therefore safe to copy from, but it is Laravel and PHP, so
there is nothing to lift into a TypeScript codebase.

**Practical upshot:** read them for design, write our own. Ideas, schema shapes,
and state machines are not copyrightable in the way source text is, and our
feature surface is small enough that reimplementation is genuinely cheaper than
adapting someone else's abstraction.

---

## 2. Are any of these the right tool for this business?

No, and it is worth being blunt about why.

Every one of these is built around a **sales pipeline**: many leads, each a
potential multi-step negotiation, worked by a team, where the CRM's job is to
stop deals falling through the cracks between humans.

513 Auto Clean is a **service business with one operator**. The "deal" is the
booking, and we already model it far better than a generic CRM could, with
travel time, deposits, a refund ladder, and calendar constraints that no
off-the-shelf CRM understands. Dropping Twenty alongside it would create two
sources of truth about the same customer and give Elijah a second app to keep
updated by hand, which is precisely the manual overhead the whole project
exists to remove.

What we actually need is narrower: **remember every interaction, and act on a
schedule without being told.** That is four patterns, not a platform.

---

## 3. The four patterns worth borrowing

### 3.1 Activity timeline (highest value, cheapest to build)

Universal across Twenty, Frappe, EspoCRM, SuiteCRM, and Monica. One append-only
table recording every touch against a customer, so "what is the history with
this person" is one query rather than four places.

```ts
activities: {
  id, customerId, bookingId?,           // booking is optional: not every touch has one
  kind,        // call | sms | email | note | booking | payment | review_request | status_change
  direction,   // inbound | outbound | system
  subject, body,
  occurredAt,  // NOT createdAt: backfilled records keep their real time
  actor,       // 'system' | 'elijah' | 'customer'
  meta         // jsonb: twilio sid, stripe id, whatever the source gives us
}
```

Two details worth copying exactly:

- **`occurredAt` separate from `createdAt`.** Monica and Frappe both do this. It
  is what lets you log a phone call an hour later without it appearing out of
  order.
- **Append-only, never edited.** Corrections are new rows. The timeline doubles
  as evidence for a chargeback or an SMS complaint, and an editable timeline is
  worth nothing as evidence.

This feeds everything else: the review gate reads it, the rebooking nudge reads
it, and the admin Today screen renders it.

### 3.2 Workflow engine shape: trigger, conditions, ordered actions, logged runs

Twenty's trigger taxonomy maps almost perfectly onto what we need. Its triggers
are: record created, record updated, record created-or-updated, record deleted,
manual, schedule (cron or interval), and webhook.

Ours collapses to four:

| Trigger | Fires our automations |
|---------|----------------------|
| `record_event` | booking confirmed, job completed, booking cancelled |
| `schedule` | T-48h and T-2h reminders, seasonal rebooking sweeps |
| `manual` | "send this customer a review request now" from admin |
| `webhook` | Stripe payment succeeded or failed |

```ts
automations: {
  id, key, name, enabled,
  trigger,     // jsonb: { type, event?, cron?, offsetMinutes? }
  conditions,  // jsonb: [{ field, op, value }]  ANDed, deliberately not a DSL
  actions      // jsonb: ordered [{ type: 'sms'|'email'|'task'|'tag', templateKey, delayMinutes }]
}

automation_runs: {
  id, automationId, subjectType, subjectId,
  status,      // scheduled | running | done | failed | cancelled | skipped
  scheduledFor, startedAt, completedAt,
  idempotencyKey,   // unique: (automationId, subjectId, stepIndex)
  error, log        // jsonb
}
```

**The single most important thing to copy is that runs are rows, not
fire-and-forget calls.** Every mature CRM in this list persists them, for three
reasons that all apply to us:

1. **Idempotency.** A unique key on `(automation, subject, step)` is what stops
   a retry from texting a customer twice. This is the same discipline as the
   Stripe `webhook_events` ledger already in our schema, and it exists for the
   same reason.
2. **Cancellation.** When someone reschedules, the pending T-48h reminder for
   the old time must be cancellable. You cannot cancel a `setTimeout`.
3. **Explainability.** "Why did this customer get three texts?" is answerable.

**Deliberately not borrowing:** Twenty's serverless-function and HTTP-request
action nodes, and any general-purpose condition DSL. A flat ANDed condition list
covers every automation on our list, and a DSL is a small interpreter to write,
debug, and secure for no gain at this size.

### 3.3 Stage history rather than a single stage column

Our schema currently has `leads.stage` as one column, which loses the funnel
data we most want. Every pipeline CRM records the transitions.

```ts
lead_stage_history: { id, leadId, fromStage, toStage, at, reason }
```

This is what answers "where do people abandon the funnel", which is the number
one input for improving conversion, and it costs one small table.

### 3.4 Organizations as a separate entity, for Fleet and Dealership

Twenty and Frappe both separate person from company. We do not need this for
retail customers, but the Fleet and Dealership page is a real planned feature,
and a dealership is one account with many vehicles, many contacts, and
contract pricing.

```ts
organizations: { id, name, kind, contractRateCents, contractTermMonths, notes }
// customers.organizationId -> organizations.id, nullable
```

Adding the nullable column now is free. Retrofitting it after a year of
dealership bookings means back-filling relationships by hand.

---

## 4. What we are explicitly not borrowing

| Feature | Where it comes from | Why not |
|---------|--------------------|---------|
| Metadata-driven custom objects and fields | Twenty SDK, EspoCRM entity manager | Enormous machinery so end users can define their own schema. We have six packages and one operator. This is months of work to solve a problem we do not have. |
| Kanban pipeline board | Frappe CRM | Designed for dozens of open deals worked by a team. Elijah has a handful of jobs a day and a calendar. |
| Multi-tenancy, RBAC, SSO | Twenty EE, SuiteCRM | Single user. Our signed-cookie plus TOTP admin is the right size. |
| Quotes, contracts, invoicing modules | SuiteCRM, Dolibarr | Our booking record already is the quote and the invoice. |
| Email sync and IMAP ingestion | EspoCRM, SuiteCRM | Elijah lives in Gmail. A sync engine is a large, failure-prone subsystem for no benefit here. |
| Any of the PHP codebases | SuiteCRM, EspoCRM, Krayin, Dolibarr, Monica | Wrong language. Nothing to lift. |

---

## 5. How this lands in our existing schema

`web/lib/db/schema.ts` already has `leads`, `auditLog`, and `webhookEvents`,
which cover part of this. The additions are:

- `activities` (new, §3.1)
- `automations` + `automation_runs` (new, §3.2)
- `lead_stage_history` (new, §3.3)
- `organizations` (new) and `customers.organizationId` (new nullable column, §3.4)

`auditLog` stays separate from `activities` on purpose: audit records *admin
actions on data* for accountability, while activities record *interactions with
a customer*. Merging them produces a timeline full of noise like "price field
changed" that nobody wants to read.

The automation runner is a Netlify Scheduled Function that claims due rows,
executes their actions, and writes results back, which is the same pattern as
the hold-expiry job already planned.

---

## 6. Worth actually running, separately

Not as a dependency, but as a reference implementation to click around in:
**Twenty**, self-hosted via Docker for an afternoon. It is the closest to our
stack, and seeing its activity timeline and workflow builder in use is a faster
way to spot a missing field than reading source. Running an unmodified instance
locally carries no AGPL obligation.

---

**Sources:** [twentyhq/twenty](https://github.com/twentyhq/twenty) ·
[Twenty LICENSE](https://github.com/twentyhq/twenty/blob/main/LICENSE) ·
[Twenty workflow triggers](https://docs.twenty.com/user-guide/workflows/capabilities/workflow-triggers) ·
[frappe/crm](https://github.com/frappe/crm) ·
[SuiteCRM licensing](https://docs.suitecrm.com/admin/licensing/) ·
[monicahq/monica LICENSE](https://github.com/monicahq/monica/blob/main/LICENSE.md) ·
[open-source CRM benchmark 2026](https://marmelab.com/blog/2026/01/09/open-source-crm-benchmark-2026.html)
