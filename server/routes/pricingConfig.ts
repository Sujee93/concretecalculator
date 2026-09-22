/**
 * GET  /api/pricing-config — returns the stored editable-pricing overrides
 *                            (or { overrides: null } if none set).
 * POST /api/pricing-config — password-gated write of new overrides. Body:
 *                            { password: string, config: EditablePricing }.
 */

import type { Request, Response } from "express";
import {
  editablePricingSchema,
  readPricingOverrides,
  writePricingOverrides,
} from "../lib/pricingConfig.js";

export async function getPricingConfig(_req: Request, res: Response): Promise<void> {
  const overrides = await readPricingOverrides();
  res.setHeader("Cache-Control", "no-store");
  res.status(200).json({ overrides: overrides ?? null });
}

export async function postPricingConfig(req: Request, res: Response): Promise<void> {
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

  const parsed = editablePricingSchema.safeParse(b.config);
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
    await writePricingOverrides(parsed.data);
    res.status(200).json({ success: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("pricing-config save failed:", message);
    res.status(500).json({ success: false, error: `Could not save: ${message}` });
  }
}
