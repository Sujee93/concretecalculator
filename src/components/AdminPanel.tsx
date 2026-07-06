/**
 * /admin — Luke's live settings panel. Two sections, one shared password:
 *   • Pricing — finance + base rates (see config/editablePricing.ts)
 *   • Welcome email — subject, body copy, and the attached welcome-pack PDF
 *
 * Saves are password-gated server-side. Changes take effect on the next
 * calculator load / next email sent — no redeploy.
 */

import { useEffect, useMemo, useRef, useState } from "react";
import { Field, TextAreaField } from "@/components/ui/Field";
import {
  EDITABLE_DEFAULTS,
  type EditablePricing,
} from "@/config/editablePricing";
import { fetchPricingOverrides, savePricingConfig } from "@/lib/pricingConfig";
import {
  fetchWelcomeConfig,
  saveWelcomeConfig,
  type WelcomeConfig,
} from "@/lib/welcomeConfig";
import { uploadWelcomePack } from "@/lib/upload";

// ---------------------------------------------------------------------------
// Pricing draft helpers
// ---------------------------------------------------------------------------

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

function fromDraft(d: Draft): { config: EditablePricing } | { error: string } {
  const n = (v: string) => (v.trim() === "" ? NaN : Number(v));
  const v = {
    fee: n(d.financeFeePercent),
    term: n(d.financeTermFortnights),
    min: n(d.minimumProjectPrice),
    ng: n(d.natural_grey),
    col: n(d.coloured),
    pav: n(d.pavilion_finish),
    e1: n(d.ea_0_60),
    e2: n(d.ea_60_100),
    e3: n(d.ea_100_plus),
  };
  if (Object.values(v).some((x) => !Number.isFinite(x)))
    return { error: "Every pricing field must be a number." };
  if (v.fee < 0 || v.fee >= 90)
    return { error: "Finance fee must be between 0 and 90%." };
  if (v.term < 1 || !Number.isInteger(v.term))
    return { error: "Term must be a whole number of fortnights (1 or more)." };
  if (Object.values(v).some((x) => x < 0))
    return { error: "Pricing values can't be negative." };
  return {
    config: {
      financeFeeRate: v.fee / 100,
      financeTermFortnights: v.term,
      minimumProjectPrice: v.min,
      baseRates: {
        natural_grey: v.ng,
        coloured: v.col,
        pavilion_finish: v.pav,
        exposed_aggregate: { range_0_60: v.e1, range_60_100: v.e2, range_100_plus: v.e3 },
      },
    },
  };
}

type Status = { kind: "ok" | "err"; text: string } | null;

function StatusLine({ status }: { status: Status }) {
  if (!status) return null;
  return (
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
  );
}

// ---------------------------------------------------------------------------

