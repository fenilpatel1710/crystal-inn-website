-- Migration 0010: saved guest contact profile from verified-OTP reservation requests.
-- Back up D1 and apply AFTER 0009. Additive; no ID scan or Lumen guest data stored.
-- A hotel-scoped portal account is NOT proof of ownership of any historic Lumen record.

CREATE UNIQUE INDEX IF NOT EXISTS uq_portal_guest_user_hotel
ON portal_guest_users(id, hotel_id);

CREATE TABLE IF NOT EXISTS portal_guest_profiles (
  portal_user_id TEXT PRIMARY KEY REFERENCES portal_guest_users(id) ON DELETE CASCADE,
  hotel_id TEXT NOT NULL REFERENCES hotels(id),
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  email TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(portal_user_id, hotel_id) REFERENCES portal_guest_users(id,hotel_id)
);

CREATE INDEX IF NOT EXISTS idx_portal_guest_profiles_hotel
ON portal_guest_profiles(hotel_id);

-- The Northwest 290 legacy stay-request intake is kept intact.
-- Only an OTP-authenticated account with the SAME verified phone may be linked.
CREATE TABLE IF NOT EXISTS portal_guest_reservation_links (
  reservation_id TEXT PRIMARY KEY REFERENCES reservations(id) ON DELETE CASCADE,
  portal_user_id TEXT NOT NULL REFERENCES portal_guest_users(id) ON DELETE CASCADE,
  hotel_id TEXT NOT NULL REFERENCES hotels(id),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(portal_user_id, hotel_id) REFERENCES portal_guest_users(id,hotel_id)
);

CREATE INDEX IF NOT EXISTS idx_portal_guest_reservation_links_user
ON portal_guest_reservation_links(portal_user_id,hotel_id,created_at);
