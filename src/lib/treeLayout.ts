/**
 * Client-side genealogy tree layout — Reingold-Tilford inspired.
 *
 * Guarantees:
 *   - Same generation → same Y coordinate (ancestors top, descendants bottom)
 *   - Spouses always adjacent on the same row
 *   - All descendants of a family in a contiguous horizontal block
 *   - No card overlap
 */

import { Person, Relationship } from "./types";

export const CARD_W = 208;
export const CARD_H = 112;
const H_STEP = CARD_W + 56;    // horizontal slot width (card + gap)
const V_STEP = CARD_H + 110;   // vertical slot height (card + gap)
const FAMILY_GAP = 40;         // gap between distinct family blocks
const COMPONENT_GAP = 320;     // gap between disconnected components

// ─────────────────────────────────────────────────────────────────────────────
export function computeAutoLayout(
  persons: Person[],
  relationships: Relationship[],
): Map<string, { x: number; y: number }> {
  if (persons.length === 0) return new Map();
  if (persons.length === 1) return new Map([[persons[0].id, { x: 0, y: 0 }]]);

  const idSet = new Set(persons.map((p) => p.id));

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

  // Union-Find for connected components
  const uf = new Map<string, string>(persons.map((p) => [p.id, p.id]));
  const find = (x: string): string => {
    while (uf.get(x) !== x) { const p = uf.get(x)!; uf.set(x, uf.get(p)!); x = p; }
    return x;
  };
  for (const r of relationships) {
    if (idSet.has(r.personAId) && idSet.has(r.personBId)) {
      const ra = find(r.personAId), rb = find(r.personBId);
      if (ra !== rb) uf.set(ra, rb);
    }
  }

  const compOf = new Map<string, string[]>();
  for (const p of persons) {
    const root = find(p.id);
    if (!compOf.has(root)) compOf.set(root, []);
    compOf.get(root)!.push(p.id);
  }
  const components = [...compOf.values()].sort((a, b) => b.length - a.length);

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
interface FamUnit {
  key: string;
  parents: string[];
  children: string[];
  gen: number;
}

function _layoutComponent(
  ids: string[],
  idSet: Set<string>,
  parentsOf: Map<string, string[]>,
  childrenOf: Map<string, string[]>,
  spousesOf: Map<string, Set<string>>,
): Map<string, { x: number; y: number }> {

  // ── 1. BFS generation assignment ─────────────────────────────────
  const gen = new Map<string, number>();
  const roots = ids.filter(
    (id) => (parentsOf.get(id) ?? []).filter((p) => idSet.has(p)).length === 0,
  );
  const bfsQ = [...roots];
  for (const id of bfsQ) if (!gen.has(id)) gen.set(id, 0);
  for (let qi = 0; qi < bfsQ.length; qi++) {
    const id = bfsQ[qi];
    const g = gen.get(id)!;
    for (const c of (childrenOf.get(id) ?? []).filter((c) => idSet.has(c))) {
      if ((gen.get(c) ?? -1) < g + 1) { gen.set(c, g + 1); bfsQ.push(c); }
    }
  }
  for (const id of ids) if (!gen.has(id)) gen.set(id, 0);

  // ── 2. Combined fixpoint: spouse same-gen + parent-before-child ───
  // Bug fix: spouse propagation alone can put a parent at the same level as
  // their child. We re-enforce child > parent after every spouse adjustment.
  let stable = false;
  let guard = ids.length * 3 + 10;
  while (!stable && guard-- > 0) {
    stable = true;
    // Spouse: take max
    for (const id of ids) {
      const g = gen.get(id)!;
      for (const sid of (spousesOf.get(id) ?? [])) {
        if (!idSet.has(sid)) continue;
        const sg = gen.get(sid)!;
        const mx = Math.max(g, sg);
        if (g !== mx) { gen.set(id, mx); stable = false; }
        if (sg !== mx) { gen.set(sid, mx); stable = false; }
      }
    }
    // Parent-before-child: child must be strictly below parent
    for (const id of ids) {
      const g = gen.get(id)!;
      for (const cid of (childrenOf.get(id) ?? []).filter((c) => idSet.has(c))) {
        if ((gen.get(cid) ?? 0) <= g) { gen.set(cid, g + 1); stable = false; }
      }
    }
  }

  const maxGen = Math.max(...gen.values());
  const byGen = new Map<number, string[]>();
  for (const id of ids) {
    const g = gen.get(id)!;
    if (!byGen.has(g)) byGen.set(g, []);
    byGen.get(g)!.push(id);
  }

  // ── 3. Build FamUnits ─────────────────────────────────────────────
  // Primary family key for a person as PARENT (couple key if spouse at same gen, else solo)
  const primaryParentFamKey = (id: string): string => {
    const g = gen.get(id)!;
    const spouseHere = [...(spousesOf.get(id) ?? [])]
      .filter((s) => idSet.has(s) && gen.get(s) === g);
    if (spouseHere.length > 0) return [id, spouseHere[0]].sort().join("|");
    return `solo|${id}`;
  };

  const famUnits = new Map<string, FamUnit>();

  // Create FamUnit for every person who has children OR a same-gen spouse
  for (const id of ids) {
    const g = gen.get(id)!;
    const hasKids = (childrenOf.get(id) ?? []).some((c) => idSet.has(c));
    const hasSpouseHere = [...(spousesOf.get(id) ?? [])].some(
      (s) => idSet.has(s) && gen.get(s) === g,
    );
    if (!hasKids && !hasSpouseHere) continue;
    const fk = primaryParentFamKey(id);
    if (!famUnits.has(fk)) {
      const parents = fk.startsWith("solo|") ? [id] : fk.split("|");
      famUnits.set(fk, { key: fk, parents, children: [], gen: g });
    }
  }

  // Helper: find the best existing FamUnit for a set of parents
  const findFamKey = (parents: string[]): string | null => {
    // Prefer a couple key if two parents are spouses
    for (let i = 0; i < parents.length; i++) {
      for (let j = i + 1; j < parents.length; j++) {
        const ck = [parents[i], parents[j]].sort().join("|");
        if (famUnits.has(ck)) return ck;
      }
    }
    // Fall back to any existing solo key for one of the parents
    for (const pid of parents) {
      // Check the primary key for this parent
      const pk = primaryParentFamKey(pid);
      if (famUnits.has(pk)) return pk;
      // Also check solo key directly
      const sk = `solo|${pid}`;
      if (famUnits.has(sk)) return sk;
    }
    return null;
  };

  // Assign each child to a FamUnit
  const personParentFamKey = new Map<string, string>(); // child → parent famKey
  for (const id of ids) {
    const parents = (parentsOf.get(id) ?? []).filter((p) => idSet.has(p));
    if (parents.length === 0) continue;
    const fk = findFamKey(parents);
    if (!fk) continue;
    if (!famUnits.get(fk)!.children.includes(id)) {
      famUnits.get(fk)!.children.push(id);
    }
    personParentFamKey.set(id, fk);
  }

  // Map parent → the FamUnit they head (first one found per person)
  const personHeadsFam = new Map<string, string>();
  for (const [fk, fam] of famUnits) {
    for (const pid of fam.parents) {
      if (!personHeadsFam.has(pid)) personHeadsFam.set(pid, fk);
    }
  }

  // ── 4. Compute subtree widths (bottom-up) ─────────────────────────
  const famW = new Map<string, number>();
  const computeWidth = (fk: string, depth = 0): number => {
    if (famW.has(fk)) return famW.get(fk)!;
    famW.set(fk, 0); // break cycles
    if (depth > 200) return CARD_W;
    const fam = famUnits.get(fk)!;
    const coupleW = CARD_W + (fam.parents.length - 1) * H_STEP;
    if (fam.children.length === 0) { famW.set(fk, coupleW); return coupleW; }
    let childW = 0;
    for (let i = 0; i < fam.children.length; i++) {
      const cfk = personHeadsFam.get(fam.children[i]);
      childW += cfk ? computeWidth(cfk, depth + 1) : CARD_W;
      if (i < fam.children.length - 1) childW += FAMILY_GAP;
    }
    const w = Math.max(coupleW, childW);
    famW.set(fk, w);
    return w;
  };
  for (const fk of famUnits.keys()) computeWidth(fk);

  // ── 5. Place families top-down (recursive) ─────────────────────────
  const positions = new Map<string, { x: number; y: number }>();
  const placedFams = new Set<string>();

  const placeFam = (fk: string, x0: number) => {
    if (placedFams.has(fk)) return;
    placedFams.add(fk);

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

    // Total width of children row
    let childrenTotalW = 0;
    for (let i = 0; i < fam.children.length; i++) {
      const cfk = personHeadsFam.get(fam.children[i]);
      childrenTotalW += cfk ? (famW.get(cfk) ?? CARD_W) : CARD_W;
      if (i < fam.children.length - 1) childrenTotalW += FAMILY_GAP;
    }

    // Center children under the parents' midpoint
    let childX = Math.round(midX - childrenTotalW / 2);

    // Sort children: stable by id for determinism
    const sortedChildren = [...fam.children].sort((a, b) => a.localeCompare(b));

    for (const childId of sortedChildren) {
      const cfk = personHeadsFam.get(childId);
      const cw = cfk ? (famW.get(cfk) ?? CARD_W) : CARD_W;
      if (cfk) {
        placeFam(cfk, childX);
      } else if (!positions.has(childId)) {
        positions.set(childId, {
          x: childX + Math.round((cw - CARD_W) / 2),
          y: gen.get(childId)! * V_STEP,
        });
      }
      childX += cw + FAMILY_GAP;
    }
  };

  // Root families: all parents have no visible parents
  const rootFamKeys = [...famUnits.keys()].filter((fk) =>
    famUnits.get(fk)!.parents.every(
      (pid) => (parentsOf.get(pid) ?? []).every((pp) => !idSet.has(pp)),
    ),
  );
  rootFamKeys.sort((a, b) => a.localeCompare(b));

  let curX = 0;
  for (const fk of rootFamKeys) {
    placeFam(fk, curX);
    curX += (famW.get(fk) ?? CARD_W) + FAMILY_GAP * 2;
  }

  // Place any FamUnit not yet reached from roots (can happen with complex graphs)
  for (const fk of famUnits.keys()) {
    if (!placedFams.has(fk)) {
      placeFam(fk, curX);
      curX += (famW.get(fk) ?? CARD_W) + FAMILY_GAP * 2;
    }
  }

  // Place persons still unpositioned (no family connections)
  for (const id of ids) {
    if (!positions.has(id)) {
      positions.set(id, { x: curX, y: gen.get(id)! * V_STEP });
      curX += H_STEP + FAMILY_GAP;
    }
  }

  // ── 6. Final per-generation overlap guarantee ──────────────────────
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
