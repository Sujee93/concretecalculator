# Deployment Notes

> **This app now deploys to Hostinger, not Vercel** — see
> [`HOSTINGER_DEPLOYMENT.md`](./HOSTINGER_DEPLOYMENT.md) for the current
> hosting setup (a self-hosted Express server replaces the old Vercel
> serverless functions + Blob storage). Sections 1–4 and 7 below (visual
> direction, iframe embed, Meta Pixel, Elementor steps, Resend setup) are
> unchanged and still apply; sections 5, 6, and 8 are superseded by the
> Hostinger doc.

Everything you need to wire the inquiry emails through Resend and embed the
result in the Elementor landing page at
`interestfreedriveway.uprisedigital.io`.

**Deployed URL**: _TODO — paste here once deployed to Hostinger._

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
versions). Replace `https://YOUR-DEPLOYED-URL` with the calculator's deployed
URL (see `HOSTINGER_DEPLOYMENT.md`).

```html
<!-- Smooth Concrete driveway calculator
     Embeds the app as an iframe. Calculator renders at 380px wide;
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
    src="https://YOUR-DEPLOYED-URL/"
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
   `YOUR-DEPLOYED-URL` with your deployed URL.
6. **Update** the page (top right).
7. Open the page in a private window. Walk through the calculator end-to-end
   on the test page. Verify the inquiry email arrives.
8. Once happy: copy the HTML widget on the test page (right-click → Copy),
   then paste it into the same column on the live LP at
   `interestfreedriveway.uprisedigital.io` (also via Elementor). Update.

If you ever need to revert: delete the HTML widget and drag the original
Elementor form widget back in.

---

## 5. Hosting + file storage

Superseded by [`HOSTINGER_DEPLOYMENT.md`](./HOSTINGER_DEPLOYMENT.md), which
covers deploying the self-hosted Express server (`server/`) to Hostinger,
required env vars, and where uploaded plans/photos + admin-edited config now
live (local disk under `DATA_DIR`, replacing Vercel Blob).

## 7. Resend setup

### Account + API key

1. Create a Resend account at <https://resend.com> (free tier = 100
   emails/day, plenty for inquiry volume).
2. **API Keys → Create API Key**. Permissions: `Sending access` (writes only).
3. Copy the key into the app's env vars (`RESEND_API_KEY` — see
   `HOSTINGER_DEPLOYMENT.md`).

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
3. Once Resend shows the domain as **Verified**, update the env var in
   hPanel:
   - `SENDER_EMAIL=inquiries@smoothconcrete.com.au`
4. Redeploy (hPanel → the Node.js app → Redeploy, or push to the connected branch).
5. Send a test inquiry. Confirm the email arrives from
   `inquiries@smoothconcrete.com.au` and that Gmail / Outlook show the
   sender as verified (no "via resend.dev" caption).

### Testing the integration

Before pasting the embed snippet into the live LP:

```bash
# 1. Deploy (see HOSTINGER_DEPLOYMENT.md), or run locally with
#    npm run dev:server + npm run dev

# 2. Open the deployed (or local) URL, walk through with eligible details.
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

## 8. Local development against the backend

Superseded by [`HOSTINGER_DEPLOYMENT.md`](./HOSTINGER_DEPLOYMENT.md) §6 —
run `npm run dev:server` (Express API) and `npm run dev` (Vite, proxying
`/api` + `/uploads` to it) in two terminals. Without `RESEND_API_KEY`, the
server runs in **stub mode** and logs the email payload to stdout.

You can also use the script `npm run parity` to regenerate
`PRICING_TEST.md` numbers, and `npx tsx scripts/submit-smoke.ts` to hit
the submit handler with a few canonical scenarios without HTTP at all.

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
