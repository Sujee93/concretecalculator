/**
 * POST /api/submit — validates the incoming payload, then sends one inquiry
 * email to Luke via Resend.
 *
 * Returns { success: true } or { success: false, error }.
 */

import type { Request, Response } from "express";
import { buildLukeInquiryEmail } from "../lib/emails.js";
import { SENDER_EMAIL, INQUIRY_RECIPIENT, CC_RECIPIENTS, sendEmail } from "../lib/mailer.js";
import { payloadSchema, type ValidatedPayload } from "../types.js";

export async function submitHandler(req: Request, res: Response): Promise<void> {
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

  const payload = parsed.data;
  const apiKey = process.env.RESEND_API_KEY;

  try {
    await sendEmail(apiKey, {
      from: SENDER_EMAIL,
      to: INQUIRY_RECIPIENT,
      cc: CC_RECIPIENTS,
      replyTo: payload.customer.email,
      subject: buildEligibleSubject(payload),
      html: buildLukeInquiryEmail(payload),
    });

    res.status(200).json({ success: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("Email send failed:", message);
    res.status(500).json({ success: false, error: message });
  }
}

function buildEligibleSubject(p: ValidatedPayload): string {
  const name = p.customer.name;
  if (!p.estimate) {
    return `Driveway Inquiry (measurements pending) — ${name}`;
  }
  const price = currency(p.estimate.finalIncGst);
  return `Driveway Estimate — ${name} — ${price}`;
}

function currency(n: number): string {
  return `$${n.toLocaleString("en-AU", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}
