/**
 * Client wrapper around POST /api/upload (self-hosted multipart upload).
 *
 * Returns an UploadedFile suitable for the form store. Throws a friendly
 * error message if the upload endpoint returns one (oversize file,
 * disallowed content-type, server error).
 */

import type { UploadedFile } from "@/types/form";

export interface UploadProgress {
  /** 0–100 */
  percent: number;
}

/**
 * POSTs the file as multipart/form-data via XMLHttpRequest (rather than
 * fetch) so upload progress can be reported to the caller.
 */
function postUpload(
  file: File,
  kind: "plans" | "photos" | "welcome-pack",
  onProgress?: (p: UploadProgress) => void,
): Promise<{ url: string; filename: string; contentType: string; size: number }> {
  return new Promise((resolve, reject) => {
    const formData = new FormData();
    formData.append("file", file);
    formData.append("kind", kind);

    const xhr = new XMLHttpRequest();
    xhr.open("POST", "/api/upload");
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) {
        onProgress?.({ percent: Math.round((e.loaded / e.total) * 100) });
      }
    };
    xhr.onload = () => {
      let body: Record<string, unknown> = {};
      try {
        body = xhr.responseText ? JSON.parse(xhr.responseText) : {};
      } catch {
        // fall through to the generic error below
      }
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve(
          body as { url: string; filename: string; contentType: string; size: number },
        );
      } else {
        reject(
          new Error(
            typeof body.error === "string"
              ? body.error
              : `Upload failed (HTTP ${xhr.status})`,
          ),
        );
      }
    };
    xhr.onerror = () => reject(new Error("Upload failed — network error."));
    xhr.send(formData);
  });
}

/**
 * Upload the admin welcome-pack PDF. Returns the public URL + filename to
 * persist in the welcome config.
 */
export async function uploadWelcomePack(
  file: File,
  onProgress?: (p: UploadProgress) => void,
): Promise<{ url: string; filename: string }> {
  const result = await postUpload(file, "welcome-pack", onProgress);
  return { url: result.url, filename: file.name };
}

export async function uploadFile(
  file: File,
  options: {
    /** "plans" or "photos" — mirrors the original inquiries/{date}/{kind} layout. */
    kind: "plans" | "photos";
    onProgress?: (p: UploadProgress) => void;
  },
): Promise<UploadedFile> {
  const result = await postUpload(file, options.kind, options.onProgress);
  return {
    url: result.url,
    filename: file.name,
    contentType: file.type,
    size: file.size,
  };
}
