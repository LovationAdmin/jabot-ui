import { Person, Relationship } from "@/lib/types";
import { CARD_W, CARD_H } from "./PersonCard";

interface ConnectorsProps {
  persons: Person[];
  relationships: Relationship[];
  width?: number;
  height?: number;
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

export function Connectors({ persons, relationships, width = 4000, height = 3000 }: ConnectorsProps) {
  const map = new Map(persons.map((p) => [p.id, p]));

  // Group parent→child edges: parentId → Set<childId>
  const childrenOf = new Map<string, string[]>();
  const parentsOf = new Map<string, string[]>();

  for (const rel of relationships) {
    const a = map.get(rel.personAId);
    const b = map.get(rel.personBId);
    if (!a || !b) continue;

    if (rel.type === "parent") {
      // person_a is parent of person_b
      if (!childrenOf.has(rel.personAId)) childrenOf.set(rel.personAId, []);
      childrenOf.get(rel.personAId)!.push(rel.personBId);
      if (!parentsOf.has(rel.personBId)) parentsOf.set(rel.personBId, []);
      parentsOf.get(rel.personBId)!.push(rel.personAId);
    } else if (rel.type === "child") {
      // person_a is child of person_b
      if (!childrenOf.has(rel.personBId)) childrenOf.set(rel.personBId, []);
      childrenOf.get(rel.personBId)!.push(rel.personAId);
      if (!parentsOf.has(rel.personAId)) parentsOf.set(rel.personAId, []);
      parentsOf.get(rel.personAId)!.push(rel.personBId);
    }
  }

  const paths: React.ReactNode[] = [];

  // ── Parent→child tree connectors ──────────────────────────────────
  // For each parent with >1 child: draw a fork (vertical stem → horizontal bar → vertical drops)
  // For a single child: draw a simple vertical bezier.
  const drawnParentChild = new Set<string>();

  for (const [parentId, childIds] of childrenOf.entries()) {
    const parent = map.get(parentId);
    if (!parent) continue;

    const children = childIds.map((id) => map.get(id)).filter(Boolean) as Person[];
    if (children.length === 0) continue;

    const parentBottom = bottom(parent);

    if (children.length === 1) {
      const childTop = top(children[0]);
      const my = (parentBottom.y + childTop.y) / 2;
      const key = `pc-${parentId}-${children[0].id}`;
      if (!drawnParentChild.has(key)) {
        drawnParentChild.add(key);
        paths.push(
          <path
            key={key}
            d={`M ${parentBottom.x} ${parentBottom.y} C ${parentBottom.x} ${my}, ${childTop.x} ${my}, ${childTop.x} ${childTop.y}`}
            stroke="oklch(0.45 0.12 55 / 0.55)"
            strokeWidth="1.5"
            fill="none"
          />
        );
      }
    } else {
      // Multiple children: fork pattern
      const childTops = children.map((c) => top(c));
      const minX = Math.min(...childTops.map((t) => t.x));
      const maxX = Math.max(...childTops.map((t) => t.x));
      const forkY = childTops[0].y - (childTops[0].y - parentBottom.y) * 0.45;

      // Vertical stem from parent down to fork
      paths.push(
        <line
          key={`stem-${parentId}`}
          x1={parentBottom.x} y1={parentBottom.y}
          x2={parentBottom.x} y2={forkY}
          stroke="oklch(0.45 0.12 55 / 0.55)"
          strokeWidth="1.5"
        />
      );

      // Horizontal bar connecting all children
      const barLeft = Math.min(minX, parentBottom.x);
      const barRight = Math.max(maxX, parentBottom.x);
      paths.push(
        <line
          key={`bar-${parentId}`}
          x1={barLeft} y1={forkY}
          x2={barRight} y2={forkY}
          stroke="oklch(0.45 0.12 55 / 0.55)"
          strokeWidth="1.5"
        />
      );

      // Vertical drops from bar to each child top
      for (const child of children) {
        const ct = top(child);
        const key = `pc-${parentId}-${child.id}`;
        if (!drawnParentChild.has(key)) {
          drawnParentChild.add(key);
          paths.push(
            <line
              key={key}
              x1={ct.x} y1={forkY}
              x2={ct.x} y2={ct.y}
              stroke="oklch(0.45 0.12 55 / 0.55)"
              strokeWidth="1.5"
            />
          );
        }
      }
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
    paths.push(
      <path
        key={`spouse-${rel.id}`}
        d={`M ${ca.x} ${ca.y} C ${mx} ${ca.y}, ${mx} ${cb.y}, ${cb.x} ${cb.y}`}
        stroke="oklch(0.60 0.18 20 / 0.50)"
        strokeWidth="1.5"
        strokeDasharray="5 3"
        fill="none"
      />
    );
  }

  // ── Sibling / horizontal connectors (non-parent types) ───────────
  const HORIZONTAL_TYPES = new Set(["sibling", "half_sibling", "step_sibling", "cousin", "homonym"]);
  const drawnHoriz = new Set<string>();

  for (const rel of relationships) {
    if (!HORIZONTAL_TYPES.has(rel.type)) continue;
    const a = map.get(rel.personAId);
    const b = map.get(rel.personBId);
    if (!a || !b) continue;
    const key = [rel.personAId, rel.personBId].sort().join("-");
    if (drawnHoriz.has(key)) continue;
    drawnHoriz.add(key);

    const dashed = DASHED_TYPES.has(rel.type);
    const ca = center(a);
    const cb = center(b);
    paths.push(
      <line
        key={`horiz-${rel.id}`}
        x1={ca.x} y1={ca.y} x2={cb.x} y2={cb.y}
        stroke="oklch(0.52 0.015 60 / 0.30)"
        strokeWidth="1"
        strokeDasharray={dashed ? "4 3" : undefined}
      />
    );
  }

  // ── Extended vertical types (grandparent, uncle, etc.) ────────────
  const VERTICAL_DOWN = ["grandparent", "step_parent", "uncle_aunt"];
  const VERTICAL_UP = ["grandchild", "step_child", "nephew_niece"];

  for (const rel of relationships) {
    const a = map.get(rel.personAId);
    const b = map.get(rel.personBId);
    if (!a || !b) continue;

    if (VERTICAL_DOWN.includes(rel.type)) {
      const from = bottom(a);
      const to = top(b);
      const my = (from.y + to.y) / 2;
      paths.push(
        <path
          key={`vd-${rel.id}`}
          d={`M ${from.x} ${from.y} C ${from.x} ${my}, ${to.x} ${my}, ${to.x} ${to.y}`}
          stroke="oklch(0.35 0.05 55 / 0.30)"
          strokeWidth="1"
          strokeDasharray="5 3"
          fill="none"
        />
      );
    } else if (VERTICAL_UP.includes(rel.type)) {
      const from = top(a);
      const to = bottom(b);
      const my = (from.y + to.y) / 2;
      paths.push(
        <path
          key={`vu-${rel.id}`}
          d={`M ${from.x} ${from.y} C ${from.x} ${my}, ${to.x} ${my}, ${to.x} ${to.y}`}
          stroke="oklch(0.35 0.05 55 / 0.30)"
          strokeWidth="1"
          strokeDasharray="5 3"
          fill="none"
        />
      );
    }
  }

  return (
    <svg
      className="pointer-events-none absolute left-0 top-0 overflow-visible"
      width={width}
      height={height}
      style={{ width, height }}
    >
      {paths}
    </svg>
  );
}
