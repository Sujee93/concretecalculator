/**
 * Dump rendered email HTML to /tmp so I can eyeball it.
 *
 *     npx tsx scripts/render-email-preview.ts
 *     open /tmp/email-{eligible,plans-only}.html
 */

import { writeFileSync } from "node:fs";
import { buildLukeInquiryEmail } from "../server/lib/emails.js";

const SAMPLE_PHOTO = {
  url: "https://placehold.co/600x400/333/fff?text=Street+View",
  filename: "street-view.jpg",
  contentType: "image/jpeg",
  size: 482104,
};
const SAMPLE_PLAN = {
  url: "https://placehold.co/600x400/444/fff?text=Site+Plan.pdf",
  filename: "site-plan.pdf",
  contentType: "application/pdf",
  size: 1294821,
};

const eligibleWithEstimate = {
  customer: {
    name: "Jane Smith",
    phone: "0412 345 678",
    email: "jane@example.com",
    suburb: "Docklands VIC 3008",
  },
  project: {
    areaSqm: 50,
    areaMethod: "total" as const,
    finish: "exposed_aggregate" as const,
    hasRemoval: false,
    slope: "flat_minimal" as const,
    drainage: "no" as const,
  },
  plans: [],
  photos: [SAMPLE_PHOTO, { ...SAMPLE_PHOTO, filename: "garage-view.jpg" }],
  estimate: {
    finalIncGst: 16176.47,
    financeAdjustedExGst: 14705.88,
    gstAmount: 1470.59,
    originalSubtotal: 12500,
    optimizationOccurred: false,
    discountApplied: 0,
    originalBracket: {
      from: 6500,
      to: 999999,
      fortnights: 78,
      feePercent: 15,
      rangeDesc: "Flat rate",
    },
    optimizedBracket: {
      from: 6500,
      to: 999999,
      fortnights: 78,
      feePercent: 15,
      rangeDesc: "Flat rate",
    },
    repayment: {
      termWeeks: 156,
      fortnights: 78,
      fortnightly: 207.39,
      weekly: 103.7,
    },
    lineItems: [
      { description: "Exposed Aggregate: $220/m² × 50m²", amount: 11000 },
      { description: "Excavation (0–65m²)", amount: 1500 },
      { description: "Demolition (not required)", amount: 0 },
      { description: "Steepness (flat/minimal)", amount: 0 },
      { description: "Pump (not required)", amount: 0 },
      { description: "Strip Drain (not required)", amount: 0 },
    ],
    reviewFlags: [],
    optimizationDetails: null,
  },
};

const eligiblePlansOnly = {
  customer: {
    name: "Plans Customer",
    phone: "0400 999 888",
    email: "plans@example.com",
    suburb: "Brunswick VIC 3056",
  },
  project: {
    areaSqm: 0,
    areaMethod: "plans" as const,
    finish: "coloured" as const,
    hasRemoval: true,
    slope: "moderately_steep" as const,
    drainage: "yes" as const,
    stripDrainLengthM: 5,
  },
  plans: [SAMPLE_PLAN],
  photos: [SAMPLE_PHOTO],
};

writeFileSync(
  "/tmp/email-eligible.html",
  buildLukeInquiryEmail(eligibleWithEstimate),
);
writeFileSync(
  "/tmp/email-plans-only.html",
  buildLukeInquiryEmail(eligiblePlansOnly),
);

console.log("Rendered to /tmp/email-{eligible,plans-only}.html");
