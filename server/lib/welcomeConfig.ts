/**
 * Welcome-pack email settings (subject, body, PDF), persisted as
 * DATA_DIR/config/welcome.json. Read server-side by /api/partial-lead at
 * send time, and editable from /admin via /api/welcome-config.
 *
 * Body supports two tokens, substituted per-recipient when the email is built:
 *   {{firstName}} — the customer's first name
 *   {{phone}}     — SMOOTH_CONCRETE_PHONE (blank if unset)
 */

import { z } from "zod";
import { readJsonConfig, writeJsonConfig } from "./storage.js";

const CONFIG_FILE = "welcome.json";

export interface WelcomeConfig {
  subject: string;
  /** Plain-text template. Blank line = new paragraph. Supports {{firstName}}, {{phone}}. */
  body: string;
  /** URL of an uploaded PDF, or null to use the bundled /public default. */
  pdfUrl: string | null;
  pdfFilename: string | null;
}

/** Luke's approved default copy. Single source of truth for the default email. */
export const WELCOME_DEFAULTS: WelcomeConfig = {
  subject: "Welcome to Smooth Concrete — your welcome pack",
  body: `Hi {{firstName}},

Thank you for your interest in Smooth Concrete.

We noticed you began completing our driveway enquiry form, so we wanted to reach out personally and say hello.

Customer satisfaction is something we take very seriously here at Smooth Concrete, and we'd like to share our welcome pack with you so you can learn more about who we are, our process, and the quality of work we're proud to deliver.

Once you finish completing the online calculator, your details and job information will be sent across to me. I'll then do a final review and contact you directly to discuss your project.

In the meantime, if there's anything you need, feel free to reach out by phone or email and either myself or one of our team members will get back to you as soon as possible.

Kind regards,
Luke
Smooth Concrete
{{phone}}`,
  pdfUrl: null,
  pdfFilename: null,
};

/** Full welcome config, stored values merged over defaults. Never throws. */
export async function readWelcomeConfig(): Promise<WelcomeConfig> {
  const s = await readJsonConfig<Partial<WelcomeConfig>>(CONFIG_FILE);
  const str = (v: unknown, fallback: string) =>
    typeof v === "string" && v.trim() ? v : fallback;
  return {
    subject: str(s?.subject, WELCOME_DEFAULTS.subject),
    body: str(s?.body, WELCOME_DEFAULTS.body),
    pdfUrl: typeof s?.pdfUrl === "string" && s.pdfUrl ? s.pdfUrl : null,
    pdfFilename:
      typeof s?.pdfFilename === "string" && s.pdfFilename ? s.pdfFilename : null,
  };
}

export const welcomeSchema = z.object({
  subject: z.string().min(1).max(300),
  body: z.string().min(1).max(20000),
  pdfUrl: z.string().url().max(2000).nullable(),
  pdfFilename: z.string().max(300).nullable(),
});

export async function writeWelcomeConfig(
  config: z.infer<typeof welcomeSchema>,
): Promise<void> {
  await writeJsonConfig(CONFIG_FILE, config);
}
