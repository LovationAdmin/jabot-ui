import { Person } from "@/lib/types";
import { CARD_W, CARD_H } from "./PersonCard";

const MINI_W = 140;
const MINI_H = 88;

interface MiniMapProps {
  persons: Person[];
  selectedId: string | null;
  viewport: { x: number; y: number; w: number; h: number; zoom: number };
  worldBounds: { w: number; h: number };
}

export function MiniMap({ persons, selectedId, viewport, worldBounds }: MiniMapProps) {
  const sx = MINI_W / worldBounds.w;
  const sy = MINI_H / worldBounds.h;

  const vpX = (-viewport.x / viewport.zoom) * sx;
  const vpY = (-viewport.y / viewport.zoom) * sy;
  const vpW = (viewport.w / viewport.zoom) * sx;
  const vpH = (viewport.h / viewport.zoom) * sy;

  return (
    <div
      className="pointer-events-none absolute bottom-20 right-4 overflow-hidden rounded-xl border border-border bg-card/80 shadow-card backdrop-blur-md"
      style={{ width: MINI_W, height: MINI_H }}
    >
      {persons.map((p) => {
        const x = (p.position?.x ?? 0) * sx;
        const y = (p.position?.y ?? 0) * sy;
        const w = Math.max(CARD_W * sx, 3);
        const h = Math.max(CARD_H * sy, 3);
        return (
          <div
            key={p.id}
            style={{ left: x, top: y, width: w, height: h }}
            className={`absolute rounded-sm transition-colors ${
              p.id === selectedId ? "bg-primary" : "bg-muted-foreground/35"
            }`}
          />
        );
      })}
      <div
        style={{ left: vpX, top: vpY, width: Math.max(vpW, 8), height: Math.max(vpH, 8) }}
        className="absolute rounded border border-primary/60 bg-primary/8"
      />
    </div>
  );
}
