/**
 * POST /api/upload — multipart file upload endpoint (replaces the old
 * Vercel Blob client-direct-upload flow). The client sends the file plus a
 * `kind` field ("plans" | "photos" | "welcome-pack") as multipart/form-data;
 * the file is written to local disk and served back out under /uploads/...
 *
 * Returns { url, filename, contentType, size } — matches the client's
 * UploadedFile shape.
 */

import type { Request, Response } from "express";
import {
  saveUpload,
  UploadValidationError,
  type UploadKind,
} from "../lib/uploads.js";

const VALID_KINDS: UploadKind[] = ["plans", "photos", "welcome-pack"];

function originOf(req: Request): string {
  const proto =
    (req.headers["x-forwarded-proto"] as string | undefined)?.split(",")[0] ||
    req.protocol ||
    "https";
  return `${proto}://${req.headers.host}`;
}

export async function uploadHandler(req: Request, res: Response): Promise<void> {
  const file = req.file;
  if (!file) {
    res.status(400).json({ error: "No file provided." });
    return;
  }

  const kind = req.body?.kind;
  if (typeof kind !== "string" || !VALID_KINDS.includes(kind as UploadKind)) {
    res.status(400).json({ error: `Invalid kind: ${String(kind)}` });
    return;
  }

  try {
    const saved = await saveUpload(file, kind as UploadKind, originOf(req));
    res.status(200).json(saved);
  } catch (err) {
    if (err instanceof UploadValidationError) {
      res.status(400).json({ error: err.message });
      return;
    }
    const message = err instanceof Error ? err.message : String(err);
    console.error("upload error:", message);
    res.status(500).json({ error: message });
  }
}
