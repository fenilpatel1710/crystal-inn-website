ALTER TABLE hotel_room_types ADD COLUMN starting_rate_cents INTEGER CHECK (starting_rate_cents IS NULL OR (starting_rate_cents >= 0 AND starting_rate_cents <= 100000000));
