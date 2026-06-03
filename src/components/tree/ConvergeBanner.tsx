import { useMemo, useState } from "react";
import { GitMerge, Loader2, X, Check } from "lucide-react";
import { treesApi, authApi } from "@/lib/api";
import { useAuthStore, useFamilyTreeStore } from "@/lib/store";

/**
 * Banniere de convergence d'arbres.
 *
 * Apparait lorsque l'utilisateur consulte un arbre ou il est VISITEUR (sa vraie
 * famille, ou il a ete invite) ALORS qu'il possede par ailleurs son PROPRE arbre
 * (cree lors de l'onboarding). Il peut alors identifier sa fiche dans cet arbre
 * et fusionner son arbre personnel dedans — il devient membre, son arbre perso
 * disparait, et tout son contenu est rapatrie ici.
 */
export function ConvergeBanner() {
  const { treeAccesses, activeTreeId, personId, setActiveTree, setTreeAccesses } = useAuthStore();
  const { tree, loadTree, refreshDuplicateCount } = useFamilyTreeStore();

  const [open, setOpen] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [targetPersonId, setTargetPersonId] = useState<string>("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const activeAccess = treeAccesses.find((t) => t.treeId === activeTreeId);
  // Arbre(s) que l'utilisateur possede et qui NE sont PAS l'arbre actif.
  const ownedOther = useMemo(
    () => treeAccesses.find((t) => t.role === "owner" && t.treeId !== activeTreeId),
    [treeAccesses, activeTreeId],
  );

  // Conditions d'affichage : visiteur de l'arbre actif + proprietaire d'un autre arbre.
  const shouldShow =
    !dismissed &&
    activeAccess?.role === "visitor" &&
    !!ownedOther &&
    tree.persons.length > 0;

  if (!shouldShow) return null;

  async function handleConverge() {
    if (!targetPersonId || !ownedOther || !activeTreeId) return;
    setBusy(true);
    setError(null);
    try {
      await treesApi.converge(activeTreeId, {
        sourceTreeId: ownedOther.treeId,
        sourcePersonId: personId ?? undefined,
        targetPersonId,
      });
      // L'utilisateur est desormais membre de l'arbre cible ; son arbre perso
      // a disparu. On rafraichit l'etat d'auth puis on recharge l'arbre.
      const me = await authApi.me();
      setTreeAccesses(me.treeAccesses, activeTreeId);
      setActiveTree(activeTreeId);
      await loadTree();
      // La convergence cree souvent des doublons (memes proches dans les 2 arbres) :
      // on rafraichit le compteur pour declencher l'alerte d'examen.
      await refreshDuplicateCount();
      setOpen(false);
      setDismissed(true);
    } catch (e: unknown) {
      const detail =
        (e as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      setError(detail ?? "La fusion a echoue. Reessayez.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      {/* Pilule discrete */}
      {!open && (
        <div className="pointer-events-none absolute inset-x-0 top-0 z-20 flex justify-center pt-3 px-4">
          <div className="pointer-events-auto glass flex items-center gap-2 rounded-full border border-border px-3 py-1.5 shadow-float">
            <GitMerge className="size-3.5 shrink-0 text-primary" />
            <span className="hidden text-sm text-muted-foreground sm:block">
              Votre famille ? Reliez votre arbre a celui-ci
            </span>
            <button
              onClick={() => setOpen(true)}
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

      {/* Dialogue de selection */}
      {open && (
        <div className="fixed inset-0 z-50 flex items-end justify-center p-4 sm:items-center">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => !busy && setOpen(false)} />
          <div className="glass relative w-full max-w-md rounded-2xl border border-border shadow-2xl overflow-hidden">
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
                onClick={() => !busy && setOpen(false)}
                className="grid size-7 place-items-center rounded-lg text-muted-foreground transition-colors hover:bg-muted"
              >
                <X className="size-4" />
              </button>
            </div>

            <div className="space-y-4 px-6 py-5">
              <p className="text-sm text-muted-foreground">
                Identifiez votre fiche dans cet arbre. Votre arbre personnel
                {" "}« {ownedOther?.treeName} » y sera rapatrie, et vous en deviendrez membre.
                Cette action est definitive.
              </p>

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">Ma fiche dans cet arbre</label>
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
                onClick={handleConverge}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-3 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
              >
                {busy ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />}
                Confirmer la fusion
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
