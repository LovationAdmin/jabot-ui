import { Trees } from "lucide-react";
import { cn } from "@/lib/utils";

interface TreeTabsProps {
  trees: { id: string; label: string }[];
  activeId: string;
  onSelect: (id: string) => void;
}

/**
 * Barre d'onglets horizontale — une tab par family_tree.
 * Affiché uniquement si l'utilisateur a accès à 2+ arbres.
 */
export function TreeTabs({ trees, activeId, onSelect }: TreeTabsProps) {
  if (trees.length <= 1) return null;

  return (
    <div className="z-20 flex h-10 shrink-0 items-center gap-1 overflow-x-auto border-b border-border bg-card/85 px-3 backdrop-blur-md">
      <Trees className="size-3.5 shrink-0 text-muted-foreground" />
      {trees.map((t) => (
        <button
          key={t.id}
          onClick={() => onSelect(t.id)}
          className={cn(
            "flex h-7 shrink-0 cursor-pointer items-center gap-1.5 rounded-md px-2.5 text-xs font-medium transition-colors select-none",
            t.id === activeId
              ? "bg-primary text-primary-foreground"
              : "text-muted-foreground hover:bg-muted hover:text-foreground",
          )}
        >
          <span className="max-w-[160px] truncate">{t.label}</span>
        </button>
      ))}
    </div>
  );
}
