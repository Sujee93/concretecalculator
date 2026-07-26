# Smooth Concrete Driveway Calculator

Premium-rebuild of the Smooth Concrete driveway estimate calculator. Static
React SPA + single Vercel serverless function (`/api/submit`) → Resend email.
Iframe-embedded into the Elementor Pro landing page at
`interestfreedriveway.uprisedigital.io`.

Original calculator (Python FastAPI + utilitarian frontend) lives in
`originalcalc/` — read-only reference.

> Spec for this rebuild: [`docs/SPEC.md`](./docs/SPEC.md)
> Deployment + Elementor embed: [`DEPLOYMENT_NOTES.md`](./DEPLOYMENT_NOTES.md)
> Pricing parity proof: [`PRICING_TEST.md`](./PRICING_TEST.md)
> Monday-blocking placeholders: [`TODO.md`](./TODO.md)

## Run locally

```bash
npm install
npm run dev            # Vite dev server only (no /api/submit emulation)
```

Open <http://localhost:5173>. The dev server doesn't emulate the serverless
function — the form will submit and the request will 404 unless you use
Vercel CLI:

```bash
npx vercel dev         # full SPA + /api/submit on localhost:3000
```

With no `RESEND_API_KEY` set, the function runs in **stub mode** — it logs the
email payload and returns success. Convenient for walk-throughs without
sending real emails. To send for real, set the env vars below in `.env.local`.

## Commands

| Command | What it does |
| --- | --- |
| `npm run dev` | Vite SPA dev server, port 5173. No `/api/submit` emulation. |
| `npm run dev:vercel` | Full `vercel dev`, port 3000 — emulates the function. |
| `npm run build` | Strict typecheck + production build to `dist/`. |
| `npm run typecheck` | TypeScript only, no emit. |
| `npm test` | Vitest specs (pricing engine + rounding parity). |
| `npm run parity` | Reproduce the pricing-engine parity table on stdout. |

## Environment variables

Two scopes — see `.env.example` for the full template.

| Var | Scope | Purpose |
| --- | --- | --- |
| `RESEND_API_KEY` | Server-only | Resend API key. Function logs in stub mode without it. |
| `INQUIRY_RECIPIENT_EMAIL` | Server-only | Luke's address (default `lukeshah100@gmail.com`). |
| `SENDER_EMAIL` | Server-only | Verified Resend sender. For v1 use `onboarding@resend.dev`. |
| `VITE_HUM_PORTAL_URL` | Browser (bundled) | HUM partner referral URL. **Placeholder until Monday — don't ship.** |

Variables with the `VITE_` prefix are inlined into the client JS at build
time and visible to anyone. Anything secret (API keys, recipient
addresses) must NOT have the prefix.

## Architecture

```
┌──────────────────────────────────────────────┐
│  Static SPA (Vite + React + TS)              │
│  - all form state + step routing             │
│  - eligibility branching                     │
│  - pricing calc (ported from pricing_engine) │
│  - HUM bracket + optimisation                │
│  - flat utilitarian dark UI (matches         │
│    originalcalc/frontend/index.html)         │
└─────────┬────────────────┬───────────────────┘
          │                │
          │ POST           │ POST + signed upload
          │ /api/submit    │ /api/upload-url
          ▼                ▼
┌──────────────────────────┐ ┌────────────────────┐
│  api/submit.ts           │ │  api/upload-url.ts │
│  - Zod-validates body    │ │  - Mints Vercel    │
│  - branches on outcome   │ │    Blob upload     │
│  - Resend → Luke (+      │ │    tokens (10MB,   │
│    customer on rejected) │ │    image/pdf only) │
└──────────────────────────┘ └────────────────────┘
                                       │
                                       ▼
                              ┌────────────────────┐
                              │  Vercel Blob       │
                              │  inquiries/{date}/ │
                              │    plans/          │
                              │    photos/         │
                              └────────────────────┘
```

No database. No CRM. Luke's inbox is the audit trail; Blob is the file store.

## Where the code lives

```
src/
├── config/pricing.ts       # rates, brackets, fees (mirror of pricing.yaml)
├── lib/
│   ├── pricing.ts          # engine (parity-tested vs Python reference)
│   ├── format.ts           # banker's-rounding currency formatter
│   ├── eligibility.ts      # placeholder rule — TODO Monday
│   ├── submit.ts           # typed fetch wrapper for /api/submit
│   └── upload.ts           # client wrapper around @vercel/blob `upload`
├── state/useFormStore.ts   # Zustand store + step router + validation
├── types/form.ts           # form / eligibility / submission payload types
├── components/
│   ├── Shell.tsx           # outer container
│   ├── ProgressBar.tsx     # CSS-transition progress
│   ├── steps/              # 9 input steps + estimate + rejected screen
│   └── ui/                 # RadioRow, Field, TextAreaField, FileUpload
api/
├── submit.ts               # inquiry email function
├── upload-url.ts           # Vercel Blob client-direct upload tokens
└── emails.ts               # HTML email builders
scripts/
├── pricing-parity.ts            # TS reference printer
├── pricing-parity-reference.py  # Python parity harness
├── submit-smoke.ts              # local function smoke test
└── render-email-preview.ts      # dumps email HTML to /tmp
```

## Deploy

See `DEPLOYMENT_NOTES.md` for the full step-by-step (Vercel project setup, env
vars, Resend domain, Elementor embed snippet). One-liner once configured:

```bash
npx vercel --prod
```

## Pricing parity

The pricing engine is a faithful port of `originalcalc/backend/pricing_engine.py`.
Six test cases (canonical 50m² exposed-aggregate, optimisation trigger,
optimisation skip, bracket boundary, minimum floor, extreme slope + boom pump)
produce identical output to the cent. See `PRICING_TEST.md`.

## License / ownership

Built for Smooth Concrete (Luke Shah) by Uprise Digital. Source code lives in
this repo; production runs on Vercel.
