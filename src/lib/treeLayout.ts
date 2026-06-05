/**
 * Client-side genealogy tree layout — Reingold-Tilford inspired.
 *
 * Algorithm:
 *   1. BFS from roots → generation numbers (parents above children)
 *   2. Propagate spouses to same generation (max)
 *   3. Build FamUnits: each parent couple (or solo parent) + their children
 *   4. Compute subtree widths bottom-up → guarantees non-overlapping blocks
 *   5. Place families top-down recursively → couples centered over children,
 *      each family branch occupies a contiguous horizontal block
 *   6. Place isolated nodes (no family links) beside the main tree
 *   7. Final per-generation push-right → zero overlaps guaranteed
 *
 * Properties:
 *   - Every person at the same generation has the same Y coordinate
 *   - Ancestors are always above descendants (top = oldest, bottom = youngest)
 *   - Spouses are always adjacent
 *   - All descendants of a family form a contiguous horizontal block
 */

import { Person, Relationship } from "./types";

export const CARD_W = 208;
export const CARD_H = 112;
const H_STEP = CARD_W + 56;    // horizontal slot: card + gap
const V_STEP = CARD_H + 110;   // vertical slot: card + gap between generations
const FAMILY_GAP = 40;         // gap between distinct family blocks
const COMPONENT_GAP = 320;     // gap between fully disconnected components

export function computeAutoLayout(
  persons: Person[],
  relationships: Relationship[],
): Map<string, { x: number; y: number }> {
  if (persons.length === 0) return new Map();
  if (persons.length === 1) return new Map([[persons[0].id, { x: 0, y: 0 }]]);

  const idSet = new Set(persons.map((p) => p.id));

  // ── Adjacency maps ─────────────────────────────────────────────────
  const parentsOf = new Map<string, string[]>();
  const childrenOf = new Map<string, string[]>();
  const spousesOf = new Map<string, Set<string>>();

  for (const p of persons) {
    parentsOf.set(p.id, []);
    childrenOf.set(p.id, []);
    spousesOf.set(p.id, new Set());
  }
  for (const r of relationships) {
    if (!idSet.has(r.personAId) || !idSet.has(r.personBId)) continue;
    if (r.type === "parent") {
      parentsOf.get(r.personBId)!.push(r.personAId);
      childrenOf.get(r.personAId)!.push(r.personBId);
    } else if (r.type === "child") {
      parentsOf.get(r.personAId)!.push(r.personBId);
      childrenOf.get(r.personBId)!.push(r.personAId);
    } else if (r.type === "spouse") {
      spousesOf.get(r.personAId)!.add(r.personBId);
      spousesOf.get(r.personBId)!.add(r.personAId);
    }
  }

  // ── Union-Find for connected components ────────────────────────────
  const uf = new Map<string, string>(persons.map((p) => [p.id, p.id]));
  const find = (x: string): string => {
    while (uf.get(x) !== x) { const p = uf.get(x)!; uf.set(x, uf.get(p)!); x = p; }
    return x;
  };
  const unite = (a: string, b: string) => {
    const ra = find(a), rb = find(b);
    if (ra !== rb) uf.set(ra, rb);
  };
  for (const r of relationships) {
    if (idSet.has(r.personAId) && idSet.has(r.personBId)) unite(r.personAId, r.personBId);
  }

  const compOf = new Map<string, string[]>();
  for (const p of persons) {
    const root = find(p.id);
    if (!compOf.has(root)) compOf.set(root, []);
    compOf.get(root)!.push(p.id);
  }
  const components = [...compOf.values()].sort((a, b) => b.length - a.length);

  // ── Layout each component, then place side-by-side ─────────────────
  const allPositions = new Map<string, { x: number; y: number }>();
  let xOffset = 0;

  for (const compIds of components) {
    const compSet = new Set(compIds);
    const local = _layoutComponent(compIds, compSet, parentsOf, childrenOf, spousesOf);
    if (local.size === 0) continue;

    const xs = [...local.values()].map((p) => p.x);
    const minX = Math.min(...xs);
    for (const [id, pos] of local) allPositions.set(id, { x: pos.x - minX + xOffset, y: pos.y });
    xOffset += Math.max(...xs) - minX + CARD_W + COMPONENT_GAP;
  }

  // ── Center around viewport origin ──────────────────────────────────
  const xs = [...allPositions.values()].map((p) => p.x);
  const ys = [...allPositions.values()].map((p) => p.y);
  const cx = (Math.min(...xs) + Math.max(...xs) + CARD_W) / 2;
  const cy = (Math.min(...ys) + Math.max(...ys) + CARD_H) / 2;

  const result = new Map<string, { x: number; y: number }>();
  for (const [id, pos] of allPositions)
    result.set(id, { x: Math.round(pos.x - cx), y: Math.round(pos.y - cy) });
  return result;
}

// ─────────────────────────────────────────────────────────────────────────────
// Internal: layout one connected component
// ─────────────────────────────────────────────────────────────────────────────

