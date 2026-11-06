-- Migration 0012 — property-directed stay-request notifications and PMS-authoritative name snapshots.
-- Apply to crystal-inn-reservations AFTER 0011. Back up production D1 first.
-- Do not apply more than once: the ALTER TABLE statements are deliberately one-time.

ALTER TABLE reservations ADD COLUMN sms_updates_consent INTEGER NOT NULL DEFAULT 0 CHECK(sms_updates_consent IN (0,1));
ALTER TABLE reservations ADD COLUMN guest_name_source TEXT NOT NULL DEFAULT 'guest_entered' CHECK(guest_name_source IN ('guest_entered','verified_pms'));

-- Prevent two website bookings from claiming the same confirmed Lumen booking code.
CREATE UNIQUE INDEX IF NOT EXISTS uq_legacy_confirmed_lumen_booking_code
ON reservations(lumen_booking_code)
WHERE booking_status='confirmed' AND lumen_booking_code IS NOT NULL;

CREATE TABLE IF NOT EXISTS hotel_reservation_settings (
  hotel_id TEXT PRIMARY KEY REFERENCES hotels(id) ON DELETE CASCADE,
  booking_notification_email TEXT,
  guest_email_enabled INTEGER NOT NULL DEFAULT 1 CHECK(guest_email_enabled IN (0,1)),
  guest_sms_enabled INTEGER NOT NULL DEFAULT 0 CHECK(guest_sms_enabled IN (0,1)),
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS reservation_notification_jobs (
  id TEXT PRIMARY KEY,
  reservation_id TEXT NOT NULL REFERENCES reservations(id) ON DELETE CASCADE,
  hotel_id TEXT NOT NULL REFERENCES hotels(id) ON DELETE CASCADE,
  channel TEXT NOT NULL CHECK(channel IN ('property_request_email','guest_request_email','guest_request_sms','guest_confirmed_email','guest_confirmed_sms')),
  state TEXT NOT NULL DEFAULT 'pending' CHECK(state IN ('pending','processing','accepted','failed')),
  attempts INTEGER NOT NULL DEFAULT 0 CHECK(attempts BETWEEN 0 AND 10),
  provider_id TEXT,
  error_code TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  last_attempt_at TEXT,
  accepted_at TEXT,
  UNIQUE(reservation_id,channel)
);
CREATE INDEX IF NOT EXISTS idx_reservation_notification_pending ON reservation_notification_jobs(hotel_id,state,created_at);

-- Only a future approved, tenant-scoped PMS connector may populate these
-- names, AFTER independent ownership verification and link approval.
CREATE TABLE IF NOT EXISTS portal_guest_verified_pms_names (
  portal_user_id TEXT NOT NULL,
  hotel_id TEXT NOT NULL,
  lumen_guest_id TEXT NOT NULL,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  verified_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY(portal_user_id,hotel_id),
  FOREIGN KEY(portal_user_id,hotel_id) REFERENCES portal_guest_users(id,hotel_id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_portal_verified_pms_names_hotel ON portal_guest_verified_pms_names(hotel_id,lumen_guest_id);
