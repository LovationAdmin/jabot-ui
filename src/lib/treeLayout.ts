/**
 * Client-side genealogy tree layout.
 *
 * Algorithm:
 *   1. Build parent/child/spouse maps from visible relationships
 *   2. BFS from roots to assign generation numbers (parents above children)
 *   3. Propagate spouse pairs to same generation (take max)
 *   4. Top-down x assignment: sort each generation by parent-hint, group spouses
 *   5. Center children under their parent midpoint (2 passes)
 *   6. Family-group overlap resolution: push whole sibling groups as a unit,
 *      cascade shifts to all descendants so subtrees stay cohesive
 *   7. Final centering pass to re-align children after cascaded shifts
 *   8. Handle disconnected components side-by-side
 */

import { Person, Relationship } from "./types";

export const CARD_W = 208;
export const CARD_H = 112;
const H_STEP = CARD_W + 56;    // horizontal slot: card + gap
const V_STEP = CARD_H + 110;   // vertical slot: card + gap between generations
const FAMILY_GAP = 32;         // extra gap between distinct family groups in same generation
const COMPONENT_GAP = 280;     // gap between fully disconnected components

export function computeAutoLayout(
  persons: Person[],
  relationships: Relationship[],
): Map<string, { x: number; y: number }> {
  if (persons.length === 0) return new Map();
  if (persons.length === 1) {
    return new Map([[persons[0].id, { x: 0, y: 0 }]]);
  }

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
  function find(x: string): string {
    while (uf.get(x) !== x) {
      const parent = uf.get(x)!;
      uf.set(x, uf.get(parent)!);
      x = parent;
    }
    return x;
  }
  function unite(a: string, b: string) {
    const ra = find(a), rb = find(b);
    if (ra !== rb) uf.set(ra, rb);
  }
  for (const r of relationships) {
    if (idSet.has(r.personAId) && idSet.has(r.personBId)) {
      unite(r.personAId, r.personBId);
    }
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
    const localPositions = _layoutComponent(
      compIds,
      compSet,
      parentsOf,
      childrenOf,
      spousesOf,
    );

    if (localPositions.size === 0) continue;

    const xs = [...localPositions.values()].map((p) => p.x);
    const minX = Math.min(...xs);

    for (const [id, pos] of localPositions) {
      allPositions.set(id, { x: pos.x - minX + xOffset, y: pos.y });
    }

    const maxX = Math.max(...xs) - minX + CARD_W;
    xOffset += maxX + COMPONENT_GAP;
  }

  // ── Center around viewport origin ──────────────────────────────────
  const xs = [...allPositions.values()].map((p) => p.x);
  const ys = [...allPositions.values()].map((p) => p.y);
  const cx = (Math.min(...xs) + Math.max(...xs) + CARD_W) / 2;
  const cy = (Math.min(...ys) + Math.max(...ys) + CARD_H) / 2;

  const result = new Map<string, { x: number; y: number }>();
  for (const [id, pos] of allPositions) {
    result.set(id, { x: Math.round(pos.x - cx), y: Math.round(pos.y - cy) });
  }
  return result;
}

// ── Internal: layout one connected component ──────────────────────────────

