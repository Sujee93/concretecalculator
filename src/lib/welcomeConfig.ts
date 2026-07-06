/**
 * Client wrappers around /api/welcome-config (admin welcome-email settings).
 */

export interface WelcomeConfig {
  subject: string;
  body: string;
  pdfUrl: string | null;
  pdfFilename: string | null;
}

/** Read the current welcome settings (always returns a full object — defaults merged). */
export async function fetchWelcomeConfig(): Promise<WelcomeConfig | null> {
  try {
    const res = await fetch("/api/welcome-config", { cache: "no-store" });
    if (!res.ok) return null;
    const data = (await res.json()) as { welcome?: WelcomeConfig };
    return data?.welcome ?? null;
  } catch {
    return null;
  }
}

export interface SaveResult {
  success: boolean;
  error?: string;
}

export async function saveWelcomeConfig(
  config: WelcomeConfig,
  password: string,
): Promise<SaveResult> {
  try {
    const res = await fetch("/api/welcome-config", {
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
