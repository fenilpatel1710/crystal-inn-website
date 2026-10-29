-- Crystal Inn Northwest 290 — D1 schema v0001
-- Apply to a dedicated Cloudflare D1 database named crystal-inn-reservations.
-- This migration creates tables only. It does not activate live bookings.
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS schema_meta (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS room_types (
  id TEXT PRIMARY KEY,
  display_name TEXT NOT NULL,
  description TEXT,
  lumen_room_type_id INTEGER,
  is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0,1)),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_room_types_lumen ON room_types(lumen_room_type_id)
  WHERE lumen_room_type_id IS NOT NULL;

-- An allotment is the number of rooms deliberately offered online per local
-- hotel calendar date, independent of transient hourly/walk-in room activity.
-- No default room quantities or rates are invented.
CREATE TABLE IF NOT EXISTS nightly_inventory (
  room_type_id TEXT NOT NULL REFERENCES room_types(id),
  stay_date TEXT NOT NULL CHECK (stay_date GLOB '????-??-??'),
  allotment INTEGER NOT NULL DEFAULT 0 CHECK (allotment BETWEEN 0 AND 1000),
  stop_sell INTEGER NOT NULL DEFAULT 0 CHECK (stop_sell IN (0,1)),
  rate_cents INTEGER CHECK (rate_cents IS NULL OR rate_cents BETWEEN 0 AND 100000000),
  currency TEXT NOT NULL DEFAULT 'USD' CHECK (currency='USD'),
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (room_type_id, stay_date)
);
CREATE INDEX IF NOT EXISTS ix_inventory_stay_date ON nightly_inventory(stay_date);

-- Website user identity is distinct from a Lumen guest record. No direct
-- Lumen guest lookups are available to public visitors.
CREATE TABLE IF NOT EXISTS guest_accounts (
  id TEXT PRIMARY KEY,
  phone_e164 TEXT NOT NULL UNIQUE,
  email TEXT,
  phone_verified_at TEXT,
  lumen_guest_id TEXT UNIQUE,
  lumen_guest_code TEXT,
  lumen_link_verified_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS ix_guest_lumen_code ON guest_accounts(lumen_guest_code);

-- Request and booking records are durable even if Lumen or email fails.
-- Status 'request_received' does NOT mean a confirmed hotel reservation.
CREATE TABLE IF NOT EXISTS reservations (
  id TEXT PRIMARY KEY,
  public_reference TEXT NOT NULL UNIQUE,
  idempotency_key TEXT UNIQUE,
  guest_account_id TEXT REFERENCES guest_accounts(id),
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  phone_e164 TEXT NOT NULL,
  email TEXT NOT NULL,
  room_type_id TEXT REFERENCES room_types(id),
  room_type_label TEXT NOT NULL,
  check_in TEXT NOT NULL CHECK (check_in GLOB '????-??-??'),
  check_out TEXT NOT NULL CHECK (check_out GLOB '????-??-??'),
  rooms_count INTEGER NOT NULL CHECK (rooms_count BETWEEN 1 AND 4),
  guests_count INTEGER NOT NULL CHECK (guests_count BETWEEN 1 AND 8),
  currency TEXT NOT NULL DEFAULT 'USD' CHECK (currency='USD'),
  subtotal_cents INTEGER CHECK (subtotal_cents IS NULL OR subtotal_cents >= 0),
  tax_cents INTEGER CHECK (tax_cents IS NULL OR tax_cents >= 0),
  total_cents INTEGER CHECK (total_cents IS NULL OR total_cents >= 0),
  rate_snapshot_json TEXT,
  special_requests TEXT,
  booking_status TEXT NOT NULL DEFAULT 'request_received'
    CHECK (booking_status IN ('request_received','pending_review','confirmed','cancel_requested','cancelled','rejected')),
  lumen_sync_status TEXT NOT NULL DEFAULT 'not_started'
    CHECK (lumen_sync_status IN ('not_started','pending','synced','failed','unknown','manual_review')),
  lumen_booking_id TEXT UNIQUE,
  lumen_booking_code TEXT,
  lumen_last_sync_at TEXT,
  lumen_last_error_code TEXT,
  confirmed_at TEXT,
  cancelled_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CHECK (check_out > check_in)
);
CREATE INDEX IF NOT EXISTS ix_reservations_arrival ON reservations(check_in,booking_status);
CREATE INDEX IF NOT EXISTS ix_reservations_created ON reservations(created_at);
CREATE INDEX IF NOT EXISTS ix_reservations_sync ON reservations(lumen_sync_status,created_at);

-- One record per reservation/night allows safe capacity accounting. The
-- eventual reservation handler must create/claim these within a transaction
-- with an availability recheck; this migration alone does not prevent oversell.
CREATE TABLE IF NOT EXISTS reservation_nights (
  reservation_id TEXT NOT NULL REFERENCES reservations(id) ON DELETE CASCADE,
  room_type_id TEXT NOT NULL REFERENCES room_types(id),
  stay_date TEXT NOT NULL CHECK (stay_date GLOB '????-??-??'),
  rooms_count INTEGER NOT NULL CHECK (rooms_count BETWEEN 1 AND 4),
  PRIMARY KEY (reservation_id,stay_date)
);
CREATE INDEX IF NOT EXISTS ix_reserved_nights ON reservation_nights(room_type_id,stay_date);

-- Durable delivery/retry records for front-desk emails and future Lumen sync.
-- Sensitive data stays in reservations; payload_json should contain only
-- the minimum necessary information.
CREATE TABLE IF NOT EXISTS event_outbox (
  id TEXT PRIMARY KEY,
  reservation_id TEXT NOT NULL REFERENCES reservations(id),
  event_type TEXT NOT NULL CHECK (event_type IN
    ('reservation_email','lumen_create','lumen_cancel','sync_failure_alert','cancellation_email')),
  delivery_status TEXT NOT NULL DEFAULT 'pending'
    CHECK (delivery_status IN ('pending','processing','delivered','failed','dead_letter')),
  dedupe_key TEXT NOT NULL UNIQUE,
  payload_json TEXT,
  attempts INTEGER NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  next_attempt_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  last_attempt_at TEXT,
  delivered_at TEXT,
  error_code TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS ix_outbox_ready
 ON event_outbox(delivery_status,next_attempt_at);

CREATE TABLE IF NOT EXISTS reservation_audit_log (
  id TEXT PRIMARY KEY,
  reservation_id TEXT NOT NULL REFERENCES reservations(id),
  action TEXT NOT NULL,
  actor_type TEXT NOT NULL CHECK (actor_type IN ('guest','staff','system')),
  actor_id TEXT,
  details_json TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS ix_audit_reservation ON reservation_audit_log(reservation_id,created_at);

INSERT OR IGNORE INTO schema_meta(key,value) VALUES ('schema_version','0001');
