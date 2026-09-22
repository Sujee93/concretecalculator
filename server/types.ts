/**
 * Shared payload validation for /api/submit — mirrors src/types/form.ts →
 * SubmissionPayload. Split out from routes/submit.ts so lib/emails.ts can
 * import the inferred type without pulling in the whole route handler.
 */

import { z } from "zod";

const customerSchema = z.object({
  name: z.string().min(1).max(200),
  phone: z.string().min(1).max(60),
  email: z.string().email().max(200),
  suburb: z.string().min(1).max(200),
});

const projectSchema = z.object({
  areaSqm: z.number().nonnegative(),
  areaMethod: z.enum(["total", "sections", "plans"]),
  areaSections: z
    .array(z.object({ length: z.number(), width: z.number() }))
    .optional(),
  finish: z.enum([
    "natural_grey",
    "coloured",
    "exposed_aggregate",
    "pavilion_finish",
  ]),
  hasRemoval: z.boolean(),
  slope: z.enum(["flat_minimal", "moderately_steep", "extremely_steep"]),
  drainage: z.enum(["no", "yes", "unsure"]),
  stripDrainLengthM: z.number().optional(),
});

const uploadedFileSchema = z.object({
  url: z.string().url(),
  filename: z.string().max(255),
  contentType: z.string().max(100),
  size: z.number().nonnegative(),
});

const estimateSchema = z
  .object({
    finalIncGst: z.number(),
    financeAdjustedExGst: z.number(),
    gstAmount: z.number(),
    originalSubtotal: z.number(),
    optimizationOccurred: z.boolean(),
    discountApplied: z.number(),
    originalBracket: z.object({
      from: z.number(),
      to: z.number(),
      fortnights: z.number(),
      feePercent: z.number(),
      rangeDesc: z.string(),
    }),
    optimizedBracket: z.object({
      from: z.number(),
      to: z.number(),
      fortnights: z.number(),
      feePercent: z.number(),
      rangeDesc: z.string(),
    }),
    repayment: z.object({
      termWeeks: z.number(),
      fortnights: z.number(),
      fortnightly: z.number(),
      weekly: z.number(),
    }),
    lineItems: z.array(
      z.object({ description: z.string(), amount: z.number() }),
    ),
    reviewFlags: z.array(z.string()),
    optimizationDetails: z
      .object({
        reason: z.string(),
        feeSavings: z.number(),
        discountAmount: z.number(),
        netBenefit: z.number(),
      })
      .nullable(),
  })
  .partial({ optimizationDetails: true });

export const payloadSchema = z.object({
  customer: customerSchema,
  project: projectSchema,
  plans: z.array(uploadedFileSchema).optional().default([]),
  photos: z.array(uploadedFileSchema).optional().default([]),
  estimate: estimateSchema.optional(),
});

export type ValidatedPayload = z.infer<typeof payloadSchema>;
