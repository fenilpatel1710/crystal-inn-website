-- Apply once after a verified D1 backup. Additive only.
ALTER TABLE hotels ADD COLUMN archived_at TEXT;
ALTER TABLE hotel_admin_users ADD COLUMN credentials_changed_at TEXT;
CREATE TABLE IF NOT EXISTS manager_password_reset_tokens (
 token_hash TEXT PRIMARY KEY,
 manager_id TEXT NOT NULL REFERENCES hotel_admin_users(id),
 expires_at INTEGER NOT NULL,
 used_at INTEGER,
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS ix_manager_password_reset_manager ON manager_password_reset_tokens(manager_id,expires_at);
CREATE TABLE IF NOT EXISTS platform_admin_audit (
 id TEXT PRIMARY KEY,
 actor_email TEXT NOT NULL,
 action TEXT NOT NULL,
 hotel_id TEXT,
 manager_id TEXT,
 details TEXT,
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS ix_platform_audit_recent ON platform_admin_audit(created_at);
