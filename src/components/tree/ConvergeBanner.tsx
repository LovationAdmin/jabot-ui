import { useEffect, useMemo, useState } from "react";
import { GitMerge, Loader2, X, Check, AlertCircle, Sparkles } from "lucide-react";
import { treesApi, authApi, personsApi } from "@/lib/api";
import { useAuthStore, useFamilyTreeStore } from "@/lib/store";
import { CrossTreeMatch } from "@/lib/types";

/**
 * Dialog "Relier mon arbre" — flux simplifié.
 *
 * 1. Ouverture → détection automatique de la fiche dans l'autre arbre
 * 2. Affichage de la fiche trouvée + confirmation en un clic
 * 3. Si aucune correspondance : message + possibilité de choisir manuellement
 */

type Step = "detecting" | "found" | "not_found" | "merging" | "done";

function confidenceBadge(c: number) {
  if (c >= 0.85) return "bg-emerald-500/15 text-emerald-400 border-emerald-500/20";
  if (c >= 0.65) return "bg-amber-500/15 text-amber-400 border-amber-500/20";
  return "bg-blue-500/15 text-blue-400 border-blue-500/20";
}

interface Props {
  forceOpen?: boolean;
  onForceOpenHandled?: () => void;
}

export function ConvergeBanner({ forceOpen, onForceOpenHandled }: Props = {}) {
  const { treeAccesses, activeTreeId, personId, setActiveTree, setTreeAccesses } = useAuthStore();
  const { tree, loadTree, refreshDuplicateCount } = useFamilyTreeStore();

  const [open, setOpen] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [step, setStep] = useState<Step>("detecting");
  const [matches, setMatches] = useState<CrossTreeMatch[]>([]);
  const [selectedMatch, setSelectedMatch] = useState<CrossTreeMatch | null>(null);
  const [error, setError] = useState<string | null>(null);

  const activeAccess = treeAccesses.find((t) => t.treeId === activeTreeId);
  const ownedOther = useMemo(
    () => treeAccesses.find((t) => t.role === "owner" && t.treeId !== activeTreeId),
    [treeAccesses, activeTreeId],
  );
  // L'arbre que l'utilisateur possède (source de la convergence)
  const ownedTree = useMemo(
    () => ownedOther ?? treeAccesses.find((t) => t.role === "owner"),
    [ownedOther, treeAccesses],
  );

  const shouldShowPill =
    !dismissed &&
    activeAccess?.role === "visitor" &&
    !!ownedOther &&
    tree.persons.length > 0;

  useEffect(() => {
    if (forceOpen) {
      handleOpen();
      onForceOpenHandled?.();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [forceOpen]);

  if (!shouldShowPill && !open) return null;

  async function handleOpen() {
    setStep("detecting");
    setMatches([]);
    setSelectedMatch(null);
    setError(null);
    setOpen(true);

    if (!personId) {
      setStep("not_found");
      return;
    }
    try {
      const results = await personsApi.getCrossTreeSuggestions(personId);
      if (results.length > 0) {
        setMatches(results);
        setSelectedMatch(results[0]);
        setStep("found");
      } else {
        setStep("not_found");
      }
    } catch {
      setStep("not_found");
    }
  }

  function handleClose() {
    if (step !== "merging") setOpen(false);
  }

  async function handleConverge() {
    if (!selectedMatch || !ownedTree) return;
    setStep("merging");
    setError(null);
    try {
      await treesApi.converge(selectedMatch.treeId, {
        sourceTreeId: ownedTree.treeId,
        sourcePersonId: personId ?? undefined,
        targetPersonId: selectedMatch.personId,
        additionalMergePairs: [],
      });
      const me = await authApi.me();
      setTreeAccesses(me.treeAccesses, selectedMatch.treeId);
      setActiveTree(selectedMatch.treeId);
      await loadTree();
      await refreshDuplicateCount();
      setStep("done");
    } catch (e: unknown) {
      const detail = (e as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      setError(detail ?? "La fusion a échoué. Réessayez.");
      setStep("found");
    }
  }

  return (
    <>
      {/* Pilule discrète (visiteur uniquement) */}
      {!open && shouldShowPill && (
        <div className="pointer-events-none absolute inset-x-0 top-0 z-20 flex justify-center pt-3 px-4">
          <div className="pointer-events-auto glass flex items-center gap-2 rounded-full border border-border px-3 py-1.5 shadow-float">
            <GitMerge className="size-3.5 shrink-0 text-primary" />
            <span className="hidden text-sm text-muted-foreground sm:block">
              Votre famille ? Reliez votre arbre à celui-ci
            </span>
            <button
              onClick={handleOpen}
              className="rounded-full bg-primary px-3 py-1 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
            >
              Relier
            </button>
            <button
              onClick={() => setDismissed(true)}
              className="grid size-6 place-items-center rounded-full text-muted-foreground transition-colors hover:bg-muted"
              aria-label="Ignorer"
            >
              <X className="size-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* Dialog */}
      {open && (
        <div className="fixed inset-0 z-50 flex items-end justify-center p-4 sm:items-center">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={handleClose} />
          <div className="glass relative w-full max-w-sm rounded-2xl border border-border shadow-2xl overflow-hidden">

            {/* Header */}
            <div className="flex items-center gap-3 border-b border-border px-5 py-4">
              <div className="grid size-8 place-items-center rounded-lg bg-primary text-primary-foreground">
                <GitMerge className="size-4" />
              </div>
              <div className="min-w-0 flex-1">
                <h2 className="font-semibold leading-tight text-foreground">Relier mon arbre</h2>
              </div>
              {step !== "merging" && (
                <button
                  onClick={handleClose}
                  className="grid size-7 place-items-center rounded-lg text-muted-foreground transition-colors hover:bg-muted"
                >
                  <X className="size-4" />
                </button>
              )}
            </div>

            {/* Détection en cours */}
            {step === "detecting" && (
              <div className="flex flex-col items-center gap-3 px-6 py-10 text-center">
                <Loader2 className="size-6 animate-spin text-primary" />
                <p className="text-sm text-muted-foreground">Recherche de votre fiche…</p>
              </div>
            )}

            {/* Fiche trouvée */}
            {step === "found" && selectedMatch && (
              <div className="space-y-4 px-5 py-5">
                <div className="flex items-start gap-2.5">
                  <Sparkles className="size-4 shrink-0 text-primary mt-0.5" />
                  <p className="text-sm text-muted-foreground">
                    Votre fiche a été trouvée dans un autre arbre.
                  </p>
                </div>

                {/* Carte de la fiche */}
                <div className="rounded-xl border border-primary/20 bg-primary/5 px-4 py-3 space-y-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-base font-semibold text-foreground">
                      {selectedMatch.firstName}{selectedMatch.lastName ? ` ${selectedMatch.lastName}` : ""}
                    </span>
                    <span className={`shrink-0 rounded-full border px-2 py-0.5 text-xs font-medium ${confidenceBadge(selectedMatch.confidence)}`}>
                      {Math.round(selectedMatch.confidence * 100)}%
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground">{selectedMatch.treeName}</p>
                  {selectedMatch.birthDate && (
                    <p className="text-xs text-muted-foreground">
                      Né(e) le {new Date(selectedMatch.birthDate).toLocaleDateString("fr-FR")}
                    </p>
                  )}
                  {selectedMatch.matchReasons.length > 0 && (
                    <p className="text-xs text-muted-foreground">{selectedMatch.matchReasons[0]}</p>
                  )}
                </div>

                {/* Autres correspondances */}
                {matches.length > 1 && (
                  <div className="space-y-1.5">
                    <p className="text-xs text-muted-foreground">Autres correspondances</p>
                    {matches.slice(1).map((m) => (
                      <button
                        key={m.personId}
                        onClick={() => setSelectedMatch(m)}
                        className={`w-full flex items-center justify-between gap-2 rounded-xl border px-3 py-2 text-left transition-colors ${selectedMatch.personId === m.personId ? "border-primary bg-primary/5" : "border-border hover:bg-muted"}`}
                      >
                        <div>
                          <span className="text-sm text-foreground">{m.firstName}{m.lastName ? ` ${m.lastName}` : ""}</span>
                          <span className="ml-1.5 text-xs text-muted-foreground">· {m.treeName}</span>
                        </div>
                        <span className={`shrink-0 rounded-full border px-2 py-0.5 text-xs font-medium ${confidenceBadge(m.confidence)}`}>
                          {Math.round(m.confidence * 100)}%
                        </span>
                      </button>
                    ))}
                  </div>
                )}

                <p className="text-xs text-muted-foreground">
                  Votre arbre « {ownedTree?.treeName} » sera intégré à « {selectedMatch.treeName} ».
                  Cette action est définitive.
                </p>

                {error && (
                  <p className="rounded-xl bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>
                )}

                <div className="flex gap-2">
                  <button
                    onClick={handleClose}
                    className="flex-1 rounded-xl border border-border py-2.5 text-sm text-muted-foreground transition-colors hover:bg-muted"
                  >
                    Annuler
                  </button>
                  <button
                    onClick={handleConverge}
                    className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-primary py-2.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
                  >
                    <Check className="size-4" /> Confirmer
                  </button>
                </div>
              </div>
            )}

            {/* Aucune correspondance */}
            {step === "not_found" && (
              <div className="space-y-4 px-5 py-5">
                <div className="flex items-start gap-2.5">
                  <AlertCircle className="size-4 shrink-0 text-muted-foreground mt-0.5" />
                  <p className="text-sm text-muted-foreground">
                    Aucune fiche commune n'a été trouvée automatiquement.
                    Demandez à un membre de l'autre arbre de vous inviter.
                  </p>
                </div>
                <button
                  onClick={handleClose}
                  className="w-full rounded-xl border border-border py-2.5 text-sm text-muted-foreground transition-colors hover:bg-muted"
                >
                  Fermer
                </button>
              </div>
            )}

            {/* Fusion en cours */}
            {step === "merging" && (
              <div className="flex flex-col items-center gap-3 px-6 py-10 text-center">
                <Loader2 className="size-6 animate-spin text-primary" />
                <p className="text-sm text-muted-foreground">Fusion en cours…</p>
              </div>
            )}

            {/* Succès */}
            {step === "done" && (
              <div className="flex flex-col items-center gap-3 px-6 py-8 text-center">
                <div className="grid size-12 place-items-center rounded-full bg-emerald-500/15">
                  <Check className="size-6 text-emerald-500" />
                </div>
                <p className="text-sm font-medium text-foreground">Arbres reliés avec succès !</p>
                <button
                  onClick={() => { setOpen(false); setDismissed(true); }}
                  className="mt-2 rounded-xl bg-primary px-6 py-2.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
                >
                  Continuer
                </button>
              </div>
            )}

          </div>
        </div>
      )}
    </>
  );
}
