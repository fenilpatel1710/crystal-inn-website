# Crystal Inn Northwest 290 — Website & Guest Portal Preview

This repository contains an early **demonstration prototype** of the Crystal Inn Northwest 290 hotel website and sample guest portal, built with Next.js and TypeScript. Real reservations, SMS OTP, PMS access, payments and review integrations **are not enabled**.

## Deploy to Vercel

1. Go to https://vercel.com/new and sign in with GitHub.
2. Import the repository `fenilpatel1710/crystal-inn-website`.
3. Use **Next.js** as the framework preset.
4. Leave the **Root Directory** as `./`, **Build Command** as `next build` (or default), and **Output Directory** unset (framework default). Do not use `out`.
5. Click **Deploy**. Once deployment succeeds, Vercel provides an HTTPS `*.vercel.app` address.
6. Under Vercel Project Settings > Domains, add a custom hotel domain when ready.

GitHub commits to the production branch `main` can automatically trigger deployments.

For production commercial hotel usage, check the appropriate Vercel subscription and usage limits. Vercel accounts and access to dashboard must be managed by the owner.

## Local development

```bash
npm install
npm run dev
```

Open http://localhost:3000.

## Demonstration limitations

- Phone sign-in **does not send SMS**. The code `123456` only unlocks a fictional preview account and is **not authentication**.
- Membership codes, points balances and example stay data are fictional.
- Booking buttons do **not** reserve rooms, update inventory or collect payment.
- Actual room descriptions and hotel photos need owner verification.
- Google reviews and PMS connections are not implemented.

Do **not** connect this demo login to real guest data. Production authentication requires server-validated OTP, securely scoped authorization and proper session controls.

## Security

Never commit real guest data, production secrets, API keys, SQL Server connection strings, payment credentials, or private certificates. Store production secrets through Vercel environment variables and an appropriately secured backend.

## Planned architecture

Custom .NET/C# PMS with SQL Server (existing) -> secure ASP.NET Core integration API -> Next.js website and guest portal on Vercel. Booking.com and Expedia synchronization will use an approved channel manager.
