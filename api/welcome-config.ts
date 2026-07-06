/**
 * GET  /api/welcome-config — returns the current welcome-email settings
 *                            (subject, body, PDF), merged over defaults.
 * POST /api/welcome-config — password-gated write. Body:
 *                            { password, config: { subject, body, pdfUrl, pdfFilename } }.
 *
 * Lets Luke edit the welcome-pack email copy and swap the attached PDF from
 * /admin without a redeploy. Persisted as a JSON blob (config/welcome.json) in
 * the same Vercel Blob store. Read server-side by /api/partial-lead at send time.
 *
 * Body supports two tokens, substituted per-recipient when the email is built:
 *   {{firstName}} — the customer's first name
 *   {{phone}}     — SMOOTH_CONCRETE_PHONE (blank if unset)
 */

import type { VercelRequest, VercelResponse } from "@vercel/node";
import { z } from "zod";
import { list, put } from "@vercel/blob";

const BLOB_PATH = "config/welcome.json";

export interface WelcomeConfig {
  subject: string;
  /** Plain-text template. Blank line = new paragraph. Supports {{firstName}}, {{phone}}. */
  body: string;
  /** Blob URL of an uploaded PDF, or null to use the bundled /public default. */
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

async function readJsonBlob(path: string): Promise<Record<string, unknown> | null> {
  try {
    const { blobs } = await list({ prefix: path, limit: 1 });
    const blob = blobs.find((b) => b.pathname === path) ?? blobs[0];
    if (!blob) return null;
    const res = await fetch(blob.url, { cache: "no-store" });
    if (!res.ok) return null;
    return (await res.json()) as Record<string, unknown>;
  } catch {
    return null;
  }
}

/** Full welcome config, stored values merged over defaults. Never throws. */
export async function readWelcomeConfig(): Promise<WelcomeConfig> {
  const s = await readJsonBlob(BLOB_PATH);
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

const welcomeSchema = z.object({
  subject: z.string().min(1).max(300),
  body: z.string().min(1).max(20000),
  pdfUrl: z.string().url().max(2000).nullable(),
  pdfFilename: z.string().max(300).nullable(),
});

export default async function handler(
  req: VercelRequest,
  res: VercelResponse,
): Promise<void> {
  if (req.method === "GET") {
    res.setHeader("Cache-Control", "no-store");
    res.status(200).json({ welcome: await readWelcomeConfig() });
    return;
  }

  if (req.method !== "POST") {
    res.status(405).json({ success: false, error: "Method Not Allowed" });
    return;
  }

  let body: unknown = req.body;
  if (typeof body === "string") {
    try {
      body = JSON.parse(body);
    } catch {
      res.status(400).json({ success: false, error: "Invalid JSON" });
      return;
    }
  }
  const b = (body ?? {}) as { password?: unknown; config?: unknown };

  const expected = process.env.ADMIN_PASSWORD;
  if (!expected) {
    res.status(500).json({
      success: false,
      error: "Admin password is not configured on the server.",
    });
    return;
  }
  if (typeof b.password !== "string" || b.password !== expected) {
    res.status(401).json({ success: false, error: "Incorrect password." });
    return;
  }

  const parsed = welcomeSchema.safeParse(b.config);
  if (!parsed.success) {
    res.status(400).json({
      success: false,
      error: `Validation failed: ${parsed.error.issues
        .map((i) => `${i.path.join(".")}: ${i.message}`)
        .join("; ")}`,
    });
    return;
  }

  try {
    await put(BLOB_PATH, JSON.stringify(parsed.data), {
      access: "public",
      contentType: "application/json",
      addRandomSuffix: false,
      allowOverwrite: true,
      cacheControlMaxAge: 0,
    });
    res.status(200).json({ success: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("welcome-config save failed:", message);
    res.status(500).json({
      success: false,
      error: `Could not save (is Blob storage enabled?): ${message}`,
    });
  }
}
