/**
 * /admin — Luke's live pricing editor. Password-gated on save (server-side).
 *
 * Edits the small "finance + base rate" subset (see config/editablePricing.ts)
 * and persists it via /api/pricing-config. Changes take effect on the next
 * calculator load — no redeploy.
 */

import { useEffect, useMemo, useState } from "react";
import { Field } from "@/components/ui/Field";
import {
  EDITABLE_DEFAULTS,
  type EditablePricing,
} from "@/config/editablePricing";
import { fetchPricingOverrides, savePricingConfig } from "@/lib/pricingConfig";

interface Draft {
  financeFeePercent: string;
  financeTermFortnights: string;
  minimumProjectPrice: string;
  natural_grey: string;
  coloured: string;
  pavilion_finish: string;
  ea_0_60: string;
  ea_60_100: string;
  ea_100_plus: string;
}

function toDraft(cfg: EditablePricing): Draft {
  return {
    financeFeePercent: String(+(cfg.financeFeeRate * 100).toFixed(4)),
    financeTermFortnights: String(cfg.financeTermFortnights),
    minimumProjectPrice: String(cfg.minimumProjectPrice),
    natural_grey: String(cfg.baseRates.natural_grey),
    coloured: String(cfg.baseRates.coloured),
    pavilion_finish: String(cfg.baseRates.pavilion_finish),
    ea_0_60: String(cfg.baseRates.exposed_aggregate.range_0_60),
    ea_60_100: String(cfg.baseRates.exposed_aggregate.range_60_100),
    ea_100_plus: String(cfg.baseRates.exposed_aggregate.range_100_plus),
  };
}

/** Parse the draft into a validated EditablePricing, or return an error string. */
function fromDraft(d: Draft): { config: EditablePricing } | { error: string } {
  const n = (v: string) => (v.trim() === "" ? NaN : Number(v));
  const vals = {
    financeFeePercent: n(d.financeFeePercent),
    financeTermFortnights: n(d.financeTermFortnights),
    minimumProjectPrice: n(d.minimumProjectPrice),
    natural_grey: n(d.natural_grey),
    coloured: n(d.coloured),
    pavilion_finish: n(d.pavilion_finish),
    ea_0_60: n(d.ea_0_60),
    ea_60_100: n(d.ea_60_100),
    ea_100_plus: n(d.ea_100_plus),
  };
  if (Object.values(vals).some((x) => !Number.isFinite(x))) {
    return { error: "Every field must be a number." };
  }
  if (vals.financeFeePercent < 0 || vals.financeFeePercent >= 90) {
    return { error: "Finance fee must be between 0 and 90%." };
  }
  if (vals.financeTermFortnights < 1 || !Number.isInteger(vals.financeTermFortnights)) {
    return { error: "Term must be a whole number of fortnights (1 or more)." };
  }
  if (Object.values(vals).some((x) => x < 0)) {
    return { error: "Values can't be negative." };
  }
  return {
    config: {
      financeFeeRate: vals.financeFeePercent / 100,
      financeTermFortnights: vals.financeTermFortnights,
      minimumProjectPrice: vals.minimumProjectPrice,
      baseRates: {
        natural_grey: vals.natural_grey,
        coloured: vals.coloured,
        pavilion_finish: vals.pavilion_finish,
        exposed_aggregate: {
          range_0_60: vals.ea_0_60,
          range_60_100: vals.ea_60_100,
          range_100_plus: vals.ea_100_plus,
        },
      },
    },
  };
}