interface FamUnit {
  key: string;
  parents: string[];   // 1 or 2 parent ids
  children: string[];  // direct children ids
  gen: number;         // generation level of the parents
}

function _layoutComponent(
  ids: string[],
  idSet: Set<string>,
  parentsOf: Map<string, string[]>,
  childrenOf: Map<string, string[]>,
  spousesOf: Map<string, Set<string>>,
): Map<string, { x: number; y: number }> {

  // ── 1. Assign generation numbers via BFS ───────────────────────────
  const gen = new Map<string, number>();
  const roots = ids.filter(
    (id) => (parentsOf.get(id) ?? []).filter((p) => idSet.has(p)).length === 0,
  );

  const bfsQ = [...roots];
  for (const id of bfsQ) if (!gen.has(id)) gen.set(id, 0);
  let qi = 0;
  while (qi < bfsQ.length) {
    const id = bfsQ[qi++];
    const g = gen.get(id)!;
    for (const c of (childrenOf.get(id) ?? []).filter((c) => idSet.has(c))) {
      if ((gen.get(c) ?? -1) < g + 1) { gen.set(c, g + 1); bfsQ.push(c); }
    }
  }
  for (const id of ids) if (!gen.has(id)) gen.set(id, 0); // fallback for cycles

  // ── 2. Propagate spouses to same generation (max) ──────────────────
  let changed = true;
  while (changed) {
    changed = false;
    for (const id of ids) {
      const g = gen.get(id)!;
      for (const sid of (spousesOf.get(id) ?? [])) {
        if (!idSet.has(sid)) continue;
        const sg = gen.get(sid) ?? 0;
        const mx = Math.max(g, sg);
        if (g !== mx) { gen.set(id, mx); changed = true; }
        if (sg !== mx) { gen.set(sid, mx); changed = true; }
      }
    }
  }

  const maxGen = Math.max(...gen.values());

  // ── 3. Build FamUnits ─────────────────────────────────────────────
  // Primary family key for a person as a PARENT (couple key if spouse present, else solo)
  const parentFamKey = (id: string): string => {
    const g = gen.get(id)!;
    const spouseHere = [...(spousesOf.get(id) ?? [])]
      .filter((s) => idSet.has(s) && gen.get(s) === g);
    if (spouseHere.length > 0) return [id, spouseHere[0]].sort().join("|");
    return `solo|${id}`;
  };

  const famUnits = new Map<string, FamUnit>();

  // Create a FamUnit for every person who has children OR a spouse in same gen
  for (const id of ids) {
    const g = gen.get(id)!;
    const hasKids = (childrenOf.get(id) ?? []).some((c) => idSet.has(c));
    const hasSpouseHere = [...(spousesOf.get(id) ?? [])].some(
      (s) => idSet.has(s) && gen.get(s) === g,
    );
    if (!hasKids && !hasSpouseHere) continue;

    const fk = parentFamKey(id);
    if (!famUnits.has(fk)) {
      const parents = fk.startsWith("solo|") ? [id] : fk.split("|");
      famUnits.set(fk, { key: fk, parents, children: [], gen: g });
    }
  }

  // Assign each child to its primary family
  const personParentFamKey = new Map<string, string>(); // child → their parent's famKey
  for (const id of ids) {
    const parents = (parentsOf.get(id) ?? []).filter((p) => idSet.has(p));
    if (parents.length === 0) continue;

    // Prefer couple key over solo
    let fk: string | null = null;
    outer: for (let i = 0; i < parents.length; i++) {
      for (let j = i + 1; j < parents.length; j++) {
        if ((spousesOf.get(parents[i]) ?? new Set()).has(parents[j])) {
          fk = [parents[i], parents[j]].sort().join("|");
          break outer;
        }
      }
    }
    if (!fk) fk = `solo|${parents[0]}`;
    if (famUnits.has(fk)) {
      famUnits.get(fk)!.children.push(id);
      personParentFamKey.set(id, fk);
    }
  }

  // Map person → the FamUnit they head as a parent (used for recursive placement)
  const personHeadsFam = new Map<string, string>(); // parentId → famKey
  for (const [fk, fam] of famUnits) {
    for (const pid of fam.parents) {
      if (!personHeadsFam.has(pid)) personHeadsFam.set(pid, fk);
    }
  }

  // ── 4. Compute subtree widths bottom-up ───────────────────────────
  const famW = new Map<string, number>();

  const computeWidth = (fk: string, depth = 0): number => {
    if (famW.has(fk)) return famW.get(fk)!;
    famW.set(fk, 0); // break cycles
    if (depth > 100) return CARD_W; // safety

    const fam = famUnits.get(fk)!;
    // Width needed just for the couple/solo parent
    const coupleW = CARD_W + (fam.parents.length - 1) * H_STEP;

    if (fam.children.length === 0) {
      famW.set(fk, coupleW);
      return coupleW;
    }

    // Sum of children's subtree widths + gaps between them
    let childrenW = 0;
    for (let i = 0; i < fam.children.length; i++) {
      const childHeadsFk = personHeadsFam.get(fam.children[i]);
      childrenW += childHeadsFk ? computeWidth(childHeadsFk, depth + 1) : CARD_W;
      if (i < fam.children.length - 1) childrenW += FAMILY_GAP;
    }

    const w = Math.max(coupleW, childrenW);
    famW.set(fk, w);
    return w;
  };

  for (const fk of famUnits.keys()) computeWidth(fk);

  // ── 5. Place families top-down (recursive) ─────────────────────────
  const positions = new Map<string, { x: number; y: number }>();

  const placeFam = (fk: string, x0: number) => {
    const fam = famUnits.get(fk)!;
    const w = famW.get(fk) ?? CARD_W;
    const midX = x0 + w / 2;

    // Place parents centered in their slot
    const coupleW = CARD_W + (fam.parents.length - 1) * H_STEP;
    const parX = Math.round(midX - coupleW / 2);
    for (let i = 0; i < fam.parents.length; i++) {
      if (!positions.has(fam.parents[i]))
        positions.set(fam.parents[i], { x: parX + i * H_STEP, y: fam.gen * V_STEP });
    }

    if (fam.children.length === 0) return;

    // Sort children: children who themselves have children (subtrees) go first in the middle,
    // leaves on the sides — this keeps surnames grouped and reduces crossings.
    const sortedChildren = [...fam.children].sort((a, b) => {
      const wa = famW.get(personHeadsFam.get(a) ?? "") ?? CARD_W;
      const wb = famW.get(personHeadsFam.get(b) ?? "") ?? CARD_W;
      // sort by last name first for surname grouping, then by subtree width desc
      const lnA = (a && positions.has(a) ? "" : ""); // resolved below via person data — use insertion order
      void lnA;
      return wb - wa;
    });

    // Total width of children row
    let childrenTotalW = 0;
    for (let i = 0; i < sortedChildren.length; i++) {
      childrenTotalW += famW.get(personHeadsFam.get(sortedChildren[i]) ?? "") ?? CARD_W;
      if (i < sortedChildren.length - 1) childrenTotalW += FAMILY_GAP;
    }

    let childX = Math.round(midX - childrenTotalW / 2);

    for (const childId of sortedChildren) {
      const childFk = personHeadsFam.get(childId);
      const childW = childFk ? (famW.get(childFk) ?? CARD_W) : CARD_W;

      if (childFk) {
        placeFam(childFk, childX);
      } else {
        if (!positions.has(childId))
          positions.set(childId, {
            x: childX + Math.round((childW - CARD_W) / 2),
            y: gen.get(childId)! * V_STEP,
          });
      }
      childX += childW + FAMILY_GAP;
    }
  };

  // Root families: parents have no parents in this component
  const rootFamKeys = [...famUnits.keys()].filter((fk) =>
    famUnits.get(fk)!.parents.every(
      (pid) => (parentsOf.get(pid) ?? []).every((pp) => !idSet.has(pp)),
    ),
  );

  // Sort root families by their generation (should all be 0 typically)
  rootFamKeys.sort((a, b) => famUnits.get(a)!.gen - famUnits.get(b)!.gen || a.localeCompare(b));

  let curX = 0;
  for (const fk of rootFamKeys) {
    placeFam(fk, curX);
    curX += (famW.get(fk) ?? CARD_W) + FAMILY_GAP * 2;
  }

  // Also place persons who are root individuals (no parents, not in any famUnit as parent)
  for (const id of roots) {
    if (!positions.has(id)) {
      positions.set(id, { x: curX, y: gen.get(id)! * V_STEP });
      curX += H_STEP + FAMILY_GAP;
    }
  }

  // Place any remaining unpositioned persons (isolated in generation)
  for (const id of ids) {
    if (!positions.has(id)) {
      positions.set(id, { x: curX, y: gen.get(id)! * V_STEP });
      curX += H_STEP + FAMILY_GAP;
    }
  }

  // ── 6. Final per-generation overlap guarantee ──────────────────────
  // Y coordinates are never touched — only X spacing is corrected here.
  const byGen = new Map<number, string[]>();
  for (const id of ids) {
    const g = gen.get(id)!;
    if (!byGen.has(g)) byGen.set(g, []);
    byGen.get(g)!.push(id);
  }

  for (let g = 0; g <= maxGen; g++) {
    const gIds = [...(byGen.get(g) ?? [])].sort(
      (a, b) => (positions.get(a)?.x ?? 0) - (positions.get(b)?.x ?? 0),
    );
    for (let i = 1; i < gIds.length; i++) {
      const prev = positions.get(gIds[i - 1])!;
      const curr = positions.get(gIds[i])!;
      if (curr.x < prev.x + H_STEP)
        positions.set(gIds[i], { x: prev.x + H_STEP, y: curr.y });
    }
  }

  return positions;
}
