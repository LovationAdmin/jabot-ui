import { Person, Relationship } from "./types";

// Palette hsl — chaque composante connexe reçoit une couleur unique.
const PALETTE = [
  { border: "hsl(44, 70%, 55%)",   bg: "hsl(44, 55%, 97%)",   accent: "hsl(44, 68%, 45%)"   }, // ambre
  { border: "hsl(232, 65%, 50%)",  bg: "hsl(232, 55%, 97%)",  accent: "hsl(232, 65%, 40%)"  }, // bleu
  { border: "hsl(152, 58%, 48%)",  bg: "hsl(152, 50%, 97%)",  accent: "hsl(152, 58%, 40%)"  }, // vert
  { border: "hsl(292, 55%, 48%)",  bg: "hsl(292, 48%, 97%)",  accent: "hsl(292, 55%, 40%)"  }, // violet
  { border: "hsl(8,   68%, 52%)",  bg: "hsl(8,   65%, 97%)",  accent: "hsl(8,   68%, 42%)"  }, // rose
  { border: "hsl(187, 58%, 46%)",  bg: "hsl(187, 52%, 97%)",  accent: "hsl(187, 58%, 38%)"  }, // teal
  { border: "hsl(72,  68%, 52%)",  bg: "hsl(72,  58%, 97%)",  accent: "hsl(72,  68%, 43%)"  }, // lime
  { border: "hsl(24,  58%, 50%)",  bg: "hsl(24,  48%, 97%)",  accent: "hsl(24,  58%, 40%)"  }, // orange
];

export type FamilyColor = (typeof PALETTE)[number];

/**
 * Applique une opacité à une couleur hsl.
 * hsl(44, 70%, 55%) → hsla(44, 70%, 55%, 0.5)
 */
export function alpha(color: string, a: number): string {
  const m = color.match(/^hsl\(([^)]+)\)$/);
  if (m) return `hsla(${m[1]}, ${a})`;
  // Already hsla — replace the alpha value
  const ma = color.match(/^hsla\(([^,]+,[^,]+,[^,]+),\s*[\d.]+\)$/);
  if (ma) return `hsla(${ma[1]}, ${a})`;
  return color;
}

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

  const compSize = new Map<string, number>();
  for (const p of persons) {
    const root = compMap.get(p.id)!;
    compSize.set(root, (compSize.get(root) ?? 0) + 1);
  }

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
