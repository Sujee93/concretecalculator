/**
 * POST /api/partial-lead — fires when the customer completes the first page
 * (contact details) and clicks Next. Sends an "incomplete lead" alert to the
 * same recipients as the final inquiry (Luke + CC) so the team can follow up
 * if the customer drops off before finishing the quote.
 *
 * A full estimate email still follows from /api/submit if they complete.
 *
 * Returns { success: true } or { success: false, error }.
 */

import type { Request, Response } from "express";
import { z } from "zod";
import { buildPartialLeadEmail, buildWelcomePackEmail } from "../lib/emails.js";
import { readWelcomeConfig } from "../lib/welcomeConfig.js";
import { SENDER_EMAIL, INQUIRY_RECIPIENT, CC_RECIPIENTS, sendEmail } from "../lib/mailer.js";

const payloadSchema = z.object({
  customer: z.object({
    name: z.string().min(1).max(200),
    phone: z.string().min(1).max(60),
    email: z.string().email().max(200),
    suburb: z.string().min(1).max(200),
  }),
  sourceUrl: z.string().max(500).optional(),
});

export async function partialLeadHandler(req: Request, res: Response): Promise<void> {
  const parsed = payloadSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({
      success: false,
      error: `Validation failed: ${parsed.error.issues
        .map((i) => `${i.path.join(".")}: ${i.message}`)
        .join("; ")}`,
    });
    return;
  }

  const { customer, sourceUrl } = parsed.data;
  const apiKey = process.env.RESEND_API_KEY;

  // Both sends are best-effort and independent. We deliberately return 200 even
  // if one fails: the client resets its "sent once" guard on a non-2xx response
  // and would re-POST, which must never double-send the customer welcome email.
  // Individual failures are logged instead.

  // 1. Internal "incomplete lead" alert to Luke (+ CC).
  try {
    await sendEmail(apiKey, {
      from: SENDER_EMAIL,
      to: INQUIRY_RECIPIENT,
      cc: CC_RECIPIENTS,
      replyTo: customer.email,
      subject: `New Lead (incomplete) — ${customer.name}`,
      html: buildPartialLeadEmail(customer, sourceUrl),
    });
  } catch (err) {
    console.error(
      "Partial-lead internal alert failed:",
      err instanceof Error ? err.message : String(err),
    );
  }

  // 2. Welcome-pack email to the customer, with the PDF attached. Fires once
  //    because the client calls this endpoint at most once per session. Copy
  //    + PDF come from the admin-editable welcome config (falls back to the
  //    default copy and the bundled /public PDF).
  try {
    const welcome = await readWelcomeConfig();
    const pdfUrl = welcome.pdfUrl || resolveWelcomePackUrl(req);
    const pdfFilename = welcome.pdfFilename || "Smooth Concrete Welcome Pack.pdf";
    await sendEmail(apiKey, {
      from: SENDER_EMAIL,
      to: customer.email,
      replyTo: INQUIRY_RECIPIENT, // customer replies go to Luke
      subject: welcome.subject,
      html: buildWelcomePackEmail(customer, welcome.body),
      attachments: pdfUrl
        ? [{ filename: pdfFilename, path: pdfUrl }]
        : undefined,
    });
  } catch (err) {
    console.error(
      "Welcome-pack email failed:",
      err instanceof Error ? err.message : String(err),
    );
  }

  res.status(200).json({ success: true });
}

/**
 * Absolute URL of the welcome-pack PDF for Resend to fetch and attach.
 * Prefers WELCOME_PACK_URL; otherwise derives it from the request host, since
 * the PDF ships in /public and is served from the same deployment that hosts
 * this server.
 */
function resolveWelcomePackUrl(req: Request): string | undefined {
  if (process.env.WELCOME_PACK_URL) return process.env.WELCOME_PACK_URL;
  const host = req.headers.host;
  if (!host) return undefined;
  const proto =
    (req.headers["x-forwarded-proto"] as string | undefined)?.split(",")[0] ||
    req.protocol ||
    "https";
  return `${proto}://${host}/Smooth_Concrete_Welcome_Pack.pdf`;
}
