import { useEffect, useMemo, useRef, useState } from "react";
import { computeAreaSqm, useFormStore } from "@/state/useFormStore";
import { calculateEstimate, type Drainage } from "@/lib/pricing";
import { formatCurrency } from "@/lib/format";
import { submitInquiry } from "@/lib/submit";
import type { SubmissionPayload } from "@/types/form";
import {
  CalendarIcon,
  PaperPlaneIcon,
} from "@/components/ui/icons";

export function EstimateStep() {
  const state = useFormStore();
  const [status, setStatus] = useState<"sending" | "sent" | "error">("sending");
  const [error, setError] = useState<string | null>(null);
  const sentRef = useRef(false);

  // When the customer uploaded plans instead of entering dimensions there's no
  // real area to price — we don't show an auto-calculated figure (it would just
  // floor to the project minimum and mislead). Instead we tell them we'll do a
  // manual takeoff from their drawings.
  const isPlans = state.area.method === "plans";

  const areaSqm = useMemo(() => computeAreaSqm(state), [state]);

  const estimate = useMemo(() => {
    if (!state.finish || state.hasRemoval === undefined || !state.slope) {
      return null;
    }
    return calculateEstimate({
      areaSqm,
      finish: state.finish,
      hasRemoval: state.hasRemoval,
      slope: state.slope,
      drainage: (state.drainage.answer ?? "no") as Drainage,
      stripDrainLengthM:
        state.drainage.answer === "yes" &&
        typeof state.drainage.lengthM === "number"
          ? state.drainage.lengthM
          : undefined,
    });
  }, [areaSqm, state]);

  const buildPayload = (): SubmissionPayload => ({
    customer: state.customer,
    project:
      state.finish && state.hasRemoval !== undefined && state.slope &&
      state.drainage.answer
        ? {
            areaSqm,
            areaMethod: state.area.method!,
            areaSections:
              state.area.method === "sections"
                ? state.area.sections
                    .filter(
                      (s) => Number(s.length) > 0 && Number(s.width) > 0,
                    )
                    .map((s) => ({
                      length: Number(s.length),
                      width: Number(s.width),
                    }))
                : undefined,
            finish: state.finish,
            hasRemoval: state.hasRemoval,
            slope: state.slope,
            drainage: state.drainage.answer,
            stripDrainLengthM:
              state.drainage.answer === "yes" &&
              typeof state.drainage.lengthM === "number"
                ? state.drainage.lengthM
                : undefined,
          }
        : undefined,
    plans: state.plans,
    photos: state.photos,
    // No dollar estimate on the plans path — Luke does a takeoff from the
    // drawings, and the email subject reads "measurements pending".
    estimate: isPlans ? undefined : estimate ?? undefined,
  });

  const submit = async () => {
    setStatus("sending");
    setError(null);
    const result = await submitInquiry(buildPayload());
    if (result.success) {
      setStatus("sent");
    } else {
      setError(result.error || "Something went wrong. Please try again.");
      setStatus("error");
    }
  };

  // Send the inquiry automatically once the customer reaches the estimate —
  // there's no longer a "submit" button. The ref guards against the effect
  // firing twice (React StrictMode in dev).
  useEffect(() => {
    if (sentRef.current) return;
    sentRef.current = true;
    void submit();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Figures to display, from the live estimate.
  const weekly = estimate?.repayment.weekly ?? 0;
  const total = estimate?.finalIncGst ?? 0;

  if (!isPlans && !estimate) {
    return <div className="estimate-page">Calculating…</div>;
  }

  return (
    <div className="estimate-page">
      <div className="estimate-body">
        {/* Heading */}
        <div className="estimate-hero">
          <h2 className="estimate-title">
            Your <span>Estimate</span>
          </h2>
          <p className="estimate-subtitle">
            {isPlans
              ? "Here's what happens next"
              : "Here's your estimated repayments"}
          </p>
        </div>

        {/* Figures card */}
        {isPlans ? (
          <div className="estimate-card">
            <div className="plans-note">
              Because you've uploaded plans, we'll do a takeoff from your
              drawings to work out an accurate driveway size — this part needs a
              person, not a calculator. Our team will review your plans and be in
              contact with your full estimate and the next steps.
            </div>
          </div>
        ) : (
          <div className="estimate-card">
            <div className="repay-label">Estimated repayments from</div>
            <div className="repay-amount">
              <span className="repay-value tnum">{formatCurrency(weekly)}</span>
              <span className="repay-unit">/week</span>
            </div>

            <div className="term-pill">
              <CalendarIcon size={16} />
              <span>
                Over a <strong>36-month</strong> term
              </span>
            </div>

            <div className="estimate-divider" />

            <div className="total-row">
              <div className="total-text">
                <div className="total-label">Total project investment</div>
                <div className="total-value tnum">{formatCurrency(total)}</div>
              </div>
            </div>
          </div>
        )}

        {/* Confirmation / status */}
        <div className="thanks-block">
          {status === "error" ? (
            <>
              <div className="estimate-badge estimate-badge--error">
                <PaperPlaneIcon size={26} />
              </div>
              <h3 className="thanks-title">Something went wrong</h3>
              <div className="thanks-rule" />
              <p className="thanks-text">We couldn't send your details: {error}</p>
              <button
                type="button"
                className="btn btn-primary"
                style={{ marginTop: 12 }}
                onClick={submit}
              >
                Try again
              </button>
            </>
          ) : (
            <>
              <h3 className="thanks-title">We'll be in contact!</h3>
              <p className="thanks-text">
                We've got your details and will confirm your quote and next
                steps shortly.
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
