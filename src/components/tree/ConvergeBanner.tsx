import { useEffect, useMemo, useState } from "react";
import { GitMerge, Loader2, X, Check, AlertCircle, Sparkles, Clock, CheckCircle2, XCircle, ChevronRight } from "lucide-react";
import { mergeRequestsApi, personsApi } from "@/lib/api";
import { useAuthStore, useFamilyTreeStore } from "@/lib/store";
import { CrossTreeMatch, MergeRequest } from "@/lib/types";

type Step = "detecting" | "found" | "not_found" | "requesting" | "requested" | "done";
type Tab = "new" | "history";

function confidenceBadge(c: number) {
  if (c >= 0.85) return "bg-emerald-500/15 text-emerald-400 border-emerald-500/20";
  if (c >= 0.65) return "bg-amber-500/15 text-amber-400 border-amber-500/20";
  return "bg-blue-500/15 text-blue-400 border-blue-500/20";
}

function statusBadge(status: MergeRequest["status"]) {
  if (status === "approved") return { icon: CheckCircle2, label: "Approuvée", cls: "text-emerald-400" };
  if (status === "rejected") return { icon: XCircle, label: "Refusée", cls: "text-destructive" };
  return { icon: Clock, label: "En attente", cls: "text-amber-400" };
}

interface Props {
  forceOpen?: boolean;
  onForceOpenHandled?: () => void;
  preloadedMatches?: CrossTreeMatch[];
}

