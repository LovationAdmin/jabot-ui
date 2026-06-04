import { useState } from "react";
import { Sparkles, X, GitMerge, ChevronDown, ChevronUp } from "lucide-react";
import { CrossTreeMatch } from "@/lib/types";

/**
 * Bannière affichée après la création ou modification d'une fiche,
 * si des fiches similaires existent dans d'autres arbres.
 *
 * Props:
 *   matches  – résultats de /persons/{id}/cross-tree-suggestions
 *   onDismiss – callback de fermeture
 */

function confidenceBadge(c: number) {
  if (c >= 0.85) return "bg-emerald-500/15 text-emerald-400 border-emerald-500/20";
  if (c >= 0.65) return "bg-amber-500/15 text-amber-400 border-amber-500/20";
  return "bg-blue-500/15 text-blue-400 border-blue-500/20";
}

interface Props {
  personName: string;
  matches: CrossTreeMatch[];
  onDismiss: () => void;
}

export function CrossTreeSuggestionBanner({ personName, matches, onDismiss }: Props) {
  const [expanded, setExpanded] = useState(false);

  if (!matches.length) return null;

  const best = matches[0];
  const others = matches.slice(1);

  return (
    <div className="rounded-2xl border border-primary/20 bg-primary/5 p-4 space-y-3">
      {/* Header */}
      <div className="flex items-start gap-3">
        <div className="grid size-7 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary mt-0.5">
          <Sparkles className="size-3.5" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-foreground leading-snug">
            « {personName} » existe peut-être dans un autre arbre
          </p>
          <p className="text-xs text-muted-foreground mt-0.5">
            {matches.length} correspondance{matches.length > 1 ? "s" : ""} trouvée{matches.length > 1 ? "s" : ""} sur la plateforme
          </p>
        </div>
        <button
          onClick={onDismiss}
          className="grid size-6 shrink-0 place-items-center rounded-lg text-muted-foreground transition-colors hover:bg-muted"
          aria-label="Ignorer"
        >
          <X className="size-3.5" />
        </button>
      </div>

      {/* Meilleure correspondance */}
      <div className="rounded-xl border border-border bg-background/60 px-3 py-2.5 space-y-1">
        <div className="flex items-center justify-between gap-2">
          <div className="min-w-0">
            <span className="text-sm font-medium text-foreground">
              {best.firstName}{best.lastName ? ` ${best.lastName}` : ""}
            </span>
            <span className="mx-1.5 text-muted-foreground text-xs">·</span>
            <span className="text-xs text-muted-foreground">{best.treeName}</span>
          </div>
          <span className={`shrink-0 rounded-full border px-2 py-0.5 text-xs font-medium ${confidenceBadge(best.confidence)}`}>
            {Math.round(best.confidence * 100)}%
          </span>
        </div>
        {best.matchReasons.length > 0 && (
          <p className="text-xs text-muted-foreground">{best.matchReasons[0]}</p>
        )}
        {best.birthDate && (
          <p className="text-xs text-muted-foreground">
            Né(e) le {new Date(best.birthDate).toLocaleDateString("fr-FR")}
          </p>
        )}
      </div>

      {/* Autres correspondances (repliables) */}
      {others.length > 0 && (
        <>
          <button
            onClick={() => setExpanded((v) => !v)}
            className="flex w-full items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            {expanded ? <ChevronUp className="size-3" /> : <ChevronDown className="size-3" />}
            {expanded ? "Masquer" : `Voir ${others.length} autre${others.length > 1 ? "s" : ""}`}
          </button>
          {expanded && (
            <div className="space-y-1.5">
              {others.map((m) => (
                <div
                  key={m.personId}
                  className="rounded-xl border border-border bg-background/60 px-3 py-2 flex items-center justify-between gap-2"
                >
                  <div className="min-w-0">
                    <span className="text-sm text-foreground">
                      {m.firstName}{m.lastName ? ` ${m.lastName}` : ""}
                    </span>
                    <span className="mx-1.5 text-muted-foreground text-xs">·</span>
                    <span className="text-xs text-muted-foreground">{m.treeName}</span>
                  </div>
                  <span className={`shrink-0 rounded-full border px-2 py-0.5 text-xs font-medium ${confidenceBadge(m.confidence)}`}>
                    {Math.round(m.confidence * 100)}%
                  </span>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* Call to action */}
      <p className="text-xs text-muted-foreground leading-relaxed">
        Si c'est la même personne, vous pouvez la fusionner via{" "}
        <span className="inline-flex items-center gap-0.5 font-medium text-foreground">
          <GitMerge className="size-3" /> Relier mon arbre
        </span>
        {" "}depuis l'arbre concerné.
      </p>
    </div>
  );
}
