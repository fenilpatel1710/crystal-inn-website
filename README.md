# Crystal Inn Northwest 290 — Website & Guest Portal Preview

This repository contains a **prototype** of the Crystal Inn Northwest 290 hotel website and sample guest portal. It uses Next.js and TypeScript. Real reservations, text-message OTP, PMS access, payment processing, and reviews **are not enabled**.

## Cloudflare Pages deployment (static prototype)

1. Log into the [Cloudflare Dashboard](https://dash.cloudflare.com).
2. Go to **Workers & Pages** and create a **Pages** project that connects to GitHub.
3. Select `fenilpatel1710/crystal-inn-website` and its `main` branch.
4. Use these build settings:
   - Framework preset: **Next.js (Static HTML Export)** if available (otherwise select None)
   - Build command: `npm run build`
   - Build output directory: `out`
   - Root directory: repository root
5. Deploy. Cloudflare will provide a `*.pages.dev` HTTPS preview URL.
6. Later, attach a custom domain in the Pages dashboard.

This prototype uses `output: 'export'` and is a fully static preview. **Before enabling secure, server-rendered guest accounts, payments or PMS reservations, plan a separate authenticated ASP.NET Core backend or move the Next.js application to a supported full-stack Workers configuration.** Do not implement sensitive guest authentication solely in this static frontend.

## Run locally

```bash
npm install
npm run dev
```

Open http://localhost:3000.

## What is demonstrational?

- The phone-login screen **does not send a text message**. Enter code `123456` for sample UI only.
- Member identifiers, rewards totals and stays shown in the preview are fictional.
- Online booking buttons do not create reservations, hold inventory or collect payments.
- Room rates, room type details, and Google reviews must be verified and integrated before commercial use.

## Security

Never commit SQL Server connection strings, real guest records, provider API keys, payment secrets, private certificates or production `.env` files to GitHub. Only publish anonymized demo data.

## Planned live architecture

Existing .NET/C# PMS (SQL Server) -> secure ASP.NET Core integration API -> public website, guest portal and future mobile apps. A supported channel manager will handle Booking.com and Expedia integration.
