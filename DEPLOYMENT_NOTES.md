# Deployment Notes

Everything you need to deploy the Smooth Concrete calculator to Vercel, wire
the inquiry emails through Resend, and embed the result in the Elementor
landing page at `interestfreedriveway.uprisedigital.io`.

**Deployed URL**: _TODO — paste here after `vercel --prod` succeeds._

---

## 1. Visual direction — solid dark

Three options were on the table in the spec:

1. **Glassmorphism** — semi-transparent dark surface, `backdrop-filter: blur`
2. **Solid dark** — opaque dark gradient card with orange-tinted hairline border
3. **Inverse light** — cream card on dark hero

**Chosen: solid dark.** Reasoning:

- The hero background is a dark suburban-aerial photo. Glass blur reads as a
  muddy smudge against an already-dark, busy background — the glass effect
  needs a clearly-defined backdrop to shine.
- `backdrop-filter` has uneven support inside iframes when the host page
  (Elementor) layers transforms — risk of rendering inconsistency across
  browsers.
- Inverse light is high-contrast but reads as fast-food / promo when orange
  accents sit on cream — out of step with the residential-premium brand.
- Solid dark matches the hero's tonal family while clearly being its own
  surface. Same look across every browser, no `backdrop-filter` quirks.

**Feel:** a confident matte-black card sitting on the hero photo. Vertical
gradient `#161616 → #1d1d1d` (avoiding flat black, which always reads cheap on
photo backgrounds), a hairline `rgba(255, 102, 0, 0.18)` border, soft outer
shadow that lifts the card off the photo. Orange `#FF6600` reserved for focus
rings, the primary CTA, and the headline currency — when it appears it carries
weight.

---

## 2. Iframe dimensions

| Surface | Value |
| --- | --- |
| **Width** | `380px` (works gracefully down to 360, scales up to ~480) |
| **Height** | `720px` (designed at this height; can autosize to `760` if rows feel cramped on a specific step) |
| **Mobile** | Iframe should be `width: 100%; max-width: 100%;` and `min-width: 320px` on the WordPress side |

The Vite SPA itself is `max-w-[380px]` inside the shell so it sits cleanly
even if the iframe slot widens.

---

## 3. Elementor embed snippet

Drop this into an Elementor **HTML** widget (also called Custom HTML in some
versions). Replace `https://YOUR-VERCEL-URL.vercel.app` with the deployed URL
once `vercel --prod` completes.

```html
<!-- Smooth Concrete driveway calculator
     Embeds the Vercel app as an iframe. Calculator renders at 380px wide;
     surrounding column should be at least 380px to avoid horizontal scroll
     on the iframe scrollbar.
-->
<style>
  .smooth-concrete-calc-wrap {
    width: 100%;
    max-width: 380px;
    margin: 0 auto;
  }
  .smooth-concrete-calc-wrap iframe {
    width: 100%;
    height: 720px;
    border: 0;
    display: block;
    background: transparent;
    border-radius: 12px;
    overflow: hidden;
  }
  @media (max-width: 480px) {
    .smooth-concrete-calc-wrap iframe { height: 760px; }
  }
</style>
<div class="smooth-concrete-calc-wrap">
  <iframe
    src="https://YOUR-VERCEL-URL.vercel.app/"
    title="Driveway estimate calculator"
    loading="lazy"
    referrerpolicy="strict-origin-when-cross-origin"
    sandbox="allow-forms allow-scripts allow-same-origin allow-top-navigation"
  ></iframe>
</div>
```

Notes on the snippet:

- `sandbox` includes `allow-top-navigation` because the success CTA navigates
  the parent window to the HUM portal. Without it, `window.location.href`
  inside the iframe is silently blocked.
- `loading="lazy"` defers iframe load until it scrolls into view — modest
  but real LCP win on the hero section.
- `border-radius: 12px` on the iframe wraps the dark card's rounded corners
  visually; the calculator card itself is also 12px so they line up exactly.

---

## 3b. Meta Pixel `Contact` event (REQUIRED for the interest-free campaign)

The campaign runs on Meta, so the only conversion event needed is **Contact**,
fired when the customer submits the contact-details step (step 1).

The Pixel lives on this **parent** WordPress page; the calculator runs inside
the iframe on a different origin, so `fbq` is not callable from inside it — and
the Meta **Event Setup Tool cannot be used** here for the same reason. Instead
the calculator `postMessage`s a marker up to the parent, and the parent fires
the Pixel event.

Add this snippet to the WordPress page **once** (footer, theme, or GTM Custom
HTML tag), after the base Pixel code:

