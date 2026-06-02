/**
 * Configuration runtime du frontend.
 *
 * `VITE_API_URL` est injecté par Vite AU MOMENT DU BUILD (inliné dans le bundle).
 * S'il manque sur la plateforme de déploiement (Vercel), on NE doit SURTOUT PAS
 * retomber sur localhost en production : tous les appels API échoueraient chez
 * chaque visiteur. On choisit donc un défaut selon l'environnement d'exécution.
 */

const PROD_API_BASE = "https://api.jabotai.com/api";
const LOCAL_API_BASE = "http://localhost:8000/api";

function isLocalHost(): boolean {
  if (typeof window === "undefined") return false;
  return /^(localhost|127\.0\.0\.1|0\.0\.0\.0)$/.test(window.location.hostname);
}

/** Base de l'API REST (ex : https://api.jabotai.com/api). */
export function apiBaseUrl(): string {
  const fromEnv = import.meta.env.VITE_API_URL;
  if (fromEnv) return fromEnv;
  // Aucune variable bakée dans le bundle : défaut sûr selon le contexte.
  return isLocalHost() ? LOCAL_API_BASE : PROD_API_BASE;
}

/** URL WebSocket de synchro de l'arbre (http→ws, https→wss, /api → /ws/tree). */
export function wsBaseUrl(): string {
  const root = apiBaseUrl().replace(/\/api\/?$/, "");
  return root.replace(/^http/, "ws") + "/ws/tree";
}
