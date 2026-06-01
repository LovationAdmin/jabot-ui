import { Person } from "./types";

// Distinction des noms de famille sur le canvas.
//
// À la différence de familyColors.ts (qui colore les COMPOSANTES CONNEXES —
// un arbre entier = une couleur), ce module attribue une couleur par NOM DE
// FAMILLE. Sur un grand arbre mêlant plusieurs patronymes, cela permet
// d'identifier d'un coup d'œil à quelle lignée appartient chaque fiche.
//
// Logique de couleur : un DÉGRADÉ suivant l'ordre d'apparition des noms dans
// l'arbre. Le 1er nom rencontré démarre la teinte, et chaque nouveau nom
// avance régulièrement sur le cercle chromatique → progression douce et
// déterministe (indépendante d'un hash aléatoire).

export interface SurnameColor {
  band: string;   // couleur pleine du bandeau (haut de carte)
  soft: string;   // variante claire (légende, fonds)
  text: string;   // couleur de texte lisible sur fond clair
}

/** Normalise un nom pour le regroupement (casse + accents + espaces). */
export function normalizeSurname(name: string | null | undefined): string {
  return (name ?? "")
    .trim()
    .toLocaleLowerCase("fr")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

// Teinte de départ (ambre, cohérent avec la couleur par défaut de l'app).
const HUE_START = 35;

/** Couleur pour une position `index` parmi `total` noms → dégradé sur 360°. */
export function colorForIndex(index: number, total: number): SurnameColor {
  // On répartit les teintes régulièrement sur le cercle. Au-delà de la 1re
  // boucle (beaucoup de noms), on décale légèrement pour éviter les doublons.
  const span = Math.max(total, 1);
  const loop = Math.floor(index / span);
  const hue = (HUE_START + (index % span) * (360 / span) + loop * (360 / (span * 2))) % 360;
  return {
    band: `oklch(0.62 0.19 ${hue})`,
    soft: `oklch(0.95 0.045 ${hue})`,
    text: `oklch(0.45 0.16 ${hue})`,
  };
}

export interface SurnameStat {
  surname: string;       // libellé d'origine (première casse rencontrée)
  normalized: string;
  count: number;
  color: SurnameColor;
}

/**
 * Recense les noms de famille présents, dans l'ORDRE D'APPARITION dans la liste
 * des personnes (= ordre de construction de l'arbre), avec leur effectif et la
 * couleur du dégradé correspondante. Sert à la légende, au filtre et aux cartes.
 */
export function computeSurnameStats(persons: Person[]): SurnameStat[] {
  // Première apparition + comptage, en préservant l'ordre de découverte.
  const order: string[] = [];
  const byNorm = new Map<string, { label: string; count: number }>();
  for (const p of persons) {
    const norm = normalizeSurname(p.lastName);
    if (!norm) continue;
    const entry = byNorm.get(norm);
    if (entry) {
      entry.count++;
    } else {
      byNorm.set(norm, { label: (p.lastName ?? "").trim(), count: 1 });
      order.push(norm);
    }
  }
  const total = order.length;
  return order.map((normalized, i) => {
    const { label, count } = byNorm.get(normalized)!;
    return { surname: label, normalized, count, color: colorForIndex(i, total) };
  });
}

/** Construit la table nom normalisé → couleur à partir des stats. */
export function buildSurnameColorMap(stats: SurnameStat[]): Map<string, SurnameColor> {
  return new Map(stats.map((s) => [s.normalized, s.color]));
}
