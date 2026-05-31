import { Person, Relationship } from "./types";

// Palette de couleurs distinctes pour les familles (teintes oklch)
// Chaque composante connexe (arbre familial) reçoit une couleur unique.
// Quand deux arbres fusionnent via un lien, ils partagent automatiquement
// la même couleur (Union-Find recalcule à chaque rendu).
const PALETTE = [
  { border: "oklch(0.65 0.18 55)",  bg: "oklch(0.97 0.04 55)",  accent: "oklch(0.55 0.18 55)"  }, // ambre (défaut)
  { border: "oklch(0.60 0.20 250)", bg: "oklch(0.97 0.04 250)", accent: "oklch(0.50 0.20 250)" }, // bleu
  { border: "oklch(0.62 0.18 160)", bg: "oklch(0.97 0.04 160)", accent: "oklch(0.52 0.18 160)" }, // vert
  { border: "oklch(0.60 0.20 310)", bg: "oklch(0.97 0.04 310)", accent: "oklch(0.50 0.20 310)" }, // violet
  { border: "oklch(0.62 0.22 20)",  bg: "oklch(0.97 0.05 20)",  accent: "oklch(0.52 0.22 20)"  }, // rose
  { border: "oklch(0.62 0.18 195)", bg: "oklch(0.97 0.04 195)", accent: "oklch(0.52 0.18 195)" }, // teal
  { border: "oklch(0.65 0.20 75)",  bg: "oklch(0.97 0.04 75)",  accent: "oklch(0.55 0.20 75)"  }, // lime
  { border: "oklch(0.60 0.15 30)",  bg: "oklch(0.97 0.03 30)",  accent: "oklch(0.50 0.15 30)"  }, // orange
];

export type FamilyColor = (typeof PALETTE)[number];

/** Union-Find simple pour calculer les composantes connexes. */
function buildComponentMap(persons: Person[], relationships: Relationship[]): Map<string, string> {
  const parent = new Map<string, string>();

  function find(x: string): string {
    if (parent.get(x) !== x) parent.set(x, find(parent.get(x)!));
    return parent.get(x)!;
  }

  function union(a: string, b: string) {
    const ra = find(a), rb = find(b);
    if (ra !== rb) parent.set(ra, rb);
  }

  for (const p of persons) parent.set(p.id, p.id);

  for (const r of relationships) {
    if (parent.has(r.personAId) && parent.has(r.personBId)) {
      union(r.personAId, r.personBId);
    }
  }

  // Normalise: root de chaque nœud
  for (const p of persons) find(p.id);
  return parent;
}

/**
 * Retourne une Map personId → FamilyColor.
 * Les composantes sont triées par taille décroissante : la plus grande
 * famille reçoit toujours la couleur ambre (index 0).
 */
export function computeFamilyColors(
  persons: Person[],
  relationships: Relationship[],
): Map<string, FamilyColor> {
  if (persons.length === 0) return new Map();

  const compMap = buildComponentMap(persons, relationships);

  // Compte la taille de chaque composante (par racine)
  const compSize = new Map<string, number>();
  for (const p of persons) {
    const root = compMap.get(p.id)!;
    compSize.set(root, (compSize.get(root) ?? 0) + 1);
  }

  // Trie les composantes par taille décroissante → les plus grandes ont les
  // premières couleurs de la palette
  const roots = [...compSize.entries()].sort((a, b) => b[1] - a[1]).map(([r]) => r);
  const rootColor = new Map<string, FamilyColor>();
  roots.forEach((root, i) => rootColor.set(root, PALETTE[i % PALETTE.length]));

  const result = new Map<string, FamilyColor>();
  for (const p of persons) {
    const root = compMap.get(p.id)!;
    result.set(p.id, rootColor.get(root)!);
  }
  return result;
}
