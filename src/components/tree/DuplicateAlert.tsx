import { useNavigate } from "@tanstack/react-router";
import { Copy, X } from "lucide-react";
import { useFamilyTreeStore } from "@/lib/store";

/**
 * Alerte in-app : surface les doublons potentiels a examiner.
 *
 * Pilule discrete en haut du canvas (meme langage visuel que les autres
 * bannieres). Apparait des qu'au moins un doublon est detecte dans l'arbre
 * actif et tant que l'utilisateur ne l'a pas ignoree. Le compteur est aussi
 * repris en pastille sur le menu compte (indicateur persistant).
 */
export function DuplicateAlert() {
  const navigate = useNavigate();
  const { duplicateCount, duplicatesDismissed, dismissDuplicates } = useFamilyTreeStore();

  if (duplicateCount <= 0 || duplicatesDismissed) return null;

  return (
    <div className="pointer-events-none absolute inset-x-0 top-0 z-20 flex justify-center pt-3 px-4">
      <div className="pointer-events-auto glass flex items-center gap-2 rounded-full border border-border px-3 py-1.5 shadow-float">
        <span className="grid size-5 shrink-0 place-items-center rounded-full bg-amber-500/15 text-amber-600">
          <Copy className="size-3" />
        </span>
        <span className="text-sm text-foreground">
          {duplicateCount} doublon{duplicateCount > 1 ? "s" : ""} potentiel{duplicateCount > 1 ? "s" : ""} a examiner
        </span>
        <button
          onClick={() => { dismissDuplicates(); navigate({ to: "/account/duplicates" }); }}
          className="rounded-full bg-primary px-3 py-1 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
        >
          Examiner
        </button>
        <button
          onClick={dismissDuplicates}
          className="grid size-6 place-items-center rounded-full text-muted-foreground transition-colors hover:bg-muted"
          aria-label="Ignorer"
        >
          <X className="size-3.5" />
        </button>
      </div>
    </div>
  );
}
