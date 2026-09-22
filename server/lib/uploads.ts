/**
 * Local-disk file uploads — replaces the Vercel Blob client-direct-upload
 * flow (api/upload-url.ts + @vercel/blob/client on the frontend). Files are
 * written straight to DATA_DIR/uploads/... and served back out at /uploads/...
 * by the static middleware in server/index.ts.
 *
 * Validation (size + content-type) mirrors the original upload-url.ts limits.
 */

import { randomBytes } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import multer from "multer";
import { UPLOADS_DIR } from "./storage.js";

export const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB
export const ALLOWED_CONTENT_TYPES = [
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
  "application/pdf",
];

export type UploadKind = "plans" | "photos" | "welcome-pack";

/** multer middleware: single file field named "file", buffered in memory. */
export const uploadMiddleware = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_FILE_SIZE },
}).single("file");

function today(): string {
  const d = new Date();
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
}

function destinationFor(kind: UploadKind): string {
  if (kind === "welcome-pack") return "config/welcome-pack";
  return `inquiries/${today()}/${kind}`;
}

/** Strips path separators and anything that isn't safe in a filename. */
function sanitizeFilename(name: string): string {
  const base = name.replace(/[/\\]/g, "_").trim() || "file";
  return base.slice(-150); // keep it short; avoids absurd path lengths
}

export interface SavedUpload {
  url: string;
  filename: string;
  contentType: string;
  size: number;
}

export class UploadValidationError extends Error {}

/**
 * Validates and persists an in-memory uploaded file, returning the public
 * URL (rooted at `origin`) plus the metadata the client's UploadedFile type
 * expects.
 */
export async function saveUpload(
  file: Express.Multer.File,
  kind: UploadKind,
  origin: string,
): Promise<SavedUpload> {
  if (!ALLOWED_CONTENT_TYPES.includes(file.mimetype)) {
    throw new UploadValidationError(
      `File type ${file.mimetype} is not allowed.`,
    );
  }
  if (file.size > MAX_FILE_SIZE) {
    throw new UploadValidationError("File is larger than the 10 MB limit.");
  }

  const subdir = destinationFor(kind);
  const suffix = randomBytes(4).toString("hex");
  const storedName = `${suffix}-${sanitizeFilename(file.originalname)}`;
  const dir = path.join(UPLOADS_DIR, subdir);
  await mkdir(dir, { recursive: true });
  await writeFile(path.join(dir, storedName), file.buffer);

  return {
    url: `${origin}/uploads/${subdir}/${storedName}`,
    filename: file.originalname,
    contentType: file.mimetype,
    size: file.size,
  };
}
