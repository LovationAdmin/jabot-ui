import { SurnameStat } from "@/lib/surnameColors";

interface SurnameLegendProps {
  stats: SurnameStat[];
  activeFilter: Set<string>;
  onToggle: (normalized: string) => void;
  onClear: () => void;
  /** When true renders as an inline flex row (for header). Default: overlay (absolute bottom-right). */
  inline?: boolean;
}

export function SurnameLegend({ stats, activeFilter, onToggle, onClear, inline }: SurnameLegendProps) {
  if (stats.length <= 1) return null;

  const filtering = activeFilter.size > 0;

  const pills = (
    <>
      {filtering && (
        <button
          onClick={onClear}
          className="flex shrink-0 items-center gap-1 rounded-full border border-primary/60 bg-primary/10 px-2 py-1 text-xs font-medium text-primary transition-colors hover:bg-primary/20"
        >
          × Tout
        </button>
      )}
      {stats.map((s) => {
        const active = activeFilter.has(s.normalized);
        return (
          <button
            key={s.normalized}
            onClick={() => onToggle(s.normalized)}
            className={[
              "flex shrink-0 items-center gap-1 rounded-full border px-2 py-1 text-xs transition-colors",
              active
                ? "border-primary bg-primary/10 text-primary"
                : "border-border/60 bg-background/80 text-muted-foreground hover:bg-muted",
              filtering && !active ? "opacity-40" : "",
            ]
              .filter(Boolean)
              .join(" ")}
          >
            <span style={{ backgroundColor: s.color.band }} className="size-2 rounded-full shrink-0" />
            {s.surname || "—"}
            {s.count > 1 && <span className="opacity-60">{s.count}</span>}
          </button>
        );
      })}
    </>
  );

  if (inline) {
    return <div className="flex items-center gap-1.5 overflow-x-auto">{pills}</div>;
  }

  return (
    <div className="pointer-events-none absolute bottom-4 right-4 z-20 flex flex-wrap justify-end gap-1.5 max-w-[60vw]">
      {pills}
    </div>
  );
}