```html
<script>
  window.addEventListener("message", function (event) {
    if (event.data && event.data.type === "META_CONTACT_EVENT") {
      if (typeof window.fbq === "function") {
        window.fbq("track", "Contact");
      }
    }
  });
</script>
```

Testing: Meta Events Manager → **Test Events** → open the LP, fill in the
contact-details step, click **Get my estimate** → the `Contact` event should
appear. It fires at most once per page load.

---

## 4. WordPress / Elementor side — step by step

> **Use the test page first**, not the live LP. The spec calls this the
> _Interest Free LP – bk_ backup page. Verify the embed there, get sign-off,
> then copy the widget onto the production page.

1. Open WordPress admin, navigate to **Pages → Interest Free LP – bk → Edit
   with Elementor**.
2. In the hero section, find the right-hand column currently containing the
   "Get An Instant Estimate" form.
3. Right-click the existing form widget → **Delete**.
4. From the left panel, drag an **HTML** widget into the column where the
   form used to sit.
5. Paste the snippet above into the widget's "HTML Code" area. Replace
   `YOUR-VERCEL-URL.vercel.app` with your deployed URL.
6. **Update** the page (top right).
7. Open the page in a private window. Walk through the calculator end-to-end
   on the test page. Verify the inquiry email arrives.
8. Once happy: copy the HTML widget on the test page (right-click → Copy),
   then paste it into the same column on the live LP at
   `interestfreedriveway.uprisedigital.io` (also via Elementor). Update.

If you ever need to revert: delete the HTML widget and drag the original
Elementor form widget back in.

---

## 5. Vercel deployment

### One-time setup

1. Install the Vercel CLI globally if you don't have it: `npm i -g vercel`.
2. Log in: `vercel login`.
3. From this repo: `vercel link` (choose your team, "Create a new project",
   accept the defaults — `vercel.json` already pins the framework and the
   serverless function).

### Deploy

```bash
vercel --prod
```

Pushes a fresh build to production. Vercel will:

- run `npm run build` (which runs `tsc --noEmit && vite build`)
- serve `dist/` as static
- deploy `api/submit.ts` as a Node serverless function (10s max duration,
  256MB memory — already pinned in `vercel.json`)

### Environment variables

In the Vercel dashboard: **Project → Settings → Environment Variables**. Set
**each variable in all three scopes** (Production, Preview, Development).

| Variable | Scope | Value |
| --- | --- | --- |
| `RESEND_API_KEY` | All three | From <https://resend.com/api-keys>. Server-side only. |
| `INQUIRY_RECIPIENT_EMAIL` | All three | `lukeshah100@gmail.com` (or current preferred address). |
| `SENDER_EMAIL` | All three | `onboarding@resend.dev` for v1. **Don't paste the production domain until DNS is verified — see Resend section below.** |
| `BLOB_READ_WRITE_TOKEN` | All three | Auto-injected by Vercel when Blob is enabled on the project (see Blob storage section below). |
| `VITE_HUM_PORTAL_URL` | All three | **TODO Monday.** Do NOT deploy to Production with the placeholder URL. |

**Important**: after changing env vars, redeploy (`vercel --prod`) — env
changes don't propagate to existing deployments automatically.

### Preview deploys

Every push (when you connect a git remote) gets a Preview URL with the
Preview-scope env vars. Useful for QA before promoting to Production.

---

## 6. Blob storage (Vercel Blob) — for plans + photos

The Area step's "I'll upload plans or photos" option and the Photos step both
write directly to Vercel Blob from the browser via short-lived signed tokens
minted by `/api/upload-url`. The submission email Luke receives contains
thumbnails and links to each uploaded file.

### Enable Blob on the project

1. In the Vercel dashboard: **Project → Storage → Connect Store → Blob**.
2. Vercel creates a store and auto-injects `BLOB_READ_WRITE_TOKEN` into all
   three env scopes (Production, Preview, Development).
3. Redeploy (`vercel --prod`) so the function picks up the new env var.

That's it — no AWS keys, no separate bucket setup.

### Local dev with Blob

`npx vercel env pull .env.local` pulls the token down to your machine so
the dev middleware can mint upload URLs locally. Without the token,
`/api/upload-url` returns 503 with a clear message and uploads at the
area/photos steps will fail with that error text shown in the file row.

### File constraints

`api/upload-url.ts` enforces:
- **Max file size**: 10 MB (matches original `pricing.yaml:max_upload_size_mb`)
- **Allowed types**: `image/jpeg`, `image/png`, `image/gif`, `image/webp`, `application/pdf`
- **Path scheme**: `inquiries/{YYYY-MM-DD}/{plans|photos}/{filename}` with a
  random suffix to avoid collisions

