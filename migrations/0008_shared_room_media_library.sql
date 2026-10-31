-- Migration 0008: one private R2 image can be used by multiple room types
-- within the SAME hotel. Requires migration 0007 first.
-- Additive: legacy hotel_room_photos rows are NOT removed.
-- Take a verified D1 backup before applying. Run only once per environment.

CREATE TABLE IF NOT EXISTS hotel_media_assets (
  id TEXT PRIMARY KEY,
  hotel_id TEXT NOT NULL REFERENCES hotels(id) ON DELETE CASCADE,
  object_key TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active', 'deleting')),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(id, hotel_id)
);

CREATE TABLE IF NOT EXISTS hotel_room_gallery (
  id TEXT PRIMARY KEY,
  hotel_id TEXT NOT NULL REFERENCES hotels(id) ON DELETE CASCADE,
  room_id TEXT NOT NULL,
  asset_id TEXT NOT NULL,
  slot INTEGER NOT NULL CHECK (slot IN (1, 2, 3)),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (room_id, hotel_id) REFERENCES hotel_room_types(id, hotel_id) ON DELETE CASCADE,
  FOREIGN KEY (asset_id, hotel_id) REFERENCES hotel_media_assets(id, hotel_id),
  UNIQUE(room_id, slot),
  UNIQUE(room_id, asset_id)
);

CREATE INDEX IF NOT EXISTS idx_room_gallery_hotel_room
  ON hotel_room_gallery(hotel_id, room_id, slot);
CREATE INDEX IF NOT EXISTS idx_room_gallery_asset
  ON hotel_room_gallery(asset_id);

-- Preserve existing images and their room-specific slot and photo IDs.
INSERT OR IGNORE INTO hotel_media_assets(id, hotel_id, object_key, created_at)
  SELECT id, hotel_id, object_key, created_at FROM hotel_room_photos;

INSERT OR IGNORE INTO hotel_room_gallery(id, hotel_id, room_id, asset_id, slot, created_at)
  SELECT p.id, p.hotel_id, p.room_id, a.id, p.slot, p.created_at
  FROM hotel_room_photos p
  JOIN hotel_media_assets a ON a.object_key=p.object_key AND a.hotel_id=p.hotel_id;
