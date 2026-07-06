/**
 * Client wrappers around /api/pricing-config.
 *
 * The calculator calls `fetchPricingOverrides()` on load; the admin page calls
 * both (fetch to prefill, save to persist).
 */

import type { EditablePricing } from "@/config/editablePricing";

/** Read the stored overrides. Returns null on any failure → caller uses defaults. */
export async function fetchPricingOverrides(): Promise<EditablePricing | null> {
  try {
    const res = await fetch("/api/pricing-config", { cache: "no-store" });
    if (!res.ok) return null;
    const data = (await res.json()) as { overrides?: EditablePricing | null };
    return data?.overrides ?? null;
  } catch {
    return null;
  }
}

export interface SaveResult {
  success: boolean;
  error?: string;
}

/** Persist new overrides. Requires the admin password. */
export async function savePricingConfig(
  config: EditablePricing,
  password: string,
): Promise<SaveResult> {
  try {
    const res = await fetch("/api/pricing-config", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ config, password }),
    });
    const data = (await res.json().catch(() => ({}))) as SaveResult;
    if (!res.ok || !data.success) {
      return { success: false, error: data.error ?? `HTTP ${res.status}` };
    }
    return { success: true };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}
