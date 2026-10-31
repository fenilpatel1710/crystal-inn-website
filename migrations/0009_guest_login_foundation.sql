-- Migration 0009: independent Crystal Inn guest login (not PMS authentication).
-- Apply AFTER 0003, 0004 and 0005. Back up D1 before executing.
-- No live Lumen guest data is written to these tables.

CREATE TABLE IF NOT EXISTS portal_guest_users (
  id TEXT PRIMARY KEY,
  hotel_id TEXT NOT NULL REFERENCES hotels(id),
  phone_e164 TEXT NOT NULL,
  phone_verified_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(hotel_id, phone_e164)
);
CREATE INDEX IF NOT EXISTS idx_portal_guest_hotel ON portal_guest_users(hotel_id);

CREATE TABLE IF NOT EXISTS portal_guest_sessions (
  token_hash TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES portal_guest_users(id) ON DELETE CASCADE,
  hotel_id TEXT NOT NULL REFERENCES hotels(id),
  expires_at INTEGER NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_portal_guest_session_user ON portal_guest_sessions(user_id, expires_at);

CREATE TABLE IF NOT EXISTS portal_guest_login_rate_limits (
  key_hash TEXT PRIMARY KEY,
  window_start INTEGER NOT NULL,
  attempt_count INTEGER NOT NULL
);

-- Reserved for independently verified guest ownership, not auto-matched by phone.
CREATE TABLE IF NOT EXISTS portal_guest_lumen_links (
  id TEXT PRIMARY KEY,
  portal_user_id TEXT NOT NULL REFERENCES portal_guest_users(id) ON DELETE CASCADE,
  hotel_id TEXT NOT NULL REFERENCES hotels(id),
  lumen_guest_id TEXT NOT NULL,
  lumen_guest_code TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','verified','revoked')),
  verification_method TEXT,
  verified_at TEXT,
  verified_by TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  revoked_at TEXT,
  UNIQUE(portal_user_id,hotel_id,lumen_guest_id)
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_portal_verified_link
  ON portal_guest_lumen_links(hotel_id, lumen_guest_id)
  WHERE status='verified';
