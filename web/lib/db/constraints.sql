-- Run once after the first drizzle-kit push.
--
-- This file exists because Drizzle cannot express a GiST exclusion constraint,
-- and this constraint is the most important statement in the whole schema.

CREATE EXTENSION IF NOT EXISTS btree_gist;

-- ---------------------------------------------------------------------------
-- Double-booking becomes structurally impossible.
--
-- Without this, preventing two people paying for the same slot means holding a
-- lock across a Stripe round trip, or accepting a race you can only detect
-- afterwards. With it, two concurrent inserts for overlapping windows resolve
-- in the database: one commits, the other raises 23P01 exclusion_violation,
-- which the API catches and returns as a 409 with nearby times.
--
-- The range includes the measured travel buffers, so a job 50 minutes away
-- blocks the drive as well as the work. That is the outline's rule that a
-- 4 hour detail plus an hour of travel needs a 5 hour window.
--
-- Statuses that do NOT occupy time are deliberately excluded: expired holds,
-- cancellations, no-shows, and rescheduled originals all free their slot.
-- 'provisional' DOES occupy it, because an undeposited booking still holds the
-- time until someone with a deposit takes it.
-- ---------------------------------------------------------------------------
ALTER TABLE bookings
  ADD CONSTRAINT bookings_no_overlap
  EXCLUDE USING gist (
    tstzrange(
      starts_at - (buffer_before_min * interval '1 minute'),
      ends_at   + (buffer_after_min  * interval '1 minute'),
      '[)'
    ) WITH &&
  )
  WHERE (status IN ('held', 'pending_payment', 'confirmed', 'provisional', 'in_progress', 'completed'));

-- A booking must not end before it starts.
ALTER TABLE bookings
  ADD CONSTRAINT bookings_sane_window CHECK (ends_at > starts_at);

-- Money never goes negative through a bug.
ALTER TABLE bookings
  ADD CONSTRAINT bookings_nonneg CHECK (
    total_cents >= 0 AND deposit_cents >= 0 AND amount_paid_cents >= 0
    AND amount_refunded_cents >= 0 AND amount_refunded_cents <= amount_paid_cents
  );

-- Seed the county tax table from the verified 2026 rates.
INSERT INTO county_tax_rates (county, state, rate_bp, verified_year) VALUES
  ('hamilton',   'OH', 780, 2026),
  ('butler',     'OH', 650, 2026),
  ('warren',     'OH', 675, 2026),
  ('clermont',   'OH', 675, 2026),
  ('montgomery', 'OH', 750, 2026),
  ('kenton',     'KY', 600, 2026),
  ('campbell',   'KY', 600, 2026),
  ('boone',      'KY', 600, 2026),
  ('dearborn',   'IN', 700, 2026),
  ('franklin',   'IN', 700, 2026),
  ('ripley',     'IN', 700, 2026)
ON CONFLICT (county, state) DO NOTHING;
