/**
 * Enregistrement audio optimisé pour la VOIX et les longues durées (jusqu'à 45 min).
 *
 * Choix techniques :
 * - Débit ~32 kbps mono : largement suffisant pour la voix → 45 min ≈ 11 Mo
 *   (contre ~120 Mo en réglages par défaut). Moins de mémoire, upload plus rapide.
 * - Contraintes micro : mono + annulation d'écho + réduction de bruit.
 * - `start(timeslice)` : les données sont émises périodiquement plutôt qu'en un
 *   seul bloc final. Sur Safari mobile, cela évite de perdre un long
 *   enregistrement et lisse l'empreinte mémoire.
 * - Codec : Safari iOS ne supporte que `audio/mp4` (AAC) ; Chrome/Firefox
 *   préfèrent `audio/webm;codecs=opus`. On choisit le premier supporté.
 */

const CANDIDATES: Array<{ mime: string; ext: string }> = [
  { mime: "audio/webm;codecs=opus", ext: "webm" },
  { mime: "audio/ogg;codecs=opus", ext: "ogg" },
  { mime: "audio/mp4", ext: "mp4" }, // Safari iOS
  { mime: "audio/webm", ext: "webm" },
];

const VOICE_BITRATE = 32000; // 32 kbps mono

export interface VoiceRecorder {
  stop: () => void;
  readonly mimeType: string;
}

export function pickMimeType(): { mime: string; ext: string } {
  if (typeof MediaRecorder === "undefined") return { mime: "", ext: "audio" };
  return CANDIDATES.find((c) => MediaRecorder.isTypeSupported(c.mime)) ?? { mime: "", ext: "audio" };
}

/**
 * Démarre l'enregistrement. `onComplete` reçoit le fichier final prêt à uploader.
 * Retourne un contrôleur avec `stop()`. Lève si le micro est inaccessible.
 */
export async function startVoiceRecording(
  onComplete: (file: File) => void,
  onError?: (err: unknown) => void,
): Promise<VoiceRecorder> {
  const stream = await navigator.mediaDevices.getUserMedia({
    audio: {
      channelCount: 1,
      echoCancellation: true,
      noiseSuppression: true,
    },
  });

  const chosen = pickMimeType();
  const options: MediaRecorderOptions = { audioBitsPerSecond: VOICE_BITRATE };
  if (chosen.mime) options.mimeType = chosen.mime;

  let recorder: MediaRecorder;
  try {
    recorder = new MediaRecorder(stream, options);
  } catch {
    // Certains navigateurs refusent les options : on retombe sur les défauts.
    recorder = new MediaRecorder(stream);
  }

  const actualMime = recorder.mimeType || chosen.mime || "audio/mp4";
  const ext = actualMime.startsWith("audio/webm") ? "webm"
    : actualMime.startsWith("audio/ogg") ? "ogg"
    : actualMime.startsWith("audio/mp4") ? "mp4"
    : chosen.ext;

  const chunks: Blob[] = [];
  recorder.ondataavailable = (e) => { if (e.data.size > 0) chunks.push(e.data); };
  recorder.onerror = (e) => onError?.(e);
  recorder.onstop = () => {
    stream.getTracks().forEach((t) => t.stop());
    const blob = new Blob(chunks, { type: actualMime });
    const file = new File([blob], `vocal-${Date.now()}.${ext}`, { type: actualMime.split(";")[0] });
    onComplete(file);
  };

  // Flush toutes les 5 s : robustesse sur longues durées / mobile.
  recorder.start(5000);

  return {
    stop: () => { if (recorder.state !== "inactive") recorder.stop(); },
    get mimeType() { return actualMime; },
  };
}
