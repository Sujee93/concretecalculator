/**
 * Local smoke test for server/routes/submit.ts — exercises the handler with
 * mock Express Request/Response objects against several scenarios.
 * RESEND_API_KEY is unset, so it runs in stub mode (logs the email instead
 * of sending), giving us a fast end-to-end check without spending an email.
 *
 *     npx tsx scripts/submit-smoke.ts
 */

import { submitHandler } from "../server/routes/submit.js";

interface MockRes {
  statusCode: number;
  body: unknown;
}

function mkReq(body: unknown) {
  return { body } as unknown as Parameters<typeof submitHandler>[0];
}

function mkRes() {
  const out: MockRes = { statusCode: 0, body: null };
  const res = {
    status(code: number) {
      out.statusCode = code;
      return this;
    },
    json(body: unknown) {
      out.body = body;
      return this;
    },
  } as unknown as Parameters<typeof submitHandler>[1];
  return { res, out };
}

async function run(label: string, payload: unknown) {
  const { res, out } = mkRes();
  await submitHandler(mkReq(payload), res);
  console.log(`\n[${label}]  →  ${out.statusCode}  ${JSON.stringify(out.body)}`);
}

(async () => {
  // 1. Bogus body
  await run("Invalid payload", { not: "valid" });

  // 3. Valid inquiry (with full estimate)
  await run("Valid inquiry (with estimate)", {
    customer: {
      name: "Inquiry Customer",
      phone: "0400 111 222",
      email: "inquiry@example.com",
      suburb: "Richmond VIC 3121",
    },
    project: {
      areaSqm: 50,
      areaMethod: "total",
      finish: "exposed_aggregate",
      hasRemoval: false,
      slope: "flat_minimal",
      drainage: "no",
    },
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
        { description: "Exposed Aggregate", amount: 11000 },
        { description: "Excavation (0–65m²)", amount: 1500 },
      ],
      reviewFlags: [],
      optimizationDetails: null,
    },
  });

  // 4. Valid inquiry (plans path — area_sqm = 0, plans + photos attached)
  await run("Valid inquiry (plans path with attachments)", {
    customer: {
      name: "Plans Customer",
      phone: "0400 999 888",
      email: "plans@example.com",
      suburb: "Brunswick VIC 3056",
    },
    project: {
      areaSqm: 0,
      areaMethod: "plans",
      finish: "coloured",
      hasRemoval: true,
      slope: "moderately_steep",
      drainage: "yes",
      stripDrainLengthM: 5,
    },
    plans: [
      {
        url: "https://example.com/uploads/plans/site-plan.pdf",
        filename: "site-plan.pdf",
        contentType: "application/pdf",
        size: 1234567,
      },
    ],
    photos: [
      {
        url: "https://example.com/uploads/photos/street.jpg",
        filename: "street.jpg",
        contentType: "image/jpeg",
        size: 482104,
      },
    ],
  });
})();
