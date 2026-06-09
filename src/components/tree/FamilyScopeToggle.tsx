import { User, Users } from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  showExtended: boolean;
  onChange: (extended: boolean) => void;
  className?: string;
}

/**
 * Bascule « Famille directe / Famille étendue » — segmented control dont les
 * deux libellés restent toujours visibles, sur mobile comme sur desktop.
 */
export function FamilyScopeToggle({ showExtended, onChange, className }: Props) {
  const seg =
    "flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap";
  return (
    <div
      role="group"
      aria-label="Étendue de la famille affichée"
      className={cn(
        "flex items-center rounded-full border border-border bg-background p-0.5",
        className,
      )}
    >
      <button
        type="button"
        onClick={() => onChange(false)}
        aria-pressed={!showExtended}
        title="Afficher uniquement votre famille directe"
        className={cn(
          seg,
          !showExtended
            ? "bg-primary text-primary-foreground shadow-sm"
            : "text-muted-foreground hover:text-foreground",
        )}
      >
        <User className="size-3.5" />
        Directe
      </button>
      <button
        type="button"
        onClick={() => onChange(true)}
        aria-pressed={showExtended}
        title="Afficher la famille étendue (toutes les branches de l'arbre)"
        className={cn(
          seg,
          showExtended
            ? "bg-primary text-primary-foreground shadow-sm"
            : "text-muted-foreground hover:text-foreground",
        )}
      >
        <Users className="size-3.5" />
        Étendue
      </button>
    </div>
  );
}