export function ConvergeBanner({ forceOpen, onForceOpenHandled, preloadedMatches }: Props = {}) {
  const { treeAccesses, activeTreeId, personId, userId } = useAuthStore();
  const { tree } = useFamilyTreeStore();

  const [open, setOpen] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [step, setStep] = useState<Step>("detecting");
  const [matches, setMatches] = useState<CrossTreeMatch[]>([]);
  const [selectedMatch, setSelectedMatch] = useState<CrossTreeMatch | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("new");
  const [myRequests, setMyRequests] = useState<MergeRequest[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  const activeAccess = treeAccesses.find((t) => t.treeId === activeTreeId);
  const ownedOther = useMemo(
    () => treeAccesses.find((t) => t.role === "owner" && t.treeId !== activeTreeId),
    [treeAccesses, activeTreeId],
  );
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

  useEffect(() => {
    // Recharger l'historique uniquement quand l'onglet est sélectionné manuellement
    // (handleOpen le pré-charge déjà en cas de demande pending)
    if (!open || tab !== "history" || myRequests.length > 0) return;
    setLoadingHistory(true);
    mergeRequestsApi.listAll()
      .then((reqs) => {
        setMyRequests(reqs.filter((r) => r.requestedByUserId === userId));
      })
      .catch(() => {})
      .finally(() => setLoadingHistory(false));
  }, [open, tab, userId]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!shouldShowPill && !open) return null;

  async function handleOpen(injectedMatches?: CrossTreeMatch[]) {
    setStep("detecting");
    setMatches([]);
    setSelectedMatch(null);
    setError(null);
    setTab("new");
    setOpen(true);

    // Vérifier s'il existe déjà une demande pending pour cet arbre source
    if (ownedTree) {
      try {
        const existing = await mergeRequestsApi.listAll();
        const hasPending = existing.some(
          (r) => r.sourceTreeId === ownedTree.treeId && r.status === "pending"
        );
        if (hasPending) {
          setMyRequests(existing.filter((r) => r.requestedByUserId === userId));
          setTab("history");
          setStep("not_found"); // reset step (tab "history" ne l'utilise pas)
          return;
        }
      } catch {
        // En cas d'erreur, continuer le flux normal
      }
    }

    const preloaded = injectedMatches ?? preloadedMatches;
    if (preloaded && preloaded.length > 0) {
      setMatches(preloaded);
      setSelectedMatch(preloaded[0]);
      setStep("found");
      return;
    }

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
    if (step !== "requesting") setOpen(false);
  }

  async function handleRequestMerge() {
    if (!selectedMatch || !ownedTree) return;
    setStep("requesting");
    setError(null);
    try {
      await mergeRequestsApi.create({
        sourceTreeId: ownedTree.treeId,
        targetTreeId: selectedMatch.treeId,
        sourcePersonId: personId ?? undefined,
        targetPersonId: selectedMatch.personId,
      });
      setStep("requested");
    } catch (e: unknown) {
      const detail = (e as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      setError(detail ?? "La demande a échoué. Réessayez.");
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
              onClick={() => handleOpen()}
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
              {step !== "requesting" && (
                <button
                  onClick={handleClose}
                  className="grid size-7 place-items-center rounded-lg text-muted-foreground transition-colors hover:bg-muted"
                >
                  <X className="size-4" />
                </button>
              )}
            </div>

            {/* Tabs */}
            {step !== "requesting" && (
              <div className="flex border-b border-border">
                <button
                  onClick={() => setTab("new")}
                  className={`flex-1 py-2.5 text-sm font-medium transition-colors ${tab === "new" ? "border-b-2 border-primary text-foreground" : "text-muted-foreground hover:text-foreground"}`}
                >
                  Nouvelle demande
                </button>
                <button
                  onClick={() => setTab("history")}
                  className={`flex-1 py-2.5 text-sm font-medium transition-colors ${tab === "history" ? "border-b-2 border-primary text-foreground" : "text-muted-foreground hover:text-foreground"}`}
                >
                  Demandes en cours
                </button>
              </div>
            )}

            {/* ── Tab: Nouvelle demande ── */}
            {tab === "new" && (
              <>
                {step === "detecting" && (
                  <div className="flex flex-col items-center gap-3 px-6 py-10 text-center">
                    <Loader2 className="size-6 animate-spin text-primary" />
                    <p className="text-sm text-muted-foreground">Recherche de votre fiche…</p>
                  </div>
                )}

                {step === "found" && selectedMatch && (
                  <div className="space-y-4 px-5 py-5">
                    <div className="flex items-start gap-2.5">
                      <Sparkles className="size-4 shrink-0 text-primary mt-0.5" />
                      <p className="text-sm text-muted-foreground">
                        Votre fiche a été trouvée dans un autre arbre.
                      </p>
                    </div>

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
                      Une demande sera envoyée aux membres de « {selectedMatch.treeName} ».
                      Dès qu'un d'eux l'approuve, votre arbre « {ownedTree?.treeName} » y sera intégré.
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
                        onClick={handleRequestMerge}
                        className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-primary py-2.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
                      >
                        <GitMerge className="size-4" /> Envoyer la demande
                      </button>
                    </div>
                  </div>
                )}

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

                {step === "requesting" && (
                  <div className="flex flex-col items-center gap-3 px-6 py-10 text-center">
                    <Loader2 className="size-6 animate-spin text-primary" />
                    <p className="text-sm text-muted-foreground">Envoi de la demande…</p>
                  </div>
                )}

                {step === "requested" && (
                  <div className="flex flex-col items-center gap-4 px-6 py-8 text-center">
                    <div className="grid size-12 place-items-center rounded-full bg-primary/10">
                      <Check className="size-6 text-primary" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-foreground">Demande envoyée !</p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        Les membres de « {selectedMatch?.treeName} » recevront une notification.
                        La fusion sera effectuée dès qu'un d'eux approuve.
                      </p>
                    </div>
                    <button
                      onClick={() => { setTab("history"); setStep("detecting"); }}
                      className="flex items-center gap-1.5 text-sm text-primary hover:underline"
                    >
                      Voir le statut <ChevronRight className="size-3.5" />
                    </button>
                    <button
                      onClick={() => { setOpen(false); setDismissed(true); }}
                      className="rounded-xl bg-primary px-6 py-2.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
                    >
                      Fermer
                    </button>
                  </div>
                )}

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
              </>
            )}

            {/* ── Tab: Demandes en cours ── */}
            {tab === "history" && (
              <div className="px-5 py-5 space-y-3 max-h-80 overflow-y-auto">
                {loadingHistory ? (
                  <div className="flex justify-center py-6">
                    <Loader2 className="size-5 animate-spin text-primary" />
                  </div>
                ) : myRequests.length === 0 ? (
                  <div className="flex flex-col items-center gap-2 py-8 text-center">
                    <GitMerge className="size-6 text-muted-foreground/50" />
                    <p className="text-sm text-muted-foreground">Aucune demande envoyée.</p>
                  </div>
                ) : (
                  myRequests.map((req) => {
                    const { icon: Icon, label, cls } = statusBadge(req.status);
                    return (
                      <div key={req.id} className="rounded-xl border border-border px-4 py-3 space-y-1">
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-sm font-medium text-foreground truncate">
                            {req.sourceTreeName ?? "Mon arbre"} → {req.targetTreeName ?? "Arbre cible"}
                          </p>
                          <div className={`flex items-center gap-1 shrink-0 text-xs font-medium ${cls}`}>
                            <Icon className="size-3.5" />
                            {label}
                          </div>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {new Date(req.createdAt).toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" })}
                        </p>
                      </div>
                    );
                  })
                )}
              </div>
            )}

          </div>
        </div>
      )}
    </>
  );
}
