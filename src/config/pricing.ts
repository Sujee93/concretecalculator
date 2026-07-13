/**
 * Smooth Concrete Driveway Calculator — pricing configuration.
 *
 * Direct port of originalcalc/config/pricing.yaml v1.3. Structure intentionally
 * mirrors the YAML so Luke can read this file like the original. Luke edits
 * rates here; nothing else in the codebase needs to know.
 *
 * If you change a number, run `npm run parity` to verify the engine still
 * matches the Python reference.
 */

export interface HumBracket {
  /** Inclusive lower bound on subtotal (ex-GST, ex-finance). */
  from: number;
  /** Inclusive upper bound on subtotal (ex-GST, ex-finance). */
  to: number;
  /** Repayment term length in fortnights. */
  fortnights: number;
  /** Merchant fee percent — applied via reverse calc, see engine. */
  fee: number;
}

export interface PricingConfig {
  baseRates: {
    natural_grey: number;
    coloured: number;
    exposed_aggregate: {
      range_0_60: number;
      range_60_100: number;
      range_100_plus: number;
    };
    pavilion_finish: number;
  };
  /**
   * Which finishes are offered on the calculator's Finish step. Rates always
   * exist in `baseRates`; this only controls visibility, so Luke can retire a
   * finish (e.g. Pavilion) without touching its price. All default to true.
   */
  enabledFinishes: {
    natural_grey: boolean;
    coloured: boolean;
    exposed_aggregate: boolean;
    pavilion_finish: boolean;
  };
  excavation: {
    baseAllowance: number;
    above_65: number;
    above_120: number;
  };
  demolition: {
    minimumAllowance: number;
    above_50_per_sqm: number;
  };
  stripDrain: {
    up_to_6m: number;
    "6_to_10m": number;
    defaultIfUnknown: number;
  };
  steepness: {
    flat_minimal: number;
    moderately_steep: number;
    extremely_steep: {
      "25_50": number;
      "50_plus": number;
    };
  };
  pump: {
    boomPumpCost: number;
    linePumpCost: number;
    boomRequiredAbove: number;
  };
  minimumProjectPrice: number;
  /** Flat merchant/finance fee applied to every quote (e.g. 0.15 = 15%). */
  financeFeeRate: number;
  /** Fixed repayment term, in fortnights, quoted on every estimate. */
  financeTermFortnights: number;
  /**
   * Legacy tiered HUM brackets. No longer drive the fee/term (a flat
   * `financeFeeRate` + `financeTermFortnights` do). Retained for
   * forward-compatibility and the standalone `getHumBracket` lookup.
   */
  humBrackets: HumBracket[];
  humOptimization: {
    enabled: boolean;
    maxDiscountAllowance: number;
    /** Unused in the engine; retained for parity with original YAML. */
    onlyWhenClose: boolean;
  };
  gstRate: number;
}

export const PRICING: PricingConfig = {
  baseRates: {
    natural_grey: 110,
    coloured: 130,
    exposed_aggregate: {
      range_0_60: 220,
      range_60_100: 210,
      range_100_plus: 190,
    },
    pavilion_finish: 150,
  },
  enabledFinishes: {
    natural_grey: true,
    coloured: true,
    exposed_aggregate: true,
    pavilion_finish: true,
  },
  excavation: {
    baseAllowance: 1500,
    above_65: 500,
    above_120: 500,
  },
  demolition: {
    minimumAllowance: 2200,
    above_50_per_sqm: 50,
  },
  stripDrain: {
    up_to_6m: 1500,
    "6_to_10m": 2000,
    defaultIfUnknown: 1500,
  },
  steepness: {
    flat_minimal: 0,
    moderately_steep: 500,
    extremely_steep: {
      "25_50": 1000,
      "50_plus": 0,
    },
  },
  pump: {
    boomPumpCost: 2000,
    linePumpCost: 1500,
    boomRequiredAbove: 50,
  },
  minimumProjectPrice: 6500,
  // Flat finance fee + fixed (maximum) term — quoted on every estimate so the
  // figure is a ceiling, never an under-quote. Replaces the tiered brackets.
  financeFeeRate: 0.15,
  financeTermFortnights: 78,
  humBrackets: [
    { from: 80, to: 1000, fortnights: 6, fee: 4.0 },
    { from: 1000.01, to: 2000, fortnights: 13, fee: 4.67 },
    { from: 2000.01, to: 3500, fortnights: 26, fee: 6.74 },
    { from: 3500.01, to: 5000, fortnights: 39, fee: 8.96 },
    { from: 5000.01, to: 7000, fortnights: 52, fee: 11.82 },
    { from: 7000.01, to: 10000, fortnights: 65, fee: 14.95 },
    { from: 10000.01, to: 15000, fortnights: 78, fee: 17.98 },
    { from: 15000.01, to: 999999, fortnights: 78, fee: 17.98 },
  ],
  humOptimization: {
    enabled: true,
    maxDiscountAllowance: 450,
    onlyWhenClose: false,
  },
  gstRate: 0.1,
};
