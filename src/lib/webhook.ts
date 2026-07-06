/**
 * Direct browser → LeadConnector (GoHighLevel) webhook client.
 *
 * The lead event is POSTed straight from the customer's browser (no backend
 * proxy) to a GHL inbound-webhook URL:
 *
 *   partial_submission — fires once, as soon as the customer completes the
 *                        FIRST step (name / phone / email / suburb).
 *
 * Every send is fire-and-forget from the UI's perspective: failures are logged
 * and swallowed, never thrown, so a webhook hiccup can't block or break the form.
 *
 * CORS: GHL inbound webhooks normally return permissive CORS headers, so the
 * first attempt is a standard `cors` fetch (lets us read the status to confirm).
 * If that throws — a blocked CORS preflight or a dropped network request — we
 * retry ONCE with `mode: "no-cors"`. That still delivers the body to GHL but
 * yields an opaque response we can't read, which is fine for fire-and-forget.
 * Net effect: one retry that also doubles as the CORS fallback.
 */

const WEBHOOK_URL =
  "https://services.leadconnectorhq.com/hooks/4FY1yDon7JUzRs0JC1L0/webhook-trigger/x14dZzrTg82b58OV25xm";

export type WebhookEvent = "partial_submission";

/** Contact fields captured on the first step. */
export interface PartialSubmission {
  name: string;
  email: string;
  phone: string;
  suburb: string;
}

// -----------------------------------------------------------------------------
// Core sender
// -----------------------------------------------------------------------------

/**
 * Stamp `submittedAt` and POST the event to GHL. Best-effort: resolves `true`
 * if the request was dispatched (even opaquely via the no-cors fallback),
 * `false` only if both attempts threw. Never rejects.
 */
export async function sendWebhook(
  event: WebhookEvent,
  payload: PartialSubmission,
): Promise<boolean> {
  const body = JSON.stringify({
    event,
    ...payload,
    submittedAt: new Date().toISOString(),
  });

  // Attempt 1 — standard CORS request. If GHL returns permissive headers we
  // can read res.ok and log a bad status.
  try {
    const res = await fetch(WEBHOOK_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
      // Let the request outlive the page if the user navigates away mid-form.
      keepalive: true,
    });
    if (!res.ok) console.warn(`[webhook] ${event} returned HTTP ${res.status}`);
    return true;
  } catch (err) {
    // A CORS-preflight block or a network drop lands here. Retry once as a pure
    // fire-and-forget no-cors post: the body still reaches GHL, the response is
    // opaque (unreadable), which is all we need.
    console.warn(
      `[webhook] ${event} direct POST failed — retrying fire-and-forget (no-cors). ` +
        `If this always happens, GHL is blocking the CORS preflight; the data is ` +
        `still delivered but the response can't be confirmed.`,
      err,
    );
    try {
      await fetch(WEBHOOK_URL, {
        method: "POST",
        mode: "no-cors",
        // No JSON Content-Type header here: a non-simple header would force a
        // preflight and defeat no-cors. GHL parses the text/plain body fine.
        body,
        keepalive: true,
      });
      return true;
    } catch (err2) {
      console.error(`[webhook] ${event} delivery failed after retry`, err2);
      return false;
    }
  }
}

/** Basic "looks like an email" check, shared with the form's page-1 validation
 *  (see state/useFormStore.ts) so the two never diverge. */
export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// -----------------------------------------------------------------------------
// Partial submission — fires once, after the first step
// -----------------------------------------------------------------------------

function isCompleteLead(lead: PartialSubmission): boolean {
  return (
    lead.name.trim() !== "" &&
    lead.phone.trim() !== "" &&
    lead.suburb.trim() !== "" &&
    EMAIL_RE.test(lead.email.trim())
  );
}

// Session guard: a page load = a session. Resets on full reload.
let partialSent = false;

/**
 * Fire the warm-lead event. No-ops if it has already fired this session or if
 * the four required fields aren't all present and the email valid. Safe to call
 * on every "Next" click — the guards make repeat calls free.
 */
export function sendPartialSubmission(lead: PartialSubmission): void {
  if (partialSent) return;
  if (!isCompleteLead(lead)) return;
  partialSent = true;
  void sendWebhook("partial_submission", lead).then((ok) => {
    // If delivery totally failed, un-latch so a later Next click can retry.
    if (!ok) partialSent = false;
  });
}
