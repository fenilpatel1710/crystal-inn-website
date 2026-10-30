-- MULTI-PROPERTY FOUNDATION / DO NOT RUN UNTIL REVIEWED
-- Additive: existing Northwest 290 tables and data remain unchanged.
-- D1 is the website's platform database; Lumen PMS data remains in each
-- property's independently hosted PMS database. No PMS credentials in D1.
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS hotels (
 id TEXT PRIMARY KEY,
 slug TEXT NOT NULL UNIQUE,
 display_name TEXT NOT NULL,
 city TEXT NOT NULL,
 region TEXT NOT NULL,
 timezone TEXT NOT NULL DEFAULT 'America/Chicago',
 public_phone TEXT,
 address_text TEXT,
 description TEXT NOT NULL DEFAULT '',
 hero_image_url TEXT,
 public_email TEXT,
 rewards_enabled INTEGER NOT NULL DEFAULT 0 CHECK(rewards_enabled IN (0,1)),
 status TEXT NOT NULL DEFAULT 'draft'
  CHECK(status IN ('draft','active','suspended')),
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS hotel_admin_users (
 id TEXT PRIMARY KEY,
 email TEXT NOT NULL UNIQUE COLLATE NOCASE,
 password_hash TEXT,
 status TEXT NOT NULL DEFAULT 'invited'
  CHECK(status IN ('invited','active','suspended')),
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS hotel_admin_memberships (
 admin_user_id TEXT NOT NULL REFERENCES hotel_admin_users(id),
 hotel_id TEXT NOT NULL REFERENCES hotels(id),
 role TEXT NOT NULL CHECK(role IN ('property_admin','property_staff')),
 PRIMARY KEY(admin_user_id,hotel_id)
);

CREATE TABLE IF NOT EXISTS platform_admin_memberships (
 admin_user_id TEXT PRIMARY KEY REFERENCES hotel_admin_users(id),
 role TEXT NOT NULL CHECK(role='platform_admin')
);

CREATE TABLE IF NOT EXISTS hotel_guest_accounts (
 id TEXT PRIMARY KEY,
 hotel_id TEXT NOT NULL REFERENCES hotels(id),
 phone_e164 TEXT NOT NULL,
 email TEXT,
 phone_verified_at TEXT,
 lumen_guest_id TEXT,
 lumen_link_verified_at TEXT,
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 UNIQUE(id,hotel_id),
 UNIQUE(hotel_id,phone_e164),
 UNIQUE(hotel_id,lumen_guest_id)
);

CREATE TABLE IF NOT EXISTS hotel_room_types (
 id TEXT PRIMARY KEY,
 hotel_id TEXT NOT NULL REFERENCES hotels(id),
 display_name TEXT NOT NULL,
 description TEXT NOT NULL DEFAULT '',
 image_url TEXT,
 lumen_room_type_id TEXT,
 is_active INTEGER NOT NULL DEFAULT 1 CHECK(is_active IN(0,1)),
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 UNIQUE(id,hotel_id),
 UNIQUE(hotel_id,display_name),
 UNIQUE(hotel_id,lumen_room_type_id)
);

CREATE TABLE IF NOT EXISTS hotel_nightly_inventory (
 hotel_id TEXT NOT NULL REFERENCES hotels(id),
 room_type_id TEXT NOT NULL,
 stay_date TEXT NOT NULL CHECK(stay_date GLOB '????-??-??'),
 allotment INTEGER NOT NULL DEFAULT 0 CHECK(allotment >= 0),
 rate_cents INTEGER CHECK(rate_cents IS NULL OR rate_cents >= 0),
 stop_sell INTEGER NOT NULL DEFAULT 0 CHECK(stop_sell IN(0,1)),
 updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 PRIMARY KEY(hotel_id,room_type_id,stay_date),
 FOREIGN KEY(room_type_id,hotel_id) REFERENCES hotel_room_types(id,hotel_id)
);

CREATE TABLE IF NOT EXISTS hotel_reservations (
 id TEXT PRIMARY KEY,
 hotel_id TEXT NOT NULL REFERENCES hotels(id),
 reference TEXT NOT NULL UNIQUE,
 guest_account_id TEXT,
 guest_name TEXT NOT NULL,
 email TEXT NOT NULL,
 phone_e164 TEXT NOT NULL,
 room_type_id TEXT,
 check_in TEXT NOT NULL,
 check_out TEXT NOT NULL,
 rooms_count INTEGER NOT NULL CHECK(rooms_count > 0),
 guests_count INTEGER NOT NULL CHECK(guests_count > 0),
 status TEXT NOT NULL DEFAULT 'request_received'
 CHECK(status IN ('request_received','pending_review','confirmed','cancel_requested','cancelled','rejected')),
 lumen_booking_id TEXT,
 lumen_sync_status TEXT NOT NULL DEFAULT 'not_started',
 total_cents INTEGER,
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 UNIQUE(id,hotel_id),
 UNIQUE(hotel_id,lumen_booking_id),
 CHECK(check_out > check_in),
 FOREIGN KEY(guest_account_id,hotel_id) REFERENCES hotel_guest_accounts(id,hotel_id),
 FOREIGN KEY(room_type_id,hotel_id) REFERENCES hotel_room_types(id,hotel_id)
);
CREATE INDEX IF NOT EXISTS ix_hotel_reservations ON hotel_reservations(hotel_id,check_in,status);

CREATE TABLE IF NOT EXISTS hotel_integration_configs (
 hotel_id TEXT PRIMARY KEY REFERENCES hotels(id),
 integration_type TEXT NOT NULL DEFAULT 'lumen',
 enabled INTEGER NOT NULL DEFAULT 0 CHECK(enabled IN(0,1)),
 config_secret_reference TEXT,
 integration_status TEXT NOT NULL DEFAULT 'not_configured',
 updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Featured placements are centrally managed, never selected by individual hotel managers.
-- Date ranges are inclusive and evaluated in the platform's Central time zone.
CREATE TABLE IF NOT EXISTS featured_hotel_placements (
 id TEXT PRIMARY KEY,
 hotel_id TEXT NOT NULL REFERENCES hotels(id),
 start_date TEXT NOT NULL,
 end_date TEXT NOT NULL,
 display_order INTEGER NOT NULL CHECK(display_order BETWEEN 1 AND 5),
 image_url TEXT,
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 CHECK(start_date <= end_date)
);
CREATE INDEX IF NOT EXISTS ix_featured_placement_date ON featured_hotel_placements(start_date,end_date,display_order);

-- A real hotel list requires approval; only the existing property is seeded.
INSERT OR IGNORE INTO hotels(id,slug,display_name,city,region,timezone,public_phone,status)
VALUES ('crystal-inn-northwest-290','northwest-290',
'Crystal Inn Northwest 290','Houston','TX','America/Chicago','713-993-6567','draft');

-- Existing original reservations stay in their legacy table. Do not copy
-- them without a reconciled migration and a complete guest-data audit.
