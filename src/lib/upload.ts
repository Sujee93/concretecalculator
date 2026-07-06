/**
 * Client wrapper around @vercel/blob/client `upload`.
 *
 * Returns an UploadedFile suitable for the form store. Throws a friendly
 * error message if the upload endpoint returns one (e.g. missing token in
 * dev, oversize file, disallowed content-type).
 */

import { upload as blobUpload } from "@vercel/blob/client";
import type { UploadedFile } from "@/types/form";

export interface UploadProgress {
  /** 0–100 */
  percent: number;
}

const today = () => {
  const d = new Date();
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
};

/**
 * Upload the admin welcome-pack PDF straight to Blob (bypasses the 4.5 MB
 * function cap). Stored under a stable `config/` prefix, not the dated inquiry
 * tree. Returns the public URL + filename to persist in the welcome config.
 */
export async function uploadWelcomePack(
  file: File,
  onProgress?: (p: UploadProgress) => void,
): Promise<{ url: string; filename: string }> {
  const result = await blobUpload(`config/welcome-pack/${file.name}`, file, {
    access: "public",
    handleUploadUrl: "/api/upload-url",
    onUploadProgress: (e) =>
      onProgress?.({ percent: Math.round((e.loaded / e.total) * 100) }),
  });
  return { url: result.url, filename: file.name };
}

export async function uploadFile(
  file: File,
  options: {
    /** Subfolder under `inquiries/{date}/` — typically "plans" or "photos". */
    kind: "plans" | "photos";
    onProgress?: (p: UploadProgress) => void;
  },
): Promise<UploadedFile> {
  const pathname = `inquiries/${today()}/${options.kind}/${file.name}`;
  try {
    const result = await blobUpload(pathname, file, {
      access: "public",
      handleUploadUrl: "/api/upload-url",
      onUploadProgress: (e) =>
        options.onProgress?.({
          percent: Math.round((e.loaded / e.total) * 100),
        }),
    });
    return {
      url: result.url,
      filename: file.name,
      contentType: file.type,
      size: file.size,
    };
  } catch (err) {
    // Local dev without Vercel Blob configured: /api/upload-url returns 503
    // and the blob client throws "Failed to retrieve the client token". Rather
    // than block the whole flow during local testing, fall back to an in-browser
    // object URL so the form is still exercisable end-to-end. In production
    // (where BLOB_READ_WRITE_TOKEN is set) the upload succeeds and we never get
    // here; if it genuinely fails in prod we surface the error.
    if (import.meta.env.DEV) {
      console.warn(
        "[upload] Vercel Blob not available — using a local preview URL. " +
          "Configure BLOB_READ_WRITE_TOKEN (vercel env pull) for real uploads.",
        err,
      );
      options.onProgress?.({ percent: 100 });
      return {
        url: URL.createObjectURL(file),
        filename: file.name,
        contentType: file.type,
        size: file.size,
      };
    }
    throw err;
  }
}
