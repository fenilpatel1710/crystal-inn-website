-- Room-gallery images stay in the existing private HOTEL_MEDIA R2 bucket.
-- One room can occupy only slots 1, 2 and 3. Unique slot constraints enforce the limit.
CREATE TABLE IF NOT EXISTS hotel_room_photos (
  id TEXT PRIMARY KEY,
  hotel_id TEXT NOT NULL REFERENCES hotels(id) ON DELETE CASCADE,
  room_id TEXT NOT NULL REFERENCES hotel_room_types(id) ON DELETE CASCADE,
  object_key TEXT NOT NULL UNIQUE,
  slot INTEGER NOT NULL CHECK (slot IN (1, 2, 3)),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (room_id, slot)
);
CREATE INDEX IF NOT EXISTS idx_hotel_room_photos_hotel_room
  ON hotel_room_photos(hotel_id, room_id, slot);
