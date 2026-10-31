-- Migration 0011: hotel-controlled amenity flags, Google Places metadata, and
-- first-party reviews from phone-verified, hotel-scoped website guests.
-- Back up production D1 before applying. Apply after migrations 0009 and 0010.
-- All amenities default to OFF; never assume a hotel offers a feature.
CREATE TABLE IF NOT EXISTS hotel_features (
 hotel_id TEXT NOT NULL REFERENCES hotels(id) ON DELETE CASCADE,
 feature_key TEXT NOT NULL CHECK (feature_key IN (
  'breakfast','wifi','parking','accessible_parking','pet_friendly',
  'pool','fitness_center','guest_laundry','business_center','ev_charging',
  'smoking_rooms','front_desk_24h'
 )),
 enabled INTEGER NOT NULL DEFAULT 0 CHECK(enabled IN (0,1)),
 updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 PRIMARY KEY(hotel_id,feature_key)
);
CREATE TABLE IF NOT EXISTS hotel_google_profiles (
 hotel_id TEXT PRIMARY KEY REFERENCES hotels(id) ON DELETE CASCADE,
 place_id TEXT,
 write_review_url TEXT,
 updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS hotel_guest_reviews (
 id TEXT PRIMARY KEY,
 hotel_id TEXT NOT NULL REFERENCES hotels(id) ON DELETE CASCADE,
 portal_user_id TEXT NOT NULL REFERENCES portal_guest_users(id) ON DELETE CASCADE,
 rating INTEGER NOT NULL CHECK(rating BETWEEN 1 AND 5),
 review_text TEXT NOT NULL CHECK(length(review_text) BETWEEN 10 AND 1200),
 status TEXT NOT NULL DEFAULT 'published' CHECK(status IN ('published','hidden')),
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 UNIQUE(hotel_id,portal_user_id),
 FOREIGN KEY(portal_user_id,hotel_id) REFERENCES portal_guest_users(id,hotel_id)
);
CREATE INDEX IF NOT EXISTS idx_hotel_guest_reviews_published
ON hotel_guest_reviews(hotel_id,status,created_at DESC);