function _layoutComponent(
  ids: string[],
  idSet: Set<string>,
  parentsOf: Map<string, string[]>,
  childrenOf: Map<string, string[]>,
  spousesOf: Map<string, Set<string>>,
): Map<string, { x: number; y: number }> {

  // ── Assign generation numbers ───────────────────────────────────────
  const gen = new Map<string, number>();

  const roots = ids.filter(
    (id) => (parentsOf.get(id) ?? []).filter((pid) => idSet.has(pid)).length === 0,
  );

  const queue = [...roots];
  for (const id of queue) if (!gen.has(id)) gen.set(id, 0);

  let qi = 0;
  while (qi < queue.length) {
    const id = queue[qi++];
    const g = gen.get(id)!;
    for (const childId of (childrenOf.get(id) ?? []).filter((c) => idSet.has(c))) {
      const newG = g + 1;
      if ((gen.get(childId) ?? -1) < newG) {
        gen.set(childId, newG);
        queue.push(childId);
      }
    }
  }
  for (const id of ids) if (!gen.has(id)) gen.set(id, 0);

  // Propagate spouses to same generation (take max)
  let changed = true;
  while (changed) {
    changed = false;
    for (const id of ids) {
      const g = gen.get(id)!;
      for (const sid of (spousesOf.get(id) ?? [])) {
        if (!idSet.has(sid)) continue;
        const sg = gen.get(sid) ?? 0;
        const maxG = Math.max(g, sg);
        if (g !== maxG) { gen.set(id, maxG); changed = true; }
        if (sg !== maxG) { gen.set(sid, maxG); changed = true; }
      }
    }
  }

  const maxGen = Math.max(...[...gen.values()]);

  const byGen = new Map<number, string[]>();
  for (const id of ids) {
    const g = gen.get(id)!;
    if (!byGen.has(g)) byGen.set(g, []);
    byGen.get(g)!.push(id);
  }

  const positions = new Map<string, { x: number; y: number }>();

  // ── Helper: family key for a node (identifies the parent couple or solo parent) ──
  const famKeyOf = (id: string): string => {
    const parents = (parentsOf.get(id) ?? []).filter((p) => idSet.has(p));
    if (parents.length === 0) return `root|${id}`;
    for (let i = 0; i < parents.length; i++) {
      for (let j = i + 1; j < parents.length; j++) {
        if ((spousesOf.get(parents[i]) ?? new Set()).has(parents[j])) {
          return [parents[i], parents[j]].sort().join("|");
        }
      }
    }
    return `solo|${parents[0]}`;
  };

  // ── Helper: parent midpoint x for a family key ─────────────────────
  const famParentMidX = (famKey: string): number => {
    if (famKey.startsWith("root|")) {
      const id = famKey.slice(5);
      return positions.get(id)?.x ?? 0;
    }
    if (famKey.startsWith("solo|")) {
      const pid = famKey.slice(5);
      const pos = positions.get(pid);
      return pos ? pos.x + CARD_W / 2 : 0;
    }
    const pIds = famKey.split("|");
    const xs = pIds.map((pid) => positions.get(pid)).filter(Boolean).map((p) => p!.x + CARD_W / 2);
    return xs.length > 0 ? xs.reduce((a, b) => a + b, 0) / xs.length : 0;
  };

  // ── Top-down x assignment ───────────────────────────────────────────
  for (let g = 0; g <= maxGen; g++) {
    const gIds = byGen.get(g) ?? [];
    if (gIds.length === 0) continue;

    const parentHint = (id: string): number => {
      const pxs = (parentsOf.get(id) ?? [])
        .filter((pid) => positions.has(pid))
        .map((pid) => positions.get(pid)!.x);
      if (pxs.length === 0) return NaN;
      return pxs.reduce((a, b) => a + b, 0) / pxs.length;
    };

    const withHint = gIds
      .map((id) => ({ id, h: parentHint(id) }))
      .sort((a, b) => {
        if (isNaN(a.h) && isNaN(b.h)) return 0;
        if (isNaN(a.h)) return 1;
        if (isNaN(b.h)) return -1;
        return a.h - b.h;
      });

    // Build ordered groups: keep spouses adjacent
    const placed = new Set<string>();
    const orderedGroups: string[][] = [];
    for (const { id } of withHint) {
      if (placed.has(id)) continue;
      placed.add(id);
      const spouseHere = [...(spousesOf.get(id) ?? [])]
        .filter((s) => idSet.has(s) && gen.get(s) === g && !placed.has(s));
      for (const s of spouseHere) placed.add(s);
      orderedGroups.push([id, ...spouseHere]);
    }

    let curX = 0;
    for (const group of orderedGroups) {
      for (let i = 0; i < group.length; i++) {
        positions.set(group[i], { x: curX + i * H_STEP, y: g * V_STEP });
      }
      curX += group.length * H_STEP + FAMILY_GAP;
    }
  }

  // ── Center children under parent midpoint (2 passes top-down) ──────
  const centeringPass = () => {
    for (let g = 1; g <= maxGen; g++) {
      const gIds = byGen.get(g) ?? [];

      // Group children by family key
      const famChildren = new Map<string, string[]>();
      for (const id of gIds) {
        const fk = famKeyOf(id);
        if (!famChildren.has(fk)) famChildren.set(fk, []);
        famChildren.get(fk)!.push(id);
      }

      // Sort family groups by parent midpoint, then place children centered under parents
      const sortedFams = [...famChildren.entries()].sort(
        (a, b) => famParentMidX(a[0]) - famParentMidX(b[0]),
      );

      for (const [famKey, children] of sortedFams) {
        const midX = famParentMidX(famKey);
        children.sort((a, b) => (positions.get(a)?.x ?? 0) - (positions.get(b)?.x ?? 0));
        const totalW = children.length * H_STEP - (H_STEP - CARD_W);
        const startX = midX - totalW / 2;
        for (let i = 0; i < children.length; i++) {
          const pos = positions.get(children[i])!;
          positions.set(children[i], { x: Math.round(startX + i * H_STEP), y: pos.y });
        }
      }
    }
  };

  centeringPass();
  centeringPass();

  // ── Family-group overlap resolution with subtree cascade ────────────
  // Push whole sibling groups right as a unit; cascade shifts to descendants
  // so that subtrees stay cohesive instead of being torn apart.

  const cascadeShift = (startId: string, delta: number) => {
    const visited = new Set<string>();
    const stack = [startId];
    while (stack.length > 0) {
      const id = stack.pop()!;
      if (visited.has(id)) continue;
      visited.add(id);
      const pos = positions.get(id);
      if (pos) positions.set(id, { x: pos.x + delta, y: pos.y });
      for (const cid of (childrenOf.get(id) ?? []).filter((c) => idSet.has(c))) {
        stack.push(cid);
      }
    }
  };

  for (let g = 0; g <= maxGen; g++) {
    const gIds = byGen.get(g) ?? [];
    if (gIds.length < 2) continue;

    // Group nodes by family key
    const groupMap = new Map<string, string[]>();
    for (const id of gIds) {
      const fk = famKeyOf(id);
      if (!groupMap.has(fk)) groupMap.set(fk, []);
      groupMap.get(fk)!.push(id);
    }

    // Sort each group's members by x
    for (const grp of groupMap.values()) {
      grp.sort((a, b) => (positions.get(a)?.x ?? 0) - (positions.get(b)?.x ?? 0));
    }

    // Sort groups by their leftmost member's x
    const sortedGroups = [...groupMap.values()].sort(
      (a, b) => (positions.get(a[0])?.x ?? 0) - (positions.get(b[0])?.x ?? 0),
    );

    // Push groups right to resolve overlaps; cascade shifts to subtrees
    for (let i = 1; i < sortedGroups.length; i++) {
      const prevGroup = sortedGroups[i - 1];
      const currGroup = sortedGroups[i];

      const prevMaxX = Math.max(...prevGroup.map((id) => positions.get(id)!.x));
      const currMinX = positions.get(currGroup[0])!.x;
      const needed = prevMaxX + H_STEP;

      if (currMinX < needed) {
        const delta = needed - currMinX;
        // Cascade shift: move the whole subtree rooted at each node in currGroup
        for (const id of currGroup) {
          cascadeShift(id, delta);
        }
        // Re-sort currGroup after shift so the next iteration compares correctly
        currGroup.sort((a, b) => (positions.get(a)?.x ?? 0) - (positions.get(b)?.x ?? 0));
      }
    }
  }

  // ── Final centering pass to re-align after cascade shifts ───────────
  centeringPass();

  return positions;
}