### Retention / cost

Vercel Blob's free tier is 500 MB storage and 1 GB bandwidth per month. At a
rough estimate (one inquiry = ~5 MB total, ~50 inquiries/month) the free tier
covers more than 100× the expected volume. If volume grows, the next tier
is $0.15/GB stored / $0.30/GB egress — still trivial.

There's no automatic delete. If you want files purged after N days,
schedule a Vercel Cron that calls `del()` from `@vercel/blob` for paths
older than your retention window.

## 7. Resend setup

### Account + API key

1. Create a Resend account at <https://resend.com> (free tier = 100
   emails/day, plenty for inquiry volume).
2. **API Keys → Create API Key**. Permissions: `Sending access` (writes only).
3. Copy the key into Vercel env vars (`RESEND_API_KEY`, all three scopes).

### v1 sender (sandbox)

`smoothconcrete.com.au` DNS sits on Hostinger and is managed by a third
party not currently reachable, so domain verification will take time.

For v1, use the Resend sandbox sender:

- `SENDER_EMAIL=onboarding@resend.dev`
- Recipient (`lukeshah100@gmail.com`) will see emails from
  `Smooth Concrete Calculator <onboarding@resend.dev>` — functional, slightly
  off-brand in the inbox. Customer rejection emails go to the customer
  from the same sender; spam-folder placement is the main risk and should
  be flagged in the customer email body (`reply to this email…`) so the
  customer marks it Not Spam if it lands there.
- This works without any DNS access. Both Luke and the customer can receive.

### Cutover to verified domain (later)

When DNS access to `smoothconcrete.com.au` is sorted:

1. **Resend dashboard → Domains → Add Domain**. Enter `smoothconcrete.com.au`.
2. Resend will display required DNS records — SPF (TXT), DKIM (TXT, 3 records),
   and DMARC (TXT). Add these to the Hostinger DNS panel for
   `smoothconcrete.com.au`. Propagation is usually 5–60 minutes but can take
   up to 24 hours.
3. Once Resend shows the domain as **Verified**, update the Vercel env var:
   - `SENDER_EMAIL=inquiries@smoothconcrete.com.au`
4. Redeploy (`vercel --prod`).
5. Send a test inquiry. Confirm the email arrives from
   `inquiries@smoothconcrete.com.au` and that Gmail / Outlook show the
   sender as verified (no "via resend.dev" caption).

### Testing the integration

Before pasting the embed snippet into the live LP:

```bash
# 1. Deploy to a Preview URL
vercel

# 2. Open the Preview URL, walk through with eligible details.
#    Click "Continue to HUM Finance". Verify:
#    - Resend dashboard (Logs tab) shows the send
#    - Luke's inbox receives the inquiry email
#    - You're redirected to the HUM portal URL

# 3. Walk through again with failing eligibility (e.g. bankruptcy=yes).
#    Verify:
#    - Rejection thank-you screen appears
#    - Luke's inbox receives the REJECTED handover email
#    - The customer email address you used receives the rejection email
```

---

## 8. Local development against the function

The Vite dev server (`npm run dev`) is fast but doesn't emulate `/api/submit`.
For end-to-end local testing:

```bash
# Once: link the project to Vercel (only needed to pick up project env vars)
npx vercel link

# Pull preview-env vars locally (optional — stubs work without these)
npx vercel env pull .env.local

# Run the full dev environment (function + SPA on localhost:3000)
npx vercel dev
```

Without `RESEND_API_KEY`, the function runs in **stub mode** and logs the
email payload to stdout. The form will report success and the
redirect/rejection flow works as normal — useful for UI work without burning
real emails.

You can also use the script `npm run parity` to regenerate
`PRICING_TEST.md` numbers, and `npx tsx scripts/submit-smoke.ts` to hit
the function handler with the 5 canonical scenarios without HTTP at all.

---

## 9. Future work (out of scope for v1)

Documented here so future-you knows where to start:

- **Inquiry log / dashboard.** Luke's inbox is the audit trail. If volume
  exceeds what an inbox handles, a simple Airtable / Notion integration
  per inquiry would give him a structured view.
- **Real-time pricing dashboard for Luke.** `originalcalc/dashboard.py`
  existed for this but never shipped. Re-add as a separate authenticated
  route if useful.
- **CRM hookup.** No CRM in scope for v1.
- **A/B testing on copy.** The eligibility-pre-check is a meaningful funnel
  step; eventually worth measuring conversion through the pre-check vs.
  skipping straight to estimate. Posthog or a similar lightweight tool
  would do it.
- **Internationalisation.** Out of scope. Australia-only.
