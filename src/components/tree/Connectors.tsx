import React from "react";
import { Person, Relationship } from "@/lib/types";
import { FamilyColor, alpha } from "@/lib/familyColors";
import { CARD_W, CARD_H } from "./PersonCard";

// Palette de teintes oklch pour les unités FAM — chroma modéré, lisible
// sur fond clair et sombre. 10 teintes régulièrement espacées.
const FAM_HUES = [30, 70, 130, 185, 245, 295, 350, 105, 210, 55];

interface ConnectorsProps {
  persons: Person[];
  relationships: Relationship[];
  width?: number;
  height?: number;
  familyColors?: Map<string, FamilyColor>;
}

function bottom(p: Person) {
  return { x: (p.position?.x ?? 0) + CARD_W / 2, y: (p.position?.y ?? 0) + CARD_H };
}

function top(p: Person) {
  return { x: (p.position?.x ?? 0) + CARD_W / 2, y: p.position?.y ?? 0 };
}

function center(p: Person) {
  return { x: (p.position?.x ?? 0) + CARD_W / 2, y: (p.position?.y ?? 0) + CARD_H / 2 };
}

const DASHED_TYPES = new Set([
  "grandparent", "grandchild", "step_parent", "step_child",
  "uncle_aunt", "nephew_niece", "half_sibling", "step_sibling", "cousin", "homonym",
]);

