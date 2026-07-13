/**
 * The subset of pricing values Luke can edit live from the /admin page, without
 * a redeploy. Everything else in `pricing.ts` stays code-managed.
 *
 * At runtime the calculator fetches the stored overrides (see
 * lib/pricingConfig.ts) and calls `applyPricingOverrides`, which writes the
 * values into the shared PRICING singleton. Because every pricing helper reads
 * PRICING, no engine code needs to change — and the emailed quote/GHL payload
 * inherit the new numbers automatically (they're computed client-side from the
 * same object).
 *
 * If no overrides are stored, or the fetch fails, the calculator simply uses the
 * hardcoded defaults below — identical to today's behaviour.
 */

import { PRICING } from "@/config/pricing";

export interface EditablePricing {
  /** Flat merchant/finance fee, as a rate (0.15 = 15%). */
  financeFeeRate: number;
  /** Fixed repayment term quoted on every estimate, in fortnights. */
  financeTermFortnights: number;
  /** Project price floor, ex-GST ex-finance. */
  minimumProjectPrice: number;
  baseRates: {
    natural_grey: number;
    coloured: number;
    pavilion_finish: number;
    exposed_aggregate: {
      range_0_60: number;
      range_60_100: number;
      range_100_plus: number;
    };
  };
  /** Per-finish visibility on the calculator. See PricingConfig.enabledFinishes. */
  enabledFinishes: {
    natural_grey: boolean;
    coloured: boolean;
    exposed_aggregate: boolean;
    pavilion_finish: boolean;
  };
}

/**
 * Pristine defaults, snapshotted from PRICING at module load (before any
 * override can mutate it). Used to prefill the admin form and to fill any field
 * a stored override happens to be missing.
 */
export const EDITABLE_DEFAULTS: EditablePricing = {
  financeFeeRate: PRICING.financeFeeRate,
  financeTermFortnights: PRICING.financeTermFortnights,
  minimumProjectPrice: PRICING.minimumProjectPrice,
  baseRates: {
    natural_grey: PRICING.baseRates.natural_grey,
    coloured: PRICING.baseRates.coloured,
    pavilion_finish: PRICING.baseRates.pavilion_finish,
    exposed_aggregate: { ...PRICING.baseRates.exposed_aggregate },
  },
  enabledFinishes: { ...PRICING.enabledFinishes },
};

/** Coerce to a finite number, else fall back. */
const num = (v: unknown, fallback: number): number =>
  typeof v === "number" && Number.isFinite(v) ? v : fallback;

/** Coerce to a boolean, else fall back (so a missing/legacy field defaults on). */
const bool = (v: unknown, fallback: boolean): boolean =>
  typeof v === "boolean" ? v : fallback;

/**
 * Merge a stored (possibly partial or malformed) override object over the
 * defaults and write the result into the live PRICING singleton. Passing
 * null/undefined resets PRICING to its defaults.
 */
export function applyPricingOverrides(
  cfg: Partial<EditablePricing> | null | undefined,
): void {
  const c = cfg ?? {};
  const d = EDITABLE_DEFAULTS;

  PRICING.financeFeeRate = num(c.financeFeeRate, d.financeFeeRate);
  PRICING.financeTermFortnights = num(
    c.financeTermFortnights,
    d.financeTermFortnights,
  );
  PRICING.minimumProjectPrice = num(c.minimumProjectPrice, d.minimumProjectPrice);

  const b = (c.baseRates ?? {}) as Partial<EditablePricing["baseRates"]>;
  const ea = (b.exposed_aggregate ?? {}) as Partial<
    EditablePricing["baseRates"]["exposed_aggregate"]
  >;
  PRICING.baseRates.natural_grey = num(b.natural_grey, d.baseRates.natural_grey);
  PRICING.baseRates.coloured = num(b.coloured, d.baseRates.coloured);
  PRICING.baseRates.pavilion_finish = num(
    b.pavilion_finish,
    d.baseRates.pavilion_finish,
  );
  PRICING.baseRates.exposed_aggregate.range_0_60 = num(
    ea.range_0_60,
    d.baseRates.exposed_aggregate.range_0_60,
  );
  PRICING.baseRates.exposed_aggregate.range_60_100 = num(
    ea.range_60_100,
    d.baseRates.exposed_aggregate.range_60_100,
  );
  PRICING.baseRates.exposed_aggregate.range_100_plus = num(
    ea.range_100_plus,
    d.baseRates.exposed_aggregate.range_100_plus,
  );

  const ef = (c.enabledFinishes ?? {}) as Partial<
    EditablePricing["enabledFinishes"]
  >;
  PRICING.enabledFinishes.natural_grey = bool(
    ef.natural_grey,
    d.enabledFinishes.natural_grey,
  );
  PRICING.enabledFinishes.coloured = bool(
    ef.coloured,
    d.enabledFinishes.coloured,
  );
  PRICING.enabledFinishes.exposed_aggregate = bool(
    ef.exposed_aggregate,
    d.enabledFinishes.exposed_aggregate,
  );
  PRICING.enabledFinishes.pavilion_finish = bool(
    ef.pavilion_finish,
    d.enabledFinishes.pavilion_finish,
  );
}
