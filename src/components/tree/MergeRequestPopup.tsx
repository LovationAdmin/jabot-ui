import { useEffect, useState } from "react";
import { GitMerge, Check, X, Loader2 } from "lucide-react";
import { mergeRequestsApi, authApi } from "@/lib/api";
import { useAuthStore, useFamilyTreeStore } from "@/lib/store";
import { MergeRequest } from "@/lib/types";

/**
 * Popup affiché à la connexion / au chargement si des demandes de fusion
 * sont en attente pour les arbres dont l'utilisateur est membre ou owner.
 */
export function MergeRequestPopup() {
  const { treeAccesses, activeTreeId, setTreeAccesses, setActiveTree } = useAuthStore();
  const { loadTree, refreshDuplicateCount } = useFamilyTreeStore();

  const [requests, setRequests] = useState<MergeRequest[]>([]);
  const [current, setCurrent] = useState<MergeRequest | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  useEffect(() => {
    mergeRequestsApi.listPending().then((reqs) => {
      // Ne montrer que les demandes où l'utilisateur peut approuver (arbre cible)
      const myTreeIds = new Set(treeAccesses.map((t) => t.treeId));
      const actionable = reqs.filter((r) => myTreeIds.has(r.targetTreeId));
      setRequests(actionable);
      if (actionable.length > 0) setCurrent(actionable[0]);
    }).catch(() => {});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!current || done) return null;

  async function handleApprove() {
    if (!current) return;
    setBusy(true);
    setError(null);
    try {
      await mergeRequestsApi.approve(current.id);
      // Rafraîchir la session et l'arbre
      const me = await authApi.me();
      setTreeAccesses(me.treeAccesses, activeTreeId ?? undefined);
      if (activeTreeId) setActiveTree(activeTreeId);
      await loadTree();
      await refreshDuplicateCount();
      advance();
    } catch (e: unknown) {
      const detail = (e as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      setError(detail ?? "La fusion a échoué. Réessayez.");
    } finally {
      setBusy(false);
    }
  }

  async function handleReject() {
    if (!current) return;
    setBusy(true);
    setError(null);
    try {
      await mergeRequestsApi.reject(current.id);
      advance();
    } catch {
      setError("Impossible de rejeter. Réessayez.");
    } finally {
      setBusy(false);
    }
  }

  function advance() {
    const remaining = requests.filter((r) => r.id !== current!.id);
    setRequests(remaining);
    if (remaining.length > 0) {
      setCurrent(remaining[0]);
      setError(null);
    } else {
      setDone(true);
    }
  }

  const requesterName = current.requesterFirstName ?? "Un utilisateur";
  const srcName = current.sourceTreeName ?? "un arbre";
  const tgtName = current.targetTreeName ?? "votre arbre";

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center p-4 sm:items-center">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      <div className="glass relative w-full max-w-sm rounded-2xl border border-border shadow-2xl overflow-hidden">

        {/* Header */}
        <div className="flex items-center gap-3 border-b border-border px-5 py-4">
          <div className="grid size-8 place-items-center rounded-lg bg-primary text-primary-foreground">
            <GitMerge className="size-4" />
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="font-semibold leading-tight text-foreground">Demande de fusion</h2>
            {requests.length > 1 && (
              <p className="text-xs text-muted-foreground">{requests.length} demande{requests.length > 1 ? "s" : ""} en attente</p>
            )}
          </div>
        </div>

        {busy ? (
          <div className="flex flex-col items-center gap-3 px-6 py-10 text-center">
            <Loader2 className="size-6 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">Traitement en cours…</p>
          </div>
        ) : (
          <div className="space-y-4 px-5 py-5">
            <div className="rounded-xl border border-primary/20 bg-primary/5 px-4 py-3 space-y-1">
              <p className="text-sm font-medium text-foreground">
                {requesterName} souhaite relier son arbre
              </p>
              <p className="text-xs text-muted-foreground">
                « {srcName} » → « {tgtName} »
              </p>
            </div>

            <p className="text-xs text-muted-foreground leading-relaxed">
              Si vous approuvez, toutes les fiches de l'arbre source seront intégrées à « {tgtName} ».
              Cette action est <strong>définitive</strong>.
            </p>

            {error && (
              <p className="rounded-xl bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>
            )}

            <div className="flex gap-2">
              <button
                onClick={handleReject}
                disabled={busy}
                className="flex-1 flex items-center justify-center gap-2 rounded-xl border border-border py-2.5 text-sm text-muted-foreground transition-colors hover:bg-muted disabled:opacity-50"
              >
                <X className="size-4" /> Refuser
              </button>
              <button
                onClick={handleApprove}
                disabled={busy}
                className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-primary py-2.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
              >
                <Check className="size-4" /> Approuver
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