export function AdminPricing() {
  const [draft, setDraft] = useState<Draft>(() => toDraft(EDITABLE_DEFAULTS));
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<
    { kind: "ok" | "err"; text: string } | null
  >(null);

  // Prefill with whatever's currently saved (falls back to defaults).
  useEffect(() => {
    let cancelled = false;
    void fetchPricingOverrides().then((cfg) => {
      if (cancelled) return;
      if (cfg) setDraft(toDraft({ ...EDITABLE_DEFAULTS, ...cfg }));
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const set = (k: keyof Draft) => (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = e.target.value;
    setDraft((d) => ({ ...d, [k]: v }));
    setStatus(null);
  };

  const termHint = useMemo(() => {
    const f = Number(draft.financeTermFortnights);
    if (!Number.isFinite(f) || f <= 0) return "In fortnights.";
    const weeks = f * 2;
    const months = Math.round((weeks / 52) * 12);
    return `In fortnights — ${f} = ${weeks} weeks (~${months} months).`;
  }, [draft.financeTermFortnights]);

  const onSave = async () => {
    setStatus(null);
    if (!password.trim()) {
      setStatus({ kind: "err", text: "Enter the admin password." });
      return;
    }
    const parsed = fromDraft(draft);
    if ("error" in parsed) {
      setStatus({ kind: "err", text: parsed.error });
      return;
    }
    setSaving(true);
    const res = await savePricingConfig(parsed.config, password);
    setSaving(false);
    setStatus(
      res.success
        ? { kind: "ok", text: "Saved. Changes apply on the next calculator load." }
        : { kind: "err", text: res.error || "Save failed." },
    );
  };

  const box: React.CSSProperties = {
    maxWidth: 640,
    margin: "0 auto",
    padding: "32px 20px 64px",
  };
  const sectionTitle: React.CSSProperties = {
    fontSize: 14,
    textTransform: "uppercase",
    letterSpacing: "0.06em",
    opacity: 0.6,
    margin: "28px 0 8px",
  };

  return (
    <div style={box}>
      <h1 style={{ fontSize: 24, marginBottom: 4 }}>Smooth Concrete — Pricing</h1>
      <p className="form-hint" style={{ marginTop: 0 }}>
        Update finance and base rates. Changes take effect on the next
        calculator load — no redeploy needed.
      </p>

      {loading ? (
        <p style={{ opacity: 0.7 }}>Loading current values…</p>
      ) : (
        <>
          <div style={sectionTitle}>Finance</div>
          <Field
            label="Finance fee (%)"
            name="financeFeePercent"
            type="number"
            inputMode="decimal"
            step="0.1"
            min="0"
            value={draft.financeFeePercent}
            onChange={set("financeFeePercent")}
            hint="Flat merchant fee added to every quote. 15 = 15%."
          />
          <Field
            label="Repayment term (fortnights)"
            name="financeTermFortnights"
            type="number"
            inputMode="numeric"
            step="1"
            min="1"
            value={draft.financeTermFortnights}
            onChange={set("financeTermFortnights")}
            hint={termHint}
          />
          <Field
            label="Minimum project price ($)"
            name="minimumProjectPrice"
            type="number"
            inputMode="decimal"
            step="100"
            min="0"
            value={draft.minimumProjectPrice}
            onChange={set("minimumProjectPrice")}
            hint="Ex-GST, ex-finance floor applied to small jobs."
          />

          <div style={sectionTitle}>Base rates ($ per m²)</div>
          <Field
            label="Natural grey"
            name="natural_grey"
            type="number"
            inputMode="decimal"
            step="1"
            min="0"
            value={draft.natural_grey}
            onChange={set("natural_grey")}
          />
          <Field
            label="Coloured"
            name="coloured"
            type="number"
            inputMode="decimal"
            step="1"
            min="0"
            value={draft.coloured}
            onChange={set("coloured")}
          />
          <Field
            label="Pavilion finish"
            name="pavilion_finish"
            type="number"
            inputMode="decimal"
            step="1"
            min="0"
            value={draft.pavilion_finish}
            onChange={set("pavilion_finish")}
          />
          <Field
            label="Exposed aggregate — under 60m²"
            name="ea_0_60"
            type="number"
            inputMode="decimal"
            step="1"
            min="0"
            value={draft.ea_0_60}
            onChange={set("ea_0_60")}
          />
          <Field
            label="Exposed aggregate — 60 to 100m²"
            name="ea_60_100"
            type="number"
            inputMode="decimal"
            step="1"
            min="0"
            value={draft.ea_60_100}
            onChange={set("ea_60_100")}
          />
          <Field
            label="Exposed aggregate — 100m² and over"
            name="ea_100_plus"
            type="number"
            inputMode="decimal"
            step="1"
            min="0"
            value={draft.ea_100_plus}
            onChange={set("ea_100_plus")}
          />

          <div style={sectionTitle}>Save</div>
          <Field
            label="Admin password"
            name="password"
            type="password"
            value={password}
            onChange={(e) => {
              setPassword(e.target.value);
              setStatus(null);
            }}
            autoComplete="current-password"
          />

          {status && (
            <p
              className={status.kind === "err" ? "field-error" : undefined}
              style={{
                margin: "4px 0 12px",
                color: status.kind === "ok" ? "#27ae60" : undefined,
                fontWeight: 600,
              }}
            >
              <span>{status.text}</span>
            </p>
          )}

          <button
            type="button"
            className="btn btn-primary"
            onClick={onSave}
            disabled={saving}
            style={{ width: "100%", marginTop: 4 }}
          >
            {saving ? "Saving…" : "Save changes"}
          </button>
        </>
      )}
    </div>
  );
}
