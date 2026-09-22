/**
 * GET  /api/welcome-config — returns the current welcome-email settings
 *                            (subject, body, PDF), merged over defaults.
 * POST /api/welcome-config — password-gated write. Body:
 *                            { password, config: { subject, body, pdfUrl, pdfFilename } }.
 */

import type { Request, Response } from "express";
import {
  readWelcomeConfig,
  welcomeSchema,
  writeWelcomeConfig,
} from "../lib/welcomeConfig.js";

export async function getWelcomeConfig(_req: Request, res: Response): Promise<void> {
  res.setHeader("Cache-Control", "no-store");
  res.status(200).json({ welcome: await readWelcomeConfig() });
}

export async function postWelcomeConfig(req: Request, res: Response): Promise<void> {
  const b = (req.body ?? {}) as { password?: unknown; config?: unknown };

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
    await writeWelcomeConfig(parsed.data);
    res.status(200).json({ success: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("welcome-config save failed:", message);
    res.status(500).json({ success: false, error: `Could not save: ${message}` });
  }
}
