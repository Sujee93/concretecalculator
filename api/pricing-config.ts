/**
 * GET  /api/pricing-config — returns the stored editable-pricing overrides
 *                            (or { overrides: null } if none / storage off).
 *                            The calculator fetches this on load.
 *
 * POST /api/pricing-config — password-gated write of new overrides. Body:
 *                            { password: string, config: EditablePricing }.
 *
 * Persistence reuses the project's existing Vercel Blob store (a single JSON
 * blob at config/pricing.json). No new service to set up.
 *
 * Env:
 *   ADMIN_PASSWORD        (server-only; required to save; if unset, saving 500s)
 *   BLOB_READ_WRITE_TOKEN (auto-injected once Blob is enabled on the project)
 *
 * Degrades safely: with no Blob/overrides, GET returns null and the calculator
 * falls back to its hardcoded defaults — identical to pre-admin behaviour.
 */

import type { VercelRequest, VercelResponse } from "@vercel/node";
import { z } from "zod";
import { list, put } from "@vercel/blob";

const BLOB_PATH = "config/pricing.json";

// Bounds are deliberately generous — they exist to reject fat-finger/garbage
// input (negative rates, a fee of 900%), not to enforce business policy.
const money = z.number().min(0).max(1_000_000);
const editableSchema = z.object({
  financeFeeRate: z.number().min(0).max(0.9),
  financeTermFortnights: z.number().int().min(1).max(520),
  minimumProjectPrice: money,
  baseRates: z.object({
    natural_grey: money,
    coloured: money,
    pavilion_finish: money,
    exposed_aggregate: z.object({
      range_0_60: money,
      range_60_100: money,
      range_100_plus: money,
    }),
  }),
});

async function readOverrides(): Promise<unknown | null> {
  try {
    const { blobs } = await list({ prefix: BLOB_PATH, limit: 1 });
    const blob = blobs.find((b) => b.pathname === BLOB_PATH) ?? blobs[0];
    if (!blob) return null;
    const res = await fetch(blob.url, { cache: "no-store" });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    // Blob not enabled, network hiccup, malformed JSON — treat as "no overrides".
    return null;
  }
}

export default async function handler(
  req: VercelRequest,
  res: VercelResponse,
): Promise<void> {
  if (req.method === "GET") {
    const overrides = await readOverrides();
    res.setHeader("Cache-Control", "no-store");
    res.status(200).json({ overrides: overrides ?? null });
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

  const parsed = editableSchema.safeParse(b.config);
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
      cacheControlMaxAge: 0, // keep changes fresh on next load
    });
    res.status(200).json({ success: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("pricing-config save failed:", message);
    res.status(500).json({
      success: false,
      error: `Could not save (is Blob storage enabled?): ${message}`,
    });
  }
}
