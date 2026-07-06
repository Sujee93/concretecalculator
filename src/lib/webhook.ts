/**
 * Direct browser → LeadConnector (GoHighLevel) webhook client.
 *
 * The lead event is POSTed straight from the customer's browser (no backend
 * proxy) to a GHL inbound-webhook URL:
 *
 *   full_submission — fires only on final submission, whenever a finish is
 *                     chosen and a price is shown; re-fires for each different
 *                     finish the customer browses (no deduping).
 *
 * (A `partial_submission` event type is retained below for forward
 * compatibility, but nothing fires it — page-1 warm-lead capture is handled by
 * the Resend email flow, not GHL.)
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

export type WebhookEvent = "partial_submission" | "full_submission";

// -----------------------------------------------------------------------------
// Payload shapes (mirror the two documented event bodies, minus `submittedAt`,
// which sendWebhook stamps).
// -----------------------------------------------------------------------------

export interface PartialSubmission {
  name: string;
  email: string;
  phone: string;
  suburb: string;
}

export interface WebhookFile {
  url: string;
  filename: string;
  contentType: string;
  size: number;
}

export interface FullSubmission extends PartialSubmission {
  areaSqm: number;
  areaMethod: "total" | "sections" | "plans";
  areaSections: { length: number; width: number }[];
  finish: string;
  hasRemoval: boolean;
  slope: string;
  drainage: string;
  stripDrainLengthM: number | null;
  estimateTotalIncGst: number;
  repaymentWeekly: number;
  repaymentFortnightly: number;
  termWeeks: number;
  plans: WebhookFile[];
  photos: WebhookFile[];
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
  payload: PartialSubmission | FullSubmission,
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
// Full submission (fires only on final submission; once per finish browsed)
// -----------------------------------------------------------------------------

/**
 * Fire the priced-lead event. Intentionally un-guarded: call it each time a
 * finish is selected and a price is displayed. Browsing three finishes sends
 * three events.
 */
export function sendFullSubmission(data: FullSubmission): void {
  void sendWebhook("full_submission", data);
}
