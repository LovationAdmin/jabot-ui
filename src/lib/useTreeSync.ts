import { useEffect, useRef } from "react";
import { wsBaseUrl } from "./config";

/**
 * Synchronisation temps réel de l'arbre via WebSocket.
 *
 * Se connecte à /ws/tree (authentifié par JWT en query param) et appelle
 * `onRemoteChange` quand un AUTRE utilisateur modifie l'arbre — le client
 * recharge alors sa vue, ce qui évite les états divergents et les écrasements
 * concurrents. Les événements émis par soi-même (origin === userId) sont
 * ignorés car l'état local est déjà à jour.
 *
 * Robustesse : reconnexion automatique avec backoff exponentiel, ping/pong
 * applicatif pour garder la connexion vivante derrière les proxys.
 */

export function useTreeSync(
  enabled: boolean,
  userId: string | undefined,
  onRemoteChange: () => void,
) {
  // Garde la dernière callback sans relancer l'effet à chaque rendu.
  const cbRef = useRef(onRemoteChange);
  cbRef.current = onRemoteChange;

  useEffect(() => {
    if (!enabled) return;
    const token = typeof window !== "undefined" ? localStorage.getItem("jabot_token") : null;
    if (!token) return;

    let ws: WebSocket | null = null;
    let pingTimer: ReturnType<typeof setInterval> | null = null;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    let attempts = 0;
    let closed = false;

    // Coalesce : si plusieurs événements arrivent rapprochés, on ne recharge
    // qu'une fois (l'arbre entier est rechargé, inutile de le faire 10×).
    let reloadTimer: ReturnType<typeof setTimeout> | null = null;
    const scheduleReload = () => {
      if (reloadTimer) return;
      reloadTimer = setTimeout(() => {
        reloadTimer = null;
        cbRef.current();
      }, 400);
    };

    const connect = () => {
      if (closed) return;
      ws = new WebSocket(`${wsBaseUrl()}?token=${encodeURIComponent(token)}`);

      ws.onopen = () => {
        attempts = 0;
        // Ping applicatif toutes les 25 s.
        pingTimer = setInterval(() => {
          if (ws?.readyState === WebSocket.OPEN) ws.send("ping");
        }, 25000);
      };

      ws.onmessage = (event) => {
        if (event.data === "pong") return;
        try {
          const msg = JSON.parse(event.data);
          // Ignore ses propres mutations : l'état local est déjà à jour.
          if (msg.origin && userId && msg.origin === userId) return;
          scheduleReload();
        } catch {
          /* message non-JSON ignoré */
        }
      };

      ws.onclose = () => {
        if (pingTimer) { clearInterval(pingTimer); pingTimer = null; }
        if (closed) return;
        // Backoff exponentiel plafonné à 30 s.
        const delay = Math.min(1000 * 2 ** attempts, 30000);
        attempts += 1;
        reconnectTimer = setTimeout(connect, delay);
      };

      ws.onerror = () => {
        ws?.close();
      };
    };

    connect();

    return () => {
      closed = true;
      if (pingTimer) clearInterval(pingTimer);
      if (reconnectTimer) clearTimeout(reconnectTimer);
      if (reloadTimer) clearTimeout(reloadTimer);
      ws?.close();
    };
  }, [enabled, userId]);
}