export function AdminPanel() {
  const [password, setPassword] = useState("");

  // Pricing
  const [draft, setDraft] = useState<Draft>(() => toDraft(EDITABLE_DEFAULTS));
  const [pricingStatus, setPricingStatus] = useState<Status>(null);
  const [savingPricing, setSavingPricing] = useState(false);

  // Welcome email
  const [welcome, setWelcome] = useState<WelcomeConfig | null>(null);
  const [welcomeStatus, setWelcomeStatus] = useState<Status>(null);
  const [savingWelcome, setSavingWelcome] = useState(false);
  const [uploadPct, setUploadPct] = useState<number | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    void Promise.all([fetchPricingOverrides(), fetchWelcomeConfig()]).then(
      ([pricing, wel]) => {
        if (cancelled) return;
        if (pricing) setDraft(toDraft({ ...EDITABLE_DEFAULTS, ...pricing }));
        if (wel) setWelcome(wel);
        setLoading(false);
      },
    );
    return () => {
      cancelled = true;
    };
  }, []);

  const setD = (k: keyof Draft) => (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setDraft((d) => ({ ...d, [k]: val }));
    setPricingStatus(null);
  };
  const setW = (patch: Partial<WelcomeConfig>) => {
    setWelcome((w) => (w ? { ...w, ...patch } : w));
    setWelcomeStatus(null);
  };

  const termHint = useMemo(() => {
    const f = Number(draft.financeTermFortnights);
    if (!Number.isFinite(f) || f <= 0) return "In fortnights.";
    const weeks = f * 2;
    return `In fortnights — ${f} = ${weeks} weeks (~${Math.round((weeks / 52) * 12)} months).`;
  }, [draft.financeTermFortnights]);

  const requirePassword = (setStatus: (s: Status) => void): boolean => {
    if (!password.trim()) {
      setStatus({ kind: "err", text: "Enter the admin password (top of page)." });
      return false;
    }
    return true;
  };

  const onSavePricing = async () => {
    setPricingStatus(null);
    if (!requirePassword(setPricingStatus)) return;
    const parsed = fromDraft(draft);
    if ("error" in parsed) {
      setPricingStatus({ kind: "err", text: parsed.error });
      return;
    }
    setSavingPricing(true);
    const res = await savePricingConfig(parsed.config, password);
    setSavingPricing(false);
    setPricingStatus(
      res.success
        ? { kind: "ok", text: "Pricing saved. Applies on the next calculator load." }
        : { kind: "err", text: res.error || "Save failed." },
    );
  };

  const onPickPdf = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setWelcomeStatus(null);
    if (file.type !== "application/pdf") {
      setWelcomeStatus({ kind: "err", text: "Please choose a PDF file." });
      return;
    }
    setUploadPct(0);
    try {
      const { url, filename } = await uploadWelcomePack(file, (p) =>
        setUploadPct(p.percent),
      );
      setW({ pdfUrl: url, pdfFilename: filename });
      setWelcomeStatus({
        kind: "ok",
        text: `Uploaded "${filename}". Click Save welcome email to apply it.`,
      });
    } catch (err) {
      setWelcomeStatus({
        kind: "err",
        text: `Upload failed: ${err instanceof Error ? err.message : String(err)}`,
      });
    } finally {
      setUploadPct(null);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const onSaveWelcome = async () => {
    setWelcomeStatus(null);
    if (!welcome) return;
    if (!requirePassword(setWelcomeStatus)) return;
    if (!welcome.subject.trim() || !welcome.body.trim()) {
      setWelcomeStatus({ kind: "err", text: "Subject and body can't be empty." });
      return;
    }
    setSavingWelcome(true);
    const res = await saveWelcomeConfig(welcome, password);
    setSavingWelcome(false);
    setWelcomeStatus(
      res.success
        ? { kind: "ok", text: "Welcome email saved. Applies to the next lead." }
        : { kind: "err", text: res.error || "Save failed." },
    );
  };

  const box: React.CSSProperties = { maxWidth: 680, margin: "0 auto", padding: "32px 20px 80px" };
  const sectionTitle: React.CSSProperties = {
    fontSize: 14,
    textTransform: "uppercase",
    letterSpacing: "0.06em",
    opacity: 0.6,
    margin: "36px 0 8px",
  };
  const numField = {
    type: "number" as const,
    inputMode: "decimal" as const,
    step: "1",
    min: "0",
  };

  if (loading) {
    return (
      <div style={box}>
        <h1 style={{ fontSize: 24 }}>Smooth Concrete — Admin</h1>
        <p style={{ opacity: 0.7 }}>Loading current settings…</p>
      </div>
    );
  }

  return (
    <div style={box}>
      <h1 style={{ fontSize: 24, marginBottom: 4 }}>Smooth Concrete — Admin</h1>
      <p className="form-hint" style={{ marginTop: 0 }}>
        Update pricing and the welcome email. Changes take effect on the next
        calculator load / next lead — no redeploy.
      </p>

      <Field
        label="Admin password (required to save)"
        name="password"
        type="password"
        value={password}
        onChange={(e) => {
          setPassword(e.target.value);
          setPricingStatus(null);
          setWelcomeStatus(null);
        }}
        autoComplete="current-password"
      />

      {/* ---- Pricing ---- */}
      <div style={sectionTitle}>Finance</div>
      <Field label="Finance fee (%)" name="financeFeePercent" {...numField} step="0.1"
        value={draft.financeFeePercent} onChange={setD("financeFeePercent")}
        hint="Flat merchant fee added to every quote. 15 = 15%." />
      <Field label="Repayment term (fortnights)" name="financeTermFortnights" {...numField}
        value={draft.financeTermFortnights} onChange={setD("financeTermFortnights")} hint={termHint} />
      <Field label="Minimum project price ($)" name="minimumProjectPrice" {...numField} step="100"
        value={draft.minimumProjectPrice} onChange={setD("minimumProjectPrice")}
        hint="Ex-GST, ex-finance floor applied to small jobs." />

      <div style={sectionTitle}>Base rates ($ per m²)</div>
      <Field label="Natural grey" name="natural_grey" {...numField}
        value={draft.natural_grey} onChange={setD("natural_grey")} />
      <Field label="Coloured" name="coloured" {...numField}
        value={draft.coloured} onChange={setD("coloured")} />
      <Field label="Pavilion finish" name="pavilion_finish" {...numField}
        value={draft.pavilion_finish} onChange={setD("pavilion_finish")} />
      <Field label="Exposed aggregate — under 60m²" name="ea_0_60" {...numField}
        value={draft.ea_0_60} onChange={setD("ea_0_60")} />
      <Field label="Exposed aggregate — 60 to 100m²" name="ea_60_100" {...numField}
        value={draft.ea_60_100} onChange={setD("ea_60_100")} />
      <Field label="Exposed aggregate — 100m² and over" name="ea_100_plus" {...numField}
        value={draft.ea_100_plus} onChange={setD("ea_100_plus")} />

      <StatusLine status={pricingStatus} />
      <button type="button" className="btn btn-primary" onClick={onSavePricing}
        disabled={savingPricing} style={{ width: "100%", marginTop: 4 }}>
        {savingPricing ? "Saving…" : "Save pricing"}
      </button>

      {/* ---- Welcome email ---- */}
      {welcome && (
        <>
          <div style={sectionTitle}>Welcome email</div>
          <Field label="Subject" name="subject" type="text"
            value={welcome.subject} onChange={(e) => setW({ subject: e.target.value })} />
          <TextAreaField
            label="Body"
            name="body"
            rows={16}
            value={welcome.body}
            onChange={(e) => setW({ body: e.target.value })}
            hint="Use {{firstName}} for the customer's first name and {{phone}} for your phone number. Leave a blank line between paragraphs."
          />

          <div className="field-group">
            <label>Welcome-pack PDF</label>
            <p className="form-hint" style={{ margin: "0 0 8px" }}>
              {welcome.pdfFilename
                ? `Current: ${welcome.pdfFilename}`
                : "Current: default welcome pack (Smooth_Concrete_Welcome_Pack.pdf)"}
              {welcome.pdfUrl && (
                <>
                  {" — "}
                  <a href={welcome.pdfUrl} target="_blank" rel="noopener noreferrer">
                    view
                  </a>
                </>
              )}
            </p>
            <input
              ref={fileRef}
              type="file"
              accept="application/pdf"
              onChange={onPickPdf}
              disabled={uploadPct !== null}
            />
            {uploadPct !== null && (
              <p className="form-hint">Uploading… {uploadPct}%</p>
            )}
          </div>

          <StatusLine status={welcomeStatus} />
          <button type="button" className="btn btn-primary" onClick={onSaveWelcome}
            disabled={savingWelcome || uploadPct !== null} style={{ width: "100%", marginTop: 4 }}>
            {savingWelcome ? "Saving…" : "Save welcome email"}
          </button>
        </>
      )}
    </div>
  );
}
