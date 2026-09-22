# Hosting on Hostinger (Cloud / VPS with Node.js)

This app no longer depends on Vercel. The frontend (Vite/React) and the
backend (five small endpoints that used to be Vercel serverless functions)
now run together as **one Express server** — a single Node.js process, which
is exactly what Hostinger's Node.js hosting expects.

What changed from the Vercel setup:

| Before (Vercel) | Now (Hostinger) |
| --- | --- |
| `api/*.ts` — separate serverless functions | `server/` — one Express app (`server/index.ts`) |
| Vercel Blob (`@vercel/blob`) for admin config + uploads | Local disk, under `DATA_DIR` (default `./data`) |
| `vercel --prod` | `npm run build` then `npm start` (or Hostinger's Node.js app panel) |

No database is needed here either — same as before. Config (admin-edited
pricing + welcome-email settings) and uploaded plans/photos are just files on
disk now instead of blobs in Vercel's storage.

---

## 1. One-time repo changes already done for you

- `npm run build` now builds **both** the frontend (`dist/`) and the server
  (`dist-server/`).
- `npm start` runs `node dist-server/index.js` — this is the **application
  startup file** Hostinger needs.
- The server reads `PORT` from the environment (falls back to 3000) — Hostinger
  sets this for you, no action needed.

## 2. Persistent data directory — the one thing to get right

Hostinger's Node.js app deployment redeploys from your Git repo on each push,
which typically **wipes anything inside the app folder that isn't tracked in
git** (including a `./data` folder created at runtime). Since uploaded photos,
plans, and the admin-saved pricing/welcome config all live under `DATA_DIR`,
you must point it **outside** the app's deployment folder so it survives
redeploys.

In hPanel, once the Node.js app is created, it gives you an application root
(e.g. `/home/u123456789/domains/yourdomain.com/public_html` or similar). Set:

```
DATA_DIR=/home/u123456789/smoothconcrete-data
```

(replace with your actual home path — hPanel's file manager or SSH shows it;
pick any folder name outside the app root). The server creates
`config/` and `uploads/` under it automatically on first write.

## 3. Deploy via hPanel

1. **hPanel → Websites → Add Website → Node.js web app.**
2. Choose **Import Git repository**, connect GitHub, and pick
   `Sujee93/concretecalculator` (branch: whichever you deploy from, e.g. `main`).
3. Hostinger auto-detects Node — confirm/set:
   - **Node version**: 20.x or later (project targets ES2022/Node 22 features; 20 LTS is the safe minimum)
   - **Build command**: `npm run build`
   - **Application startup file**: `dist-server/index.js`
4. Set environment variables (hPanel's Node.js app screen has an
   **Environment variables** section) — same list as before, minus the two
   Vercel-only ones:

   | Variable | Value |
   | --- | --- |
   | `RESEND_API_KEY` | From resend.com/api-keys |
   | `INQUIRY_RECIPIENT_EMAIL` | Who receives inquiry emails |
   | `INQUIRY_CC_EMAILS` | Comma-separated CC list (optional) |
   | `SENDER_EMAIL` | `onboarding@resend.dev` for now |
   | `SMOOTH_CONCRETE_PHONE` | Shown in the welcome-pack email sign-off (optional) |
   | `ADMIN_PASSWORD` | Password for the `/admin` pricing/welcome editor |
   | `DATA_DIR` | Absolute path **outside** the app folder — see step 2 |
   | `VITE_HUM_PORTAL_URL` | Your real finance-partner URL |

   `VITE_HUM_PORTAL_URL` is inlined into the frontend **at build time** (it's
   a `VITE_`-prefixed var), so it must be set before you run the build step,
   not just at runtime.

   No `BLOB_READ_WRITE_TOKEN` anymore — nothing to enable, local disk just works.

5. Deploy. Hostinger runs `npm install`, then your build command, then starts
   `dist-server/index.js`.
6. Point your domain/subdomain at the app (hPanel handles SSL automatically
   via Let's Encrypt).

## 4. Verify

Open the deployed URL and walk through the calculator: submit a test inquiry,
try the plans/photos upload step, and check `/admin` (with `ADMIN_PASSWORD`)
to confirm pricing/welcome-config saves persist after a page reload.

If `RESEND_API_KEY` isn't set, submissions still "succeed" but just log to
the app's console instead of sending — useful for a dry run before wiring up
real email.

## 5. Embedding on the marketing site (unchanged)

The iframe embed instructions, Meta Pixel snippet, and Elementor steps in
`DEPLOYMENT_NOTES.md` (sections 1–4) are hosting-agnostic — just swap the
`src` in the iframe to your new Hostinger URL instead of the old
`*.vercel.app` one.

## 6. Local development

Two processes, same as before conceptually:

```bash
npm run dev:server   # Express API on :3000 (terminal 1)
npm run dev          # Vite dev server on :5174, proxies /api + /uploads → :3000 (terminal 2)
```

Without `RESEND_API_KEY` set locally, the mailer logs to stdout instead of
sending — same stub-mode behavior as before.

## 7. Retention

There's no automatic cleanup of uploaded plans/photos under `DATA_DIR`. If
volume grows, a simple cron job (Hostinger's hPanel has a Cron Jobs section)
that deletes files under `DATA_DIR/uploads/inquiries/` older than N days
covers it — no code changes needed, they're just files on disk.