export function Connectors({ persons, relationships, width = 4000, height = 3000, familyColors }: ConnectorsProps) {
  const map = new Map(persons.map((p) => [p.id, p]));

  // Stroke color for a relationship: use the family color of either endpoint.
  const relStroke = (idA: string, idB: string, a = 0.55): string => {
    const c = familyColors?.get(idA) ?? familyColors?.get(idB);
    return c ? alpha(c.border, a) : `oklch(0.45 0.12 55 / 0.55)`;
  };

  // ── Nœuds FAM (unités familiales) ─────────────────────────────────
  // Plutôt que de tracer une fourche depuis CHAQUE parent (ce qui dédouble
  // les traits pour un couple), on regroupe les enfants sous un point de
  // jonction commun à leur couple parental — le « nœud FAM » de la
  // littérature généalogique (yFiles, GoJS, Topola, GEDCOM). Un parent
  // marié 2× appartient à 2 FAM ; un enfant partagé entre 2 couples est
  // rattaché à son couple principal + un lien secondaire en pointillés.
  const coupleKey = (a: string, b: string) => [a, b].sort().join("|");

  // Couples (paires de conjoints) présents sur le canvas.
  const couples = new Map<string, [string, string]>();
  for (const rel of relationships) {
    if (rel.type !== "spouse") continue;
    if (!map.get(rel.personAId) || !map.get(rel.personBId)) continue;
    couples.set(coupleKey(rel.personAId, rel.personBId), [rel.personAId, rel.personBId]);
  }

  // parentsOf : childId → [parentIds]
  const parentsOf = new Map<string, string[]>();
  const addParent = (child: string, parent: string) => {
    if (!parentsOf.has(child)) parentsOf.set(child, []);
    if (!parentsOf.get(child)!.includes(parent)) parentsOf.get(child)!.push(parent);
  };
  for (const rel of relationships) {
    const a = map.get(rel.personAId);
    const b = map.get(rel.personBId);
    if (!a || !b) continue;
    if (rel.type === "parent") addParent(rel.personBId, rel.personAId);       // a est parent de b
    else if (rel.type === "child") addParent(rel.personAId, rel.personBId);   // a est enfant de b
  }

  // Détermine l'unité familiale (FAM) d'un enfant : un couple si deux de ses
  // parents sont conjoints, sinon le parent principal (seul).
  const familyForChild = (parents: string[]): { key: string; parents: string[] } => {
    for (let i = 0; i < parents.length; i++) {
      for (let j = i + 1; j < parents.length; j++) {
        if (couples.has(coupleKey(parents[i], parents[j]))) {
          return { key: coupleKey(parents[i], parents[j]), parents: [parents[i], parents[j]] };
        }
      }
    }
    return { key: `solo|${parents[0]}`, parents: [parents[0]] };
  };

  interface Family { key: string; parents: string[]; children: string[]; }
  const families = new Map<string, Family>();
  for (const [childId, parents] of parentsOf.entries()) {
    if (parents.length === 0) continue;
    const fam = familyForChild(parents);
    if (!families.has(fam.key)) families.set(fam.key, { key: fam.key, parents: fam.parents, children: [] });
    families.get(fam.key)!.children.push(childId);
  }

  // Couleur par unité FAM — une teinte distincte par couple parental.
  // Trié pour que l'attribution soit déterministe (indépendante de l'ordre
  // d'itération de la Map), donc stable entre re-renders.
  const famColorMap = new Map<string, string>();
  [...families.keys()].sort().forEach((key, i) => {
    const hue = FAM_HUES[i % FAM_HUES.length];
    famColorMap.set(key, `oklch(0.52 0.20 ${hue})`);
  });

  // Aussi indexer les couples conjoints par leur clé pour colorier le lien spouse.
  const coupleColorMap = new Map<string, string>();
  for (const [ck, [a, b]] of couples.entries()) {
    const famKey = coupleKey(a, b);
    const col = famColorMap.get(famKey);
    if (col) coupleColorMap.set(ck, col);
  }

  const paths: React.ReactNode[] = [];

  // Point de jonction du FAM : centré entre les parents, légèrement sous eux.
  const FAM_GAP = 30;
  const junctionOf = (fam: Family): { x: number; y: number } => {
    const pts = (fam.parents.map((id) => map.get(id)).filter(Boolean) as Person[]).map(bottom);
    const x = pts.reduce((s, p) => s + p.x, 0) / pts.length;
    const y = Math.max(...pts.map((p) => p.y)) + FAM_GAP;
    return { x, y };
  };

  for (const fam of families.values()) {
    const parents = fam.parents.map((id) => map.get(id)).filter(Boolean) as Person[];
    const children = fam.children.map((id) => map.get(id)).filter(Boolean) as Person[];
    if (parents.length === 0 || children.length === 0) continue;

    const j = junctionOf(fam);
    const stroke = famColorMap.get(fam.key) ?? relStroke(fam.parents[0], fam.children[0]);

    // Descente de chaque parent vers le point de jonction.
    if (parents.length === 2) {
      for (const p of parents) {
        const pb = bottom(p);
        paths.push(
          <path
            key={`fam-drop-${fam.key}-${p.id}`}
            d={`M ${pb.x} ${pb.y} L ${pb.x} ${j.y} L ${j.x} ${j.y}`}
            stroke={stroke}
            strokeWidth="2"
            fill="none"
          />
        );
      }
      // Petit losange pour matérialiser le nœud FAM (union).
      paths.push(
        <circle key={`fam-dot-${fam.key}`} cx={j.x} cy={j.y} r="3" fill={stroke} />
      );
    } else {
      const pb = bottom(parents[0]);
      paths.push(
        <line
          key={`fam-drop-${fam.key}`}
          x1={pb.x} y1={pb.y} x2={pb.x} y2={j.y}
          stroke={stroke} strokeWidth="2"
        />
      );
    }

    // Fourche depuis la jonction vers les enfants.
    const startX = parents.length === 2 ? j.x : bottom(parents[0]).x;
    if (children.length === 1) {
      const ct = top(children[0]);
      const my = (j.y + ct.y) / 2;
      paths.push(
        <path
          key={`fam-c-${fam.key}-${children[0].id}`}
          d={`M ${startX} ${j.y} C ${startX} ${my}, ${ct.x} ${my}, ${ct.x} ${ct.y}`}
          stroke={stroke}
          strokeWidth="2"
          fill="none"
          markerEnd="url(#arrow-fam)"
        />
      );
    } else {
      const childTops = children.map(top);
      const minX = Math.min(...childTops.map((t) => t.x), startX);
      const maxX = Math.max(...childTops.map((t) => t.x), startX);
      const forkY = childTops[0].y - (childTops[0].y - j.y) * 0.45;

      paths.push(
        <line key={`fam-stem-${fam.key}`} x1={startX} y1={j.y} x2={startX} y2={forkY} stroke={stroke} strokeWidth="2" />,
        <line key={`fam-bar-${fam.key}`} x1={minX} y1={forkY} x2={maxX} y2={forkY} stroke={stroke} strokeWidth="2" />
      );
      for (const child of children) {
        const ct = top(child);
        paths.push(
          <line
            key={`fam-c-${fam.key}-${child.id}`}
            x1={ct.x} y1={forkY} x2={ct.x} y2={ct.y}
            stroke={stroke} strokeWidth="2"
            markerEnd="url(#arrow-fam)"
          />
        );
      }
    }
  }

  // ── Liens parentaux secondaires ───────────────────────────────────
  // Enfant rattaché à un couple mais ayant un autre parent (famille
  // recomposée, enfant partagé entre deux unions) : trait pointillé direct
  // depuis ce parent secondaire vers l'enfant, sans dédoubler le nœud.
  for (const [childId, parents] of parentsOf.entries()) {
    if (parents.length < 2) continue;
    const child = map.get(childId);
    if (!child) continue;
    const primary = new Set(familyForChild(parents).parents);
    for (const pid of parents) {
      if (primary.has(pid)) continue;
      const p = map.get(pid);
      if (!p) continue;
      const pb = bottom(p);
      const ct = top(child);
      const my = (pb.y + ct.y) / 2;
      paths.push(
        <path
          key={`sec-${pid}-${childId}`}
          d={`M ${pb.x} ${pb.y} C ${pb.x} ${my}, ${ct.x} ${my}, ${ct.x} ${ct.y}`}
          stroke={relStroke(pid, childId, 0.45)}
          strokeWidth="1.5"
          strokeDasharray="2 4"
          fill="none"
          markerEnd="url(#arrow-fam)"
        />
      );
    }
  }

  // ── Spouse connectors ─────────────────────────────────────────────
  const drawnSpouse = new Set<string>();

  for (const rel of relationships) {
    if (rel.type !== "spouse") continue;
    const a = map.get(rel.personAId);
    const b = map.get(rel.personBId);
    if (!a || !b) continue;
    const key = [rel.personAId, rel.personBId].sort().join("-");
    if (drawnSpouse.has(key)) continue;
    drawnSpouse.add(key);

    const ca = center(a);
    const cb = center(b);
    const mx = (ca.x + cb.x) / 2;
    // Même teinte que le nœud FAM de ce couple → cohérence visuelle.
    const ck = [rel.personAId, rel.personBId].sort().join("|");
    const famCol = coupleColorMap.get(ck);
    const sc = familyColors?.get(rel.personAId) ?? familyColors?.get(rel.personBId);
    // Variante plus claire du FAM pour le lien conjoint (idem hue, lightness +0.10)
    const spouseStroke = famCol
      ? famCol.replace("oklch(0.52 0.20", "oklch(0.65 0.15")
      : sc ? alpha(sc.accent, 0.6) : "oklch(0.60 0.18 20 / 0.50)";
    paths.push(
      <path
        key={`spouse-${rel.id}`}
        d={`M ${ca.x} ${ca.y} C ${mx} ${ca.y}, ${mx} ${cb.y}, ${cb.x} ${cb.y}`}
        stroke={spouseStroke}
        strokeWidth="1.5"
        strokeDasharray="5 3"
        fill="none"
      />
    );
  }

  // ── Sibling connectors ────────────────────────────────────────────
  // On ne trace QUE la fratrie directe. De plus, si deux frères/sœurs sont
  // déjà reliés via un nœud FAM commun (même couple parental dans l'arbre),
  // la ligne de fratrie est redondante et bruite la lecture — on la supprime.
  // Les liens cousins/homonymes et étendus restent dans la fiche seulement.
  const HORIZONTAL_TYPES = new Set(["sibling", "half_sibling", "step_sibling"]);

  // Paires déjà reliées par un nœud FAM parental commun → pas de ligne fratrie
  const sibsViaSameFam = new Set<string>();
  for (const fam of families.values()) {
    for (let i = 0; i < fam.children.length; i++) {
      for (let j = i + 1; j < fam.children.length; j++) {
        sibsViaSameFam.add([fam.children[i], fam.children[j]].sort().join("|"));
      }
    }
  }

  const drawnHoriz = new Set<string>();

  for (const rel of relationships) {
    if (!HORIZONTAL_TYPES.has(rel.type)) continue;
    const a = map.get(rel.personAId);
    const b = map.get(rel.personBId);
    if (!a || !b) continue;
    const key = [rel.personAId, rel.personBId].sort().join("-");
    if (drawnHoriz.has(key)) continue;
    // Siblings already visually linked via a shared FAM parent node — skip
    if (rel.type === "sibling" && sibsViaSameFam.has([rel.personAId, rel.personBId].sort().join("|"))) continue;
    drawnHoriz.add(key);

    const ca = center(a);
    const cb = center(b);
    const hs = relStroke(rel.personAId, rel.personBId, 0.4);
    const dashArray = rel.type === "half_sibling" ? "8 4"
      : rel.type === "step_sibling" ? "6 2 2 2"
      : undefined; // sibling: solid
    paths.push(
      <line
        key={`horiz-${rel.id}`}
        x1={ca.x} y1={ca.y} x2={cb.x} y2={cb.y}
        stroke={hs}
        strokeWidth="1"
        strokeDasharray={dashArray}
      />
    );
  }

  // Note : les liens étendus (grand-parent, oncle/tante, neveu/nièce,
  // beau-parent…) ne sont volontairement PAS tracés — ils sont déductibles
  // de la chaîne parent→enfant et alourdissaient la lecture du canvas. Ils
  // restent visibles et éditables dans la fiche de chaque personne.

  return (
    <svg
      className="pointer-events-none absolute left-0 top-0 overflow-visible"
      width={width}
      height={height}
      style={{ width, height }}
    >
      <defs>
        {/* context-stroke : la flèche hérite de la couleur du trait qui la porte */}
        <marker id="arrow-fam" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto">
          <path d="M0,0 L6,3 L0,6 Z" fill="context-stroke" />
        </marker>
      </defs>
      {paths}
    </svg>
  );
}
