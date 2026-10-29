# Crystal Inn staff dashboard — password setup (no Zero Trust required)

The admin account login email is **crystalinngessner@gmail.com**. The password is NOT in GitHub.

## 1. Create the login-attempt table in the existing D1 database
1. Cloudflare → Storage & Databases → D1 → crystal-inn-reservations → Console.
2. Execute:

```sql
CREATE TABLE IF NOT EXISTS admin_login_attempts (
  client_key TEXT PRIMARY KEY,
  window_start INTEGER NOT NULL,
  failed_attempts INTEGER NOT NULL DEFAULT 0,
  locked_until INTEGER NOT NULL DEFAULT 0
);
```

## 2. Add two encrypted Cloudflare Worker secrets

Cloudflare → Workers & Pages → crystal-inn-website → Settings → Variables and Secrets → Add.

- **ADMIN_PASSWORD**: choose your own unique, random password, **at least 16 characters**. Type the password **only into Cloudflare**, not into ChatGPT or GitHub. Use the *Secret* type, not a plain-text variable.
- **ADMIN_SESSION_SECRET**: choose a **different random string of at least 32 characters** (preferably 48+). Also choose the *Secret* type. This signs administrator login sessions; it is **not your login password**.

Save these secrets and deploy the new Worker version if requested. Never paste either secret into GitHub or a chat.

## 3. Sign in
Open https://crystalinnstay.com/admin after the latest commit is successfully deployed.
- Email: crystalinngessner@gmail.com
- Password: the value you securely entered as ADMIN_PASSWORD

Admin sessions expire in 8 hours, use Secure/HttpOnly/SameSite=Strict cookies, and authorization checks run on every data API call. Five failed attempts from one IP within 15 minutes trigger a 15-minute lockout. Do not rely on the sign-in page alone: the backend checks the signed session.

## 4. What the portal does
- View the latest 200 website reservation records. No automatic confirmations.
- Add three supported room categories and set per-date nightly USD rates, online room allotments, and stop-sell.
- Values are stored in D1 only. No Lumen sync and no live booking confirmation or public availability/rate enforcement.

## 5. Verify
Try opening https://crystalinnstay.com/api/admin/reservations in a private browser window. It should return 401 without a login cookie. After signing in to /admin, the reservations and inventory tabs should load. For a saved nightly row, check Cloudflare D1 Console with:

```sql
SELECT room_type_id, stay_date, allotment, rate_cents, stop_sell
FROM nightly_inventory ORDER BY stay_date DESC LIMIT 10;
```

If login says 'Admin password setup is incomplete', inspect the two Worker secrets and D1 login-attempt table (without revealing the secret values). No Zero Trust setup is required.

For safety, avoid reusing your Gmail password. Consider adding Cloudflare rate limiting/WAF for the login endpoint as defense in depth.
