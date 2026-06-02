/**
 * Upload DIRECT navigateur → Cloudinary.
 *
 * Les photos sont compressées côté navigateur avant envoi (max 1 400 px,
 * JPEG 82 %) pour réduire la taille de 70–90 % sur les clichés mobiles.
 * Les gros fichiers audio sont envoyés en morceaux (chunked upload).
 */

export interface CloudinarySignature {
  cloud_name: string;
  api_key: string;
  timestamp: number;
  signature: string;
  folder: string;
  resource_type: "image" | "video";
}

export interface CloudinaryUploadResult {
  public_id: string;
  secure_url: string;
  bytes?: number;
  duration?: number;
}

const CHUNK_SIZE = 20 * 1024 * 1024; // 20 Mo
const PHOTO_MAX_PX = 1400;           // largeur / hauteur max après compression
const PHOTO_QUALITY = 0.82;          // qualité JPEG (0–1)

/** Compresse une image via Canvas → Blob JPEG. */
export async function compressImage(file: File): Promise<Blob> {
  return new Promise((resolve) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      const ratio = Math.min(PHOTO_MAX_PX / img.width, PHOTO_MAX_PX / img.height, 1);
      const w = Math.round(img.width * ratio);
      const h = Math.round(img.height * ratio);
      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      canvas.getContext("2d")!.drawImage(img, 0, 0, w, h);
      canvas.toBlob(
        (blob) => resolve(blob ?? file),
        "image/jpeg",
        PHOTO_QUALITY,
      );
    };
    img.onerror = () => { URL.revokeObjectURL(url); resolve(file); };
    img.src = url;
  });
}

function uploadEndpoint(sign: CloudinarySignature): string {
  return `https://api.cloudinary.com/v1_1/${sign.cloud_name}/${sign.resource_type}/upload`;
}

function buildForm(sign: CloudinarySignature, chunk: Blob): FormData {
  const form = new FormData();
  form.append("api_key", sign.api_key);
  form.append("timestamp", String(sign.timestamp));
  form.append("signature", sign.signature);
  form.append("folder", sign.folder);
  form.append("file", chunk);
  return form;
}

function randomId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function putChunk(
  sign: CloudinarySignature,
  chunk: Blob,
  uploadId: string | null,
  range: { start: number; end: number; total: number } | null,
  onChunkProgress: (loaded: number) => void,
): Promise<CloudinaryUploadResult | null> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", uploadEndpoint(sign), true);
    if (uploadId) xhr.setRequestHeader("X-Unique-Upload-Id", uploadId);
    if (range) {
      xhr.setRequestHeader(
        "Content-Range",
        `bytes ${range.start}-${range.end - 1}/${range.total}`,
      );
    }
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onChunkProgress(e.loaded);
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        if (!xhr.responseText) return resolve(null);
        try {
          const json = JSON.parse(xhr.responseText);
          if (json.error) {
            reject(new Error(`Cloudinary : ${json.error.message ?? JSON.stringify(json.error)}`));
            return;
          }
          resolve({
            public_id: json.public_id,
            secure_url: json.secure_url,
            bytes: json.bytes,
            duration: json.duration,
          });
        } catch {
          resolve(null);
        }
      } else {
        let detail = xhr.responseText;
        try { detail = JSON.parse(xhr.responseText)?.error?.message ?? detail; } catch { /* ignore */ }
        reject(new Error(`Cloudinary ${xhr.status} : ${detail}`));
      }
    };
    xhr.onerror = () => reject(new Error("Échec réseau lors de l'upload vers Cloudinary"));
    xhr.ontimeout = () => reject(new Error("Délai dépassé lors de l'upload vers Cloudinary"));
    xhr.timeout = 120_000; // 2 min max par chunk
    xhr.send(buildForm(sign, chunk));
  });
}

export async function uploadToCloudinary(
  file: File | Blob,
  sign: CloudinarySignature,
  onProgress?: (fraction: number) => void,
): Promise<CloudinaryUploadResult> {
  const total = file.size;

  if (total <= CHUNK_SIZE) {
    const result = await putChunk(sign, file, null, null, (loaded) => {
      onProgress?.(total ? loaded / total : 0);
    });
    if (!result) throw new Error("Réponse Cloudinary vide — réessayez");
    onProgress?.(1);
    return result;
  }

  const uploadId = randomId();
  let uploaded = 0;
  let final: CloudinaryUploadResult | null = null;
  for (let start = 0; start < total; start += CHUNK_SIZE) {
    const end = Math.min(start + CHUNK_SIZE, total);
    const chunk = file.slice(start, end);
    // eslint-disable-next-line no-await-in-loop
    final = await putChunk(
      sign,
      chunk,
      uploadId,
      { start, end, total },
      (loaded) => onProgress?.((uploaded + loaded) / total),
    );
    uploaded = end;
  }
  if (!final) throw new Error("Upload chunké incomplet — réessayez");
  onProgress?.(1);
  return final;
}
