/**
 * Editable-pricing overrides, persisted as DATA_DIR/config/pricing.json.
 * The calculator fetches this on load; the admin page writes it (password-gated).
 *
 * Degrades safely: with no stored overrides, callers get null and the
 * calculator falls back to its hardcoded defaults.
 */

import { z } from "zod";
import { readJsonConfig, writeJsonConfig } from "./storage.js";

const CONFIG_FILE = "pricing.json";

// Bounds are deliberately generous — they exist to reject fat-finger/garbage
// input (negative rates, a fee of 900%), not to enforce business policy.
const money = z.number().min(0).max(1_000_000);
export const editablePricingSchema = z.object({
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
  // Optional so pre-existing stored configs (written before this field
  // existed) still validate; the client always sends it now.
  enabledFinishes: z
    .object({
      natural_grey: z.boolean(),
      coloured: z.boolean(),
      exposed_aggregate: z.boolean(),
      pavilion_finish: z.boolean(),
    })
    .default({
      natural_grey: true,
      coloured: true,
      exposed_aggregate: true,
      pavilion_finish: true,
    }),
});

export async function readPricingOverrides(): Promise<unknown | null> {
  return readJsonConfig<unknown>(CONFIG_FILE);
}

export async function writePricingOverrides(
  config: z.infer<typeof editablePricingSchema>,
): Promise<void> {
  await writeJsonConfig(CONFIG_FILE, config);
}
