/**
 * Shared email config + Resend send helper used by the inquiry endpoints
 * (/api/submit and /api/partial-lead).
 *
 * Env vars:
 *   RESEND_API_KEY            (required in production)
 *   INQUIRY_RECIPIENT_EMAIL   (Luke's address — primary "to")
 *   INQUIRY_CC_EMAILS         (comma-separated CC list)
 *   SENDER_EMAIL              (verified sender — see DEPLOYMENT_NOTES.md)
 *
 * Local dev: if RESEND_API_KEY is unset, sendEmail logs the payload and
 * returns success — convenient for testing without a real key.
 */

import { Resend } from "resend";

export const SENDER_EMAIL = process.env.SENDER_EMAIL || "onboarding@resend.dev";
export const INQUIRY_RECIPIENT =
  process.env.INQUIRY_RECIPIENT_EMAIL || "luke@smoothconcrete.com.au";
// Additional recipients CC'd on every inquiry (comma-separated env override,
// otherwise the Uprise Digital contact by default).
export const CC_RECIPIENTS = (
  process.env.INQUIRY_CC_EMAILS || "thejana@uprisedigital.com.au"
)
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

export interface EmailAttachment {
  filename: string;
  /** Hosted URL Resend fetches at send time (mutually exclusive with content). */
  path?: string;
  /** Base64 / Buffer content, if attaching inline instead of by URL. */
  content?: string;
}

export interface EmailArgs {
  from: string;
  to: string;
  cc?: string[];
  replyTo?: string;
  subject: string;
  html: string;
  attachments?: EmailAttachment[];
}

export async function sendEmail(
  apiKey: string | undefined,
  args: EmailArgs,
): Promise<void> {
  if (!apiKey) {
    // Local dev stub. No key → log and pretend it worked.
    console.log("[mailer] (no RESEND_API_KEY — stub mode)");
    console.log("  to:", args.to);
    if (args.cc?.length) console.log("  cc:", args.cc.join(", "));
    console.log("  subject:", args.subject);
    if (args.attachments?.length)
      console.log(
        "  attachments:",
        args.attachments.map((a) => a.filename).join(", "),
      );
    return;
  }
  const resend = new Resend(apiKey);
  const result = await resend.emails.send({
    from: args.from,
    to: [args.to],
    cc: args.cc?.length ? args.cc : undefined,
    replyTo: args.replyTo,
    subject: args.subject,
    html: args.html,
    attachments: args.attachments?.length ? args.attachments : undefined,
  });
  if (result.error) {
    throw new Error(`Resend error: ${result.error.message}`);
  }
}
