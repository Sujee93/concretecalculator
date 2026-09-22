/**
 * Local-disk JSON config storage — replaces the Vercel Blob-backed
 * `list`/`put` calls the original api/pricing-config.ts and
 * api/welcome-config.ts used.
 *
 * Files live under DATA_DIR/config/*.json (DATA_DIR defaults to ./data,
 * override with the DATA_DIR env var to point at a persistent volume on
 * whatever host is running this). Writes are atomic (write to a temp file,
 * then rename) so a crash mid-write can't corrupt the config file.
 */

import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";

const DATA_DIR = process.env.DATA_DIR
  ? path.resolve(process.env.DATA_DIR)
  : path.resolve(process.cwd(), "data");

export const CONFIG_DIR = path.join(DATA_DIR, "config");
export const UPLOADS_DIR = path.join(DATA_DIR, "uploads");

/** Reads and JSON.parses a config file. Returns null if missing or malformed. */
export async function readJsonConfig<T>(filename: string): Promise<T | null> {
  try {
    const raw = await readFile(path.join(CONFIG_DIR, filename), "utf8");
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

/** Persists a config file atomically, creating the directory if needed. */
export async function writeJsonConfig(
  filename: string,
  data: unknown,
): Promise<void> {
  await mkdir(CONFIG_DIR, { recursive: true });
  const target = path.join(CONFIG_DIR, filename);
  const tmp = `${target}.${process.pid}.tmp`;
  await writeFile(tmp, JSON.stringify(data, null, 2), "utf8");
  await rename(tmp, target);
}
