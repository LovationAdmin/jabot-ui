import { useState, useRef, useEffect } from "react";
import { ChevronDown, Filter } from "lucide-react";
import { SurnameStat } from "@/lib/surnameColors";
import { cn } from "@/lib/utils";

interface SurnameLegendProps {
  stats: SurnameStat[];
  activeFilter: Set<string>;
  onToggle: (normalized: string) => void;
  onClear: () => void;
}

export function SurnameLegend({ stats, activeFilter, onToggle, onClear }: SurnameLegendProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  if (stats.length <= 1) return null;

  const filtering = activeFilter.size > 0;
  const label = filtering
    ? [...activeFilter].map((n) => stats.find((s) => s.normalized === n)?.surname ?? n).join(", ")
    : "Noms de famille";

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className={cn(
          "flex h-8 items-center gap-1.5 rounded-lg border px-3 text-sm transition-colors",
          filtering
            ? "border-primary bg-primary/10 text-primary"
            : "border-border bg-background text-muted-foreground hover:bg-muted hover:text-foreground",
        )}
      >
        <Filter className="size-3.5 shrink-0" />
        <span className="max-w-[120px] truncate hidden sm:block">{label}</span>
        <ChevronDown className={cn("size-3.5 shrink-0 transition-transform", open && "rotate-180")} />
      </button>

      {open && (
        <div className="absolute right-0 top-full z-50 mt-1 min-w-[180px] rounded-xl border border-border bg-card shadow-lg">
          {filtering && (
            <button
              onClick={() => { onClear(); setOpen(false); }}
              className="flex w-full items-center gap-2 border-b border-border px-3 py-2 text-xs font-medium text-primary hover:bg-muted/60"
            >
              × Tout afficher
            </button>
          )}
          <div className="max-h-60 overflow-y-auto py-1">
            {stats.map((s) => {
              const checked = activeFilter.has(s.normalized);
              return (
                <label
                  key={s.normalized}
                  className="flex cursor-pointer items-center gap-2.5 px-3 py-2 text-sm hover:bg-muted/60"
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => onToggle(s.normalized)}
                    className="size-3.5 accent-primary"
                  />
                  <span
                    style={{ backgroundColor: s.color.band }}
                    className="size-2.5 shrink-0 rounded-full"
                  />
                  <span className="flex-1 text-foreground">{s.surname || "—"}</span>
                  <span className="text-xs text-muted-foreground">{s.count}</span>
                </label>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
