/**
 * Single-source-of-truth store for form state, step routing, and the computed
 * estimate.
 *
 * Step routing rules:
 *   customer → area → area-detail → finish → removal → slope → drainage
 *            → photos → estimate
 *   estimate → submission (handled by the estimate step, not the store)
 */

import { create } from "zustand";
import {
  INITIAL_FORM_STATE,
  STEP_ORDER,
  type AreaSection,
  type CustomerDetails,
  type DrainageState,
  type FormState,
  type StepId,
  type UploadedFile,
} from "@/types/form";
import type { Finish, Slope } from "@/lib/pricing";
import { EMAIL_RE } from "@/lib/webhook";

export { STEP_ORDER };

interface FormActions {
  setStep: (step: StepId) => void;
  next: () => void;
  back: () => void;
  reset: () => void;
  setCustomer: (patch: Partial<CustomerDetails>) => void;
  setArea: (patch: Partial<FormState["area"]>) => void;
  addAreaSection: () => void;
  removeAreaSection: (id: string) => void;
  updateAreaSection: (id: string, patch: Partial<AreaSection>) => void;
  setFinish: (finish: Finish) => void;
  setHasRemoval: (hasRemoval: boolean) => void;
  setSlope: (slope: Slope) => void;
  setDrainage: (patch: Partial<DrainageState>) => void;
  addPlan: (file: UploadedFile) => void;
  removePlan: (url: string) => void;
  addPhoto: (file: UploadedFile) => void;
  removePhoto: (url: string) => void;
  /** Bumped after live pricing overrides are applied, to trigger a recompute. */
  bumpPricingVersion: () => void;
}

export type FormStore = FormState & FormActions & { pricingVersion: number };

const newSectionId = () =>
  globalThis.crypto?.randomUUID?.() ??
  `s-${Math.random().toString(36).slice(2, 10)}`;

export const useFormStore = create<FormStore>((set) => ({
  ...INITIAL_FORM_STATE,
  pricingVersion: 0,

  bumpPricingVersion: () =>
    set((s) => ({ pricingVersion: s.pricingVersion + 1 })),

  setStep: (step) => set({ step }),

  next: () =>
    set((s) => {
      const idx = STEP_ORDER.indexOf(s.step);
      const nextIdx = Math.min(idx + 1, STEP_ORDER.length - 1);
      return { step: STEP_ORDER[nextIdx] };
    }),

  back: () =>
    set((s) => {
      const idx = STEP_ORDER.indexOf(s.step);
      const prevIdx = Math.max(idx - 1, 0);
      return { step: STEP_ORDER[prevIdx] };
    }),

  reset: () => set({ ...INITIAL_FORM_STATE }),

  setCustomer: (patch) =>
    set((s) => ({ customer: { ...s.customer, ...patch } })),

  setArea: (patch) => set((s) => ({ area: { ...s.area, ...patch } })),

  addAreaSection: () =>
    set((s) => ({
      area: {
        ...s.area,
        sections: [
          ...s.area.sections,
          { id: newSectionId(), length: "", width: "" },
        ],
      },
    })),

  removeAreaSection: (id) =>
    set((s) => ({
      area: { ...s.area, sections: s.area.sections.filter((x) => x.id !== id) },
    })),

  updateAreaSection: (id, patch) =>
    set((s) => ({
      area: {
        ...s.area,
        sections: s.area.sections.map((x) =>
          x.id === id ? { ...x, ...patch } : x,
        ),
      },
    })),

  setFinish: (finish) => set({ finish }),
  setHasRemoval: (hasRemoval) => set({ hasRemoval }),
  setSlope: (slope) => set({ slope }),
  setDrainage: (patch) =>
    set((s) => ({ drainage: { ...s.drainage, ...patch } })),

  addPlan: (file) => set((s) => ({ plans: [...s.plans, file] })),
  removePlan: (url) =>
    set((s) => ({ plans: s.plans.filter((f) => f.url !== url) })),
  addPhoto: (file) => set((s) => ({ photos: [...s.photos, file] })),
  removePhoto: (url) =>
    set((s) => ({ photos: s.photos.filter((f) => f.url !== url) })),
}));

// =============================================================================
// Validation — returns per-field error map. UI displays each error inline
// beneath its input (WCAG-friendly inline-validation pattern: aria-invalid
// + below-field error text linked via aria-describedby).
// =============================================================================

export type StepErrors = Record<string, string>;

export interface StepValidation {
  ok: boolean;
  errors: StepErrors;
}

export function validateStep(state: FormState): StepValidation {
  const errors: StepErrors = {};

  switch (state.step) {
    case "customer": {
      if (!state.customer.name.trim()) errors.name = "Full name is required.";
      if (!state.customer.phone.trim())
        errors.phone = "Phone number is required.";
      if (!state.customer.email.trim()) {
        errors.email = "Email address is required.";
      } else if (!EMAIL_RE.test(state.customer.email.trim())) {
        // Same pattern the GHL partial-lead webhook guards on (see
        // lib/webhook.ts). Keeping them identical guarantees any email that
        // passes page 1 also fires the partial_submission — no silent skips.
        errors.email = "Please enter a valid email address.";
      }
      if (!state.customer.suburb.trim())
        errors.suburb = "Suburb or postcode is required.";
      break;
    }
    case "area": {
      if (!state.area.method)
        errors.method = "Please choose how you'd like to measure your driveway.";
      break;
    }
    case "area-detail": {
      const m = state.area.method;
      if (!m) {
        errors.method = "Please choose how you'd like to measure your driveway.";
        break;
      }
      if (m === "total") {
        const v = Number(state.area.totalArea);
        if (!state.area.totalArea || !Number.isFinite(v) || v <= 0) {
          errors.totalArea =
            "Enter a valid total area in square metres.";
        }
      } else if (m === "sections") {
        const valid = state.area.sections.filter(
          (s) => Number(s.length) > 0 && Number(s.width) > 0,
        );
        if (valid.length === 0) {
          errors.sections =
            "Enter valid measurements for at least one section.";
        }
      } else if (m === "plans") {
        if (state.plans.length === 0) {
          errors.plans = "Upload your plans or scaled drawing.";
        }
      }
      break;
    }
    case "finish":
      if (!state.finish) errors.finish = "Please select a concrete finish.";
      break;
    case "removal":
      if (state.hasRemoval === undefined)
        errors.removal = "Please tell us about any existing surface.";
      break;
    case "slope":
      if (!state.slope) errors.slope = "Please select the driveway slope.";
      break;
    case "drainage":
      if (!state.drainage.answer)
        errors.drainage = "Please answer the drainage question.";
      break;
    case "photos":
      // Photos are optional — strongly encouraged in the UI copy, but never
      // required to proceed to the estimate.
      break;
  }

  return { ok: Object.keys(errors).length === 0, errors };
}

// =============================================================================
// Derived: compute the total m² for pricing.
// =============================================================================

export function computeAreaSqm(state: FormState): number {
  const m = state.area.method;
  if (m === "total") return Number(state.area.totalArea) || 0;
  if (m === "sections") {
    return state.area.sections.reduce((acc, s) => {
      const len = Number(s.length) || 0;
      const wid = Number(s.width) || 0;
      return acc + len * wid;
    }, 0);
  }
  // "plans": no numerical area provided. Pricing engine will floor to $6,500.
  return 0;
}
