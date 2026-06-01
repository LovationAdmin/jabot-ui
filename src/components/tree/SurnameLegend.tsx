import { useState } from "react";
import { Tags, ChevronDown, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { SurnameStat } from "@/lib/surnameColors";

interface SurnameLegendProps {
  stats: SurnameStat[];
  // Noms (normalisés) actuellement sélectionnés pour le filtre. Vide = tout visible.
  activeFilter: Set<string>;
  onToggle: (normalized: string) => void;
  onClear: () => void;
}

/**
 * Légende des noms de famille + filtre. Repliable. Cliquer sur un nom le met
 * en filtre (les fiches des autres noms sont estompées sur le canvas) ; on peut
 * cumuler plusieurs noms. Le bouton « Tout afficher » réinitialise le filtre.
 */
export function SurnameLegend({ stats, activeFilter, onToggle, onClear }: SurnameLegendProps) {
  const [open, setOpen] = useState(false);

  if (stats.length <= 1) return null; // un seul nom : aucune distinction utile

  const filtering = activeFilter.size > 0;

  return (
    <div className="pointer-events-none absolute left-4 top-4 z-20 flex max-w-[240px] flex-col items-start">
      <button
        onClick={() => setOpen((o) => !o)}
        className="glass pointer-events-auto flex items-center gap-1.5 rounded-full border border-border/60 px-3 py-1.5 text-xs font-medium text-foreground shadow-float transition-colors hover:bg-muted"
      >
        <Tags className="size-3.5" />
        <span>Noms de famille</span>
        {filtering && (
          <span className="rounded-full bg-primary px-1.5 text-[10px] font-semibold text-primary-foreground">
            {activeFilter.size}
          </span>
        )}
        <ChevronDown className={cn("size-3.5 transition-transform", open && "rotate-180")} />
      </button>

      {open && (
        <div className="glass pointer-events-auto mt-1.5 flex max-h-[50vh] w-[240px] flex-col overflow-hidden rounded-2xl border border-border/60 shadow-float">
          <div className="flex items-center justify-between border-b border-border/50 px-3 py-2">
            <span className="text-[11px] text-muted-foreground">
              {stats.length} noms · cliquez pour filtrer
            </span>
            {filtering && (
              <button
                onClick={onClear}
                className="flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[11px] font-medium text-primary hover:bg-primary/10"
              >
                <X className="size-3" /> Tout
              </button>
            )}
          </div>
          <ul className="flex-1 overflow-y-auto p-1.5">
            {stats.map((s) => {
              const active = activeFilter.has(s.normalized);
              return (
                <li key={s.normalized}>
                  <button
                    onClick={() => onToggle(s.normalized)}
                    className={cn(
                      "flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-xs transition-colors",
                      active ? "bg-primary/10" : "hover:bg-muted",
                      filtering && !active && "opacity-50",
                    )}
                  >
                    <span
                      className="size-3 shrink-0 rounded-full ring-1 ring-black/5"
                      style={{ backgroundColor: s.color.band }}
                    />
                    <span className="flex-1 truncate font-medium text-foreground">
                      {s.surname || "—"}
                    </span>
                    <span className="shrink-0 text-[10px] text-muted-foreground">{s.count}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
