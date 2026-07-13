import { useFormStore } from "@/state/useFormStore";
import { RadioRow } from "@/components/ui/RadioRow";
import { PRICING } from "@/config/pricing";
import type { Finish } from "@/lib/pricing";
import type { StepErrors } from "@/state/useFormStore";

const OPTIONS: { v: Finish; title: string; sub: string }[] = [
  { v: "natural_grey", title: "Natural Grey", sub: "Classic, affordable concrete" },
  { v: "coloured", title: "Coloured Concrete", sub: "Custom colours available" },
  {
    v: "exposed_aggregate",
    title: "Exposed Aggregate",
    sub: "Premium decorative finish",
  },
  {
    v: "pavilion_finish",
    title: "Pavilion Finish",
    sub: "Premium polished surface",
  },
];

export function FinishStep({ errors }: { errors: StepErrors }) {
  const { finish, setFinish } = useFormStore();
  // Re-read on each pricing-override load so a finish Luke switches off in the
  // admin drops out here. PRICING.enabledFinishes is written by
  // applyPricingOverrides; pricingVersion bumps once that completes.
  useFormStore((s) => s.pricingVersion);
  const options = OPTIONS.filter(({ v }) => PRICING.enabledFinishes[v]);
  return (
    <div className="form-section">
      <h2>Concrete Finish</h2>
      <div className="form-group">
        <label className="step-question">Select your preferred finish</label>
        {options.map(({ v, title, sub }) => (
          <RadioRow
            key={v}
            name="finish"
            value={v}
            title={title}
            sub={sub}
            selected={finish === v}
            onSelect={() => setFinish(v)}
          />
        ))}
        {errors.finish && (
          <p className="field-error">
            <span>{errors.finish}</span>
          </p>
        )}
      </div>
    </div>
  );
}
