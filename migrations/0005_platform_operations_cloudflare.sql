ALTER TABLE hotels ADD COLUMN lumen_hotel_id INTEGER;
ALTER TABLE hotels ADD COLUMN subscription_status TEXT NOT NULL DEFAULT 'not_configured';
ALTER TABLE hotels ADD COLUMN subscription_amount_cents INTEGER NOT NULL DEFAULT 0;
ALTER TABLE hotels ADD COLUMN subscription_renewal_date TEXT;
UPDATE hotels SET lumen_hotel_id=4 WHERE id='crystal-inn-northwest-290' AND lumen_hotel_id IS NULL;
CREATE TABLE IF NOT EXISTS platform_settings (
 setting_key TEXT PRIMARY KEY,
 setting_value TEXT NOT NULL,
 updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
INSERT OR IGNORE INTO platform_settings(setting_key,setting_value) VALUES ('contact_email','frontdesk@crystalinnstay.com');
INSERT OR IGNORE INTO platform_settings(setting_key,setting_value) VALUES ('rewards_points_per_dollar','3');
INSERT OR IGNORE INTO platform_settings(setting_key,setting_value) VALUES ('rewards_minimum_redemption','1000');
CREATE TABLE IF NOT EXISTS guest_inquiries (
 id TEXT PRIMARY KEY,
 hotel_id TEXT REFERENCES hotels(id),
 guest_name TEXT NOT NULL,
 email TEXT NOT NULL,
 phone TEXT,
 subject TEXT NOT NULL,
 message TEXT NOT NULL,
 status TEXT NOT NULL DEFAULT 'new' CHECK(status IN ('new','in_progress','resolved')),
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_guest_inquiries_status ON guest_inquiries(status,created_at);
