/**
 * Upload DIRECT navigateur → Cloudinary.
 *
 * Le backend signe la requête (POST /media/sign) puis le fichier est envoyé
 * directement à Cloudinary, sans transiter par le serveur. Avantages :
 * - pas de limite de taille/timeout de requête côté backend (un vocal de 45 min
 *   peut peser des dizaines de Mo) ;
 * - le worker unique n'est jamais bloqué par le transfert ;
 * - bande passante divisée par deux (un seul saut réseau pour les octets).
 *
 * Les gros fichiers sont envoyés en MORCEAUX (protocole chunké Cloudinary :
 * en-tête Content-Range + X-Unique-Upload-Id), ce qui évite de tout garder en
 * mémoire et permet une barre de progression fiable sur mobile.
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

const CHUNK_SIZE = 20 * 1024 * 1024; // 20 Mo par morceau

function uploadEndpoint(sign: CloudinarySignature): string {
  return `https://api.cloudinary.com/v1_1/${sign.cloud_name}/${sign.resource_type}/upload`;
}

function buildForm(sign: CloudinarySignature, chunk: Blob): FormData {
  const form = new FormData();
  // L'ordre n'importe pas ; ces champs DOIVENT correspondre à ce qui a été signé
  // côté serveur (folder + timestamp) + api_key + signature.
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

/**
 * Envoie un seul morceau (ou le fichier entier) via XHR pour rapporter la
 * progression. `range` (optionnel) active le mode chunké.
 */
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
        // Réponse vide tant que des morceaux restent à venir.
        if (!xhr.responseText) return resolve(null);
        try {
          const json = JSON.parse(xhr.responseText);
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
        reject(new Error(`Cloudinary ${xhr.status}: ${xhr.responseText}`));
      }
    };
    xhr.onerror = () => reject(new Error("Échec réseau pendant l'upload"));
    xhr.send(buildForm(sign, chunk));
  });
}

/**
 * Téléverse `file` vers Cloudinary. `onProgress` reçoit une valeur 0–1.
 */
export async function uploadToCloudinary(
  file: File | Blob,
  sign: CloudinarySignature,
  onProgress?: (fraction: number) => void,
): Promise<CloudinaryUploadResult> {
  const total = file.size;

  // Petit fichier : un seul envoi.
  if (total <= CHUNK_SIZE) {
    const result = await putChunk(sign, file, null, null, (loaded) => {
      onProgress?.(total ? loaded / total : 0);
    });
    if (!result) throw new Error("Réponse Cloudinary vide");
    onProgress?.(1);
    return result;
  }

  // Gros fichier : envoi chunké séquentiel.
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
  if (!final) throw new Error("Upload chunké incomplet (pas de réponse finale)");
  onProgress?.(1);
  return final;
}
