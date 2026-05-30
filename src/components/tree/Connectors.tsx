import { Person, Relationship } from "@/lib/types";
import { CARD_W, CARD_H } from "./PersonCard";

interface ConnectorsProps {
  persons: Person[];
  relationships: Relationship[];
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

export function Connectors({ persons, relationships }: ConnectorsProps) {
  const map = new Map(persons.map((p) => [p.id, p]));

  return (
    <svg
      className="pointer-events-none absolute left-0 top-0 overflow-visible"
      style={{ width: 0, height: 0 }}
    >
      {relationships.map((rel) => {
        const a = map.get(rel.personAId);
        const b = map.get(rel.personBId);
        if (!a || !b) return null;

        if (rel.type === "spouse") {
          const ca = center(a);
          const cb = center(b);
          const mx = (ca.x + cb.x) / 2;
          return (
            <path
              key={rel.id}
              d={`M ${ca.x} ${ca.y} C ${mx} ${ca.y}, ${mx} ${cb.y}, ${cb.x} ${cb.y}`}
              stroke="oklch(0.39 0.105 55 / 0.45)"
              strokeWidth="1.5"
              strokeDasharray="5 3"
              fill="none"
            />
          );
        }

        if (rel.type === "parent") {
          const from = bottom(a);
          const to = top(b);
          const my = (from.y + to.y) / 2;
          return (
            <path
              key={rel.id}
              d={`M ${from.x} ${from.y} C ${from.x} ${my}, ${to.x} ${my}, ${to.x} ${to.y}`}
              stroke="oklch(0.27 0.015 60 / 0.25)"
              strokeWidth="1.5"
              fill="none"
            />
          );
        }

        if (rel.type === "child") {
          const from = top(a);
          const to = bottom(b);
          const my = (from.y + to.y) / 2;
          return (
            <path
              key={rel.id}
              d={`M ${from.x} ${from.y} C ${from.x} ${my}, ${to.x} ${my}, ${to.x} ${to.y}`}
              stroke="oklch(0.27 0.015 60 / 0.25)"
              strokeWidth="1.5"
              fill="none"
            />
          );
        }

        if (rel.type === "sibling") {
          const ca = center(a);
          const cb = center(b);
          return (
            <line
              key={rel.id}
              x1={ca.x} y1={ca.y} x2={cb.x} y2={cb.y}
              stroke="oklch(0.52 0.015 60 / 0.2)"
              strokeWidth="1"
              strokeDasharray="3 3"
            />
          );
        }

        return null;
      })}
    </svg>
  );
}
