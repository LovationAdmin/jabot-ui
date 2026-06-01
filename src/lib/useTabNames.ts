import { useCallback, useEffect, useState } from "react";

const STORAGE_KEY = "jabot_tree_tab_names";

function load(): Record<string, string> {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "{}");
  } catch {
    return {};
  }
}

function save(map: Record<string, string>) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(map));
  } catch { /* silencieux */ }
}

/**
 * Noms personnalisés des onglets d'arbres, persistés dans localStorage.
 * Clé = composante ID (plus petit person.id de la composante).
 */
export function useTabNames() {
  const [names, setNames] = useState<Record<string, string>>(load);

  // Recharge si un autre onglet du navigateur modifie le storage.
  useEffect(() => {
    const handler = () => setNames(load());
    window.addEventListener("storage", handler);
    return () => window.removeEventListener("storage", handler);
  }, []);

  const rename = useCallback((componentId: string, name: string) => {
    setNames((prev) => {
      const next = { ...prev, [componentId]: name };
      save(next);
      return next;
    });
  }, []);

  const getTabName = useCallback(
    (componentId: string, defaultName: string) =>
      names[componentId]?.trim() || defaultName,
    [names],
  );

  return { getTabName, rename };
}
