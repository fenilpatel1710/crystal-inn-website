# Cloudflare D1 setup — Crystal Inn (dashboard only)

This setup creates the database foundation, **not live confirmed bookings**.
All hotel photos and website styling are unchanged. Lumen writes, OTP, and email changes are out of scope.

## 1. Create database
1. Open https://dash.cloudflare.com/ and choose the same account that hosts `crystal-inn-website`.
2. Navigate to **Storage & Databases → D1 SQL Database → Create database**.
3. Name: **`crystal-inn-reservations`**. Optional location: choose North America if offered.
4. Select **Create**.
5. Keep the overview screen open. Note the **Database ID** (a UUID). Do not insert a fabricated ID into the GitHub config.

## 2. Initialize schema using browser Console
1. In this new D1 database, open **Console**.
2. Open [migration SQL](../migrations/0001_reservation_foundation.sql) in GitHub and select **Raw**, then copy the SQL.
3. Paste it into D1 Console and click **Execute**. The SQL uses `CREATE TABLE IF NOT EXISTS`, but do **not** repeatedly paste partial migrations or delete tables.
4. Check the **Tables** tab for `room_types`, `nightly_inventory`, `guest_accounts`, `reservations`, `reservation_nights`, `event_outbox`, `reservation_audit_log`, `schema_meta`.
5. In Console, run `SELECT value FROM schema_meta WHERE key='schema_version';` — expected: `0001`.
6. DO NOT enter live guest details manually in the Console.

## 3. Connect D1 to your existing Worker
1. Cloudflare → **Workers & Pages → crystal-inn-website → Bindings → Add binding**.
2. Select **D1 Database**, give it variable/binding name **`DB`**, select `crystal-inn-reservations`, and save.
3. Because this site deploys through **GitHub** and OpenNext, ensure the D1 binding also appears in the **versioned wrangler.jsonc** in GitHub before relying on automatic redeployments. Wrangler deploys can reconcile bindings from the checked-in config; a dashboard-only binding may not persist. Example of **binding section** to add after getting the real Database ID:

```json
"d1_databases": [{
  "binding": "DB",
  "database_name": "crystal-inn-reservations",
  "database_id": "PASTE-YOUR-REAL-DATABASE-ID"
}]
```

Do not replace a working Wrangler config with this fragment; it must be merged into the complete file by a developer. If `wrangler.jsonc` isn't checked in yet, **do not guess configuration values**. Share the D1 overview screenshot with the assistant to complete setup safely.
4. Deploy and verify the binding appears on the live Worker.

## Tables, not bookings
- `room_types`: true room categories from Lumen/property staff, initially empty.
- `nightly_inventory`: room allotment and nightly rate by date, initially empty.
- `guest_accounts`: verified website accounts, not copies of all Lumen guest records.
- `reservations`: durable booking requests with status, price snapshot and optional Lumen mapping.
- `reservation_nights`: per-night capacity tracking (must be written transactionally).
- `event_outbox`: delivery/retry records for mandatory reservation emails and Lumen sync.
- `reservation_audit_log`: status/history changes.

**Safety:** no price, inventory, guest or bookings are inserted by this migration. Existing public `POST /api/reservations` still only emails requests when correctly configured, and is **not yet connected** to D1. Do not turn on automatic confirmations until atomic inventory checks, verified room types/rates, secure Lumen sync, and retry workflows exist.
