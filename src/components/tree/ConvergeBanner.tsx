import { useMemo, useState } from "react";
import { GitMerge, Loader2, X, Check, ChevronRight, Users, AlertCircle } from "lucide-react";
import { treesApi, authApi } from "@/lib/api";
import { useAuthStore, useFamilyTreeStore } from "@/lib/store";
import { CrossTreeMatchPair } from "@/lib/types";

/**
 * Bannière de convergence d'arbres — flux multi-étapes.
 *
 * Étape 1 : L'utilisateur identifie SA fiche dans l'arbre cible.
 * Étape 2 : Scan pré-convergence — détecte les fiches communes.
 * Étape 3 : L'utilisateur confirme / rejette les paires proposées.
 * Étape 4 : Convergence finale (atomique).
 */

type Step = "identity" | "scanning" | "review" | "confirm";

function confidenceBadge(c: number) {
  if (c >= 0.85) return "bg-emerald-500/15 text-emerald-400";
  if (c >= 0.65) return "bg-amber-500/15 text-amber-400";
  return "bg-blue-500/15 text-blue-400";
}

function personLabel(firstName: string, lastName?: string | null) {
  return [firstName, lastName].filter(Boolean).join(" ");
}

export function ConvergeBanner() {
  const { treeAccesses, activeTreeId, personId, setActiveTree, setTreeAccesses } = useAuthStore();
  const { tree, loadTree, refreshDuplicateCount } = useFamilyTreeStore();

  const [open, setOpen] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [step, setStep] = useState<Step>("identity");

  // Step 1
  const [targetPersonId, setTargetPersonId] = useState<string>("");

  // Step 3 — pairs from scan; confirmed = true (merge), false (skip)
  const [pairs, setPairs] = useState<CrossTreeMatchPair[]>([]);
  const [confirmed, setConfirmed] = useState<Record<string, boolean>>({});
  const [unmatchedCount, setUnmatchedCount] = useState(0);

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const activeAccess = treeAccesses.find((t) => t.treeId === activeTreeId);
  const ownedOther = useMemo(
    () => treeAccesses.find((t) => t.role === "owner" && t.treeId !== activeTreeId),
    [treeAccesses, activeTreeId],
  );

  const shouldShow =
    !dismissed &&
    activeAccess?.role === "visitor" &&
    !!ownedOther &&
    tree.persons.length > 0;

  if (!shouldShow) return null;

  function handleOpen() {
    setStep("identity");
    setTargetPersonId("");
    setPairs([]);
    setConfirmed({});
    setError(null);
    setOpen(true);
  }

  function handleClose() {
    if (!busy) setOpen(false);
  }

  // Step 1 → 2 : scan
  async function handleScan() {
    if (!targetPersonId || !ownedOther || !activeTreeId) return;
    setBusy(true);
    setError(null);
    setStep("scanning");
    try {
      const result = await treesApi.preScan(activeTreeId, ownedOther.treeId);
      // Exclude the identity pair (already confirmed via the dropdown)
      const filtered = result.proposedPairs.filter(
        (p) => p.targetPersonId !== targetPersonId,
      );
      setPairs(filtered);
      setUnmatchedCount(result.unmatchedSourceCount);
      // Pre-confirm all pairs with confidence ≥ 0.75
      const defaults: Record<string, boolean> = {};
      for (const p of filtered) {
        defaults[p.sourcePersonId] = p.confidence >= 0.75;
      }
      setConfirmed(defaults);
      setStep(filtered.length > 0 ? "review" : "confirm");
    } catch {
      // If scan fails, skip to confirm step (convergence still works without extras)
      setPairs([]);
      setStep("confirm");
    } finally {
      setBusy(false);
    }
  }

  // Step 3 → 4
  function handleSkipToConfirm() {
    setStep("confirm");
  }

  function togglePair(sourcePersonId: string) {
    setConfirmed((prev) => ({ ...prev, [sourcePersonId]: !prev[sourcePersonId] }));
  }

  // Final convergence
  async function handleConverge() {
    if (!ownedOther || !activeTreeId) return;
    setBusy(true);
    setError(null);
    try {
      const additionalMergePairs = pairs
        .filter((p) => confirmed[p.sourcePersonId])
        .map((p) => ({ sourcePersonId: p.sourcePersonId, targetPersonId: p.targetPersonId }));

      await treesApi.converge(activeTreeId, {
        sourceTreeId: ownedOther.treeId,
        sourcePersonId: personId ?? undefined,
        targetPersonId,
        additionalMergePairs,
      });
      const me = await authApi.me();
      setTreeAccesses(me.treeAccesses, activeTreeId);
      setActiveTree(activeTreeId);
      await loadTree();
      await refreshDuplicateCount();
      setOpen(false);
      setDismissed(true);
    } catch (e: unknown) {
      const detail = (e as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      setError(detail ?? "La fusion a échoué. Réessayez.");
    } finally {
      setBusy(false);
    }
  }

  const confirmedCount = Object.values(confirmed).filter(Boolean).length;

  return (
    <>
      {/* Pilule discrète */}
      {!open && (
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
              Fusionner
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

      {/* Dialogue */}
      {open && (
        <div className="fixed inset-0 z-50 flex items-end justify-center p-4 sm:items-center">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={handleClose} />
          <div className="glass relative w-full max-w-md rounded-2xl border border-border shadow-2xl overflow-hidden">

            {/* Header */}
            <div className="flex items-center gap-3 border-b border-border px-6 py-4">
              <div className="grid size-8 place-items-center rounded-lg bg-primary text-primary-foreground">
                <GitMerge className="size-4" />
              </div>
              <div className="min-w-0 flex-1">
                <h2 className="font-semibold leading-tight text-foreground">Relier mon arbre</h2>
                <p className="text-xs text-muted-foreground truncate">
                  Vers « {activeAccess?.treeName} »
                </p>
              </div>
              <button
                onClick={handleClose}
                className="grid size-7 place-items-center rounded-lg text-muted-foreground transition-colors hover:bg-muted"
              >
                <X className="size-4" />
              </button>
            </div>

            {/* ── Étape 1 : identité ─────────────────────────────── */}
            {step === "identity" && (
              <div className="space-y-4 px-6 py-5">
                <p className="text-sm text-muted-foreground">
                  Identifiez votre fiche dans cet arbre. Votre arbre personnel
                  {" "}« {ownedOther?.treeName} » y sera rapatrié et vous en deviendrez membre.
                </p>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground">
                    Ma fiche dans cet arbre
                  </label>
                  <select
                    value={targetPersonId}
                    onChange={(e) => setTargetPersonId(e.target.value)}
                    className="w-full rounded-xl border border-border bg-background px-4 py-3 text-sm text-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-ring"
                  >
                    <option value="">— Choisir une personne —</option>
                    {[...tree.persons]
                      .sort((a, b) => a.firstName.localeCompare(b.firstName))
                      .map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.firstName} {p.lastName}
                        </option>
                      ))}
                  </select>
                </div>
                {error && (
                  <p className="rounded-xl bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>
                )}
                <button
                  disabled={!targetPersonId || busy}
                  onClick={handleScan}
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-3 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
                >
                  Continuer
                  <ChevronRight className="size-4" />
                </button>
              </div>
            )}

            {/* ── Étape 2 : scan en cours ─────────────────────────── */}
            {step === "scanning" && (
              <div className="flex flex-col items-center gap-3 px-6 py-10 text-center">
                <Loader2 className="size-7 animate-spin text-primary" />
                <p className="text-sm text-muted-foreground">
                  Recherche de correspondances entre les deux arbres…
                </p>
              </div>
            )}

            {/* ── Étape 3 : revue des paires ─────────────────────── */}
            {step === "review" && (
              <div className="flex flex-col gap-0">
                <div className="px-6 pt-5 pb-3">
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <div className="flex items-center gap-2">
                      <Users className="size-4 text-primary" />
                      <span className="text-sm font-medium text-foreground">
                        {pairs.length} correspondance{pairs.length > 1 ? "s" : ""} détectée{pairs.length > 1 ? "s" : ""}
                      </span>
                    </div>
                    <button
                      onClick={() => {
                        const all: Record<string, boolean> = {};
                        for (const p of pairs) all[p.sourcePersonId] = true;
                        setConfirmed(all);
                      }}
                      className="text-xs font-medium text-primary hover:underline"
                    >
                      Tout confirmer
                    </button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Ces fiches semblent être les mêmes personnes dans les deux arbres.
                    Cochez celles à fusionner.
                  </p>
                </div>

                <div className="max-h-64 overflow-y-auto divide-y divide-border px-4">
                  {pairs.map((pair) => {
                    const isOn = !!confirmed[pair.sourcePersonId];
                    return (
                      <button
                        key={pair.sourcePersonId}
                        onClick={() => togglePair(pair.sourcePersonId)}
                        className="flex w-full items-center gap-3 py-3 text-left transition-colors hover:bg-muted/40"
                      >
                        {/* Checkbox visuel */}
                        <div className={`grid size-5 shrink-0 place-items-center rounded border transition-colors ${isOn ? "bg-primary border-primary" : "border-border"}`}>
                          {isOn && <Check className="size-3 text-primary-foreground" />}
                        </div>

                        {/* Noms */}
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="text-sm font-medium text-foreground truncate">
                              {personLabel(pair.sourceFirstName, pair.sourceLastName)}
                            </span>
                            <span className="text-muted-foreground text-xs">→</span>
                            <span className="text-sm font-medium text-foreground truncate">
                              {personLabel(pair.targetFirstName, pair.targetLastName)}
                            </span>
                          </div>
                          {pair.matchReasons.length > 0 && (
                            <p className="text-xs text-muted-foreground truncate mt-0.5">
                              {pair.matchReasons[0]}
                            </p>
                          )}
                        </div>

                        {/* Badge confiance */}
                        <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${confidenceBadge(pair.confidence)}`}>
                          {Math.round(pair.confidence * 100)}%
                        </span>
                      </button>
                    );
                  })}
                </div>

                {unmatchedCount > 0 && (
                  <div className="flex items-start gap-2 mx-4 mt-2 rounded-xl bg-muted/50 px-3 py-2">
                    <AlertCircle className="size-3.5 shrink-0 text-muted-foreground mt-0.5" />
                    <p className="text-xs text-muted-foreground">
                      {unmatchedCount} fiche{unmatchedCount > 1 ? "s" : ""} de votre arbre sans correspondance
                      {unmatchedCount > 1 ? " seront ajoutées" : " sera ajoutée"} à cet arbre telle{unmatchedCount > 1 ? "s" : ""} quelle{unmatchedCount > 1 ? "s" : ""}.
                    </p>
                  </div>
                )}

                {error && (
                  <p className="mx-6 mt-2 rounded-xl bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>
                )}

                <div className="flex gap-2 px-6 py-4">
                  <button
                    onClick={() => { setConfirmed({}); setStep("confirm"); }}
                    className="flex-1 rounded-xl border border-border py-2.5 text-sm text-muted-foreground transition-colors hover:bg-muted"
                  >
                    Aucune fusion
                  </button>
                  <button
                    onClick={handleSkipToConfirm}
                    className="flex-1 flex items-center justify-center gap-1.5 rounded-xl bg-primary py-2.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
                  >
                    Confirmer ({confirmedCount})
                    <ChevronRight className="size-4" />
                  </button>
                </div>
              </div>
            )}

            {/* ── Étape 4 : confirmation finale ─────────────────── */}
            {step === "confirm" && (
              <div className="space-y-4 px-6 py-5">
                <div className="rounded-xl bg-muted/50 px-4 py-3 space-y-1.5 text-sm">
                  <div className="flex justify-between text-foreground">
                    <span className="text-muted-foreground">Arbre source</span>
                    <span className="font-medium">{ownedOther?.treeName}</span>
                  </div>
                  <div className="flex justify-between text-foreground">
                    <span className="text-muted-foreground">Arbre cible</span>
                    <span className="font-medium">{activeAccess?.treeName}</span>
                  </div>
                  {confirmedCount > 0 && (
                    <div className="flex justify-between text-foreground">
                      <span className="text-muted-foreground">Fusions supplémentaires</span>
                      <span className="font-medium">{confirmedCount}</span>
                    </div>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">
                  Cette action est définitive. Vous deviendrez membre de l'arbre cible et votre arbre personnel sera supprimé.
                </p>
                {error && (
                  <p className="rounded-xl bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>
                )}
                <div className="flex gap-2">
                  <button
                    onClick={() => setStep(pairs.length > 0 ? "review" : "identity")}
                    disabled={busy}
                    className="flex-1 rounded-xl border border-border py-2.5 text-sm text-muted-foreground transition-colors hover:bg-muted disabled:opacity-50"
                  >
                    Retour
                  </button>
                  <button
                    disabled={busy}
                    onClick={handleConverge}
                    className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-primary py-2.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
                  >
                    {busy ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />}
                    Confirmer la fusion
                  </button>
                </div>
              </div>
            )}

          </div>
        </div>
      )}
    </>
  );
}
