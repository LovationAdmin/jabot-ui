import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowLeft, Phone, IdCard, LogOut, ShieldCheck, Trash2, AlertTriangle, History, ChevronRight, GitMerge, DatabaseBackup } from "lucide-react";
import { useAuthStore, useFamilyTreeStore } from "@/lib/store";
import { authApi, adminApi } from "@/lib/api";

export const Route = createFileRoute("/account/")({
  head: () => ({ meta: [{ title: "Mon compte — Jabot" }] }),
  component: AccountPage,
});

function AccountPage() {
  const navigate = useNavigate();
  const { isAuthenticated, phone, personId, onboarded, logout } = useAuthStore();
  const { tree, loadTree, getPersonById } = useFamilyTreeStore();
  const [deleteStep, setDeleteStep] = useState<"idle" | "confirm">("idle");
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [resetSecret, setResetSecret] = useState("");
  const [resetStep, setResetStep] = useState<"idle" | "confirm">("idle");
  const [resetBusy, setResetBusy] = useState(false);
  const [resetMsg, setResetMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!isAuthenticated) navigate({ to: "/auth" });
  }, [isAuthenticated, navigate]);

  useEffect(() => {
    if (tree.persons.length === 0) loadTree();
  }, [tree.persons.length, loadTree]);

  const me = personId ? getPersonById(personId) : undefined;

  async function handleResetDb() {
    setResetBusy(true);
    setResetMsg(null);
    try {
      const { message } = await adminApi.resetDb(resetSecret);
      setResetMsg(message);
      setResetStep("idle");
      setResetSecret("");
      await loadTree();
    } catch {
      setResetMsg("Echec de la purge. Verifie le secret.");
    } finally {
      setResetBusy(false);
    }
  }

  async function handleDeleteAccount() {
    setDeleteBusy(true);
    setDeleteError(null);
    try {
      await authApi.deleteAccount();
      logout();
      navigate({ to: "/" });
    } catch {
      setDeleteError("Impossible de supprimer le compte. Reessayez.");
      setDeleteBusy(false);
    }
  }

  return (
    <div className="canvas-grid min-h-screen bg-canvas p-4">
      <div className="mx-auto max-w-lg pt-8 space-y-4">
        <Link to="/" className="flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground">
          <ArrowLeft className="size-4" /> Retour a l'arbre
        </Link>

        {/* Infos du compte */}
        <div className="rounded-2xl border border-border bg-card p-6 shadow-float">
          <h1 className="mb-6 font-serif text-2xl text-foreground">Parametres du compte</h1>

          <div className="space-y-4">
            <Row icon={<Phone className="size-4" />} label="Numero de telephone" value={phone ?? "—"} />
            <Row
              icon={<IdCard className="size-4" />}
              label="Ma fiche dans l'arbre"
              value={me ? `${me.firstName} ${me.lastName}`.trim() : onboarded ? "Rattachee" : "Non rattachee"}
            />
            <Row
              icon={<ShieldCheck className="size-4" />}
              label="Statut"
              value={onboarded ? "Profil complete" : "Onboarding a finaliser"}
            />
          </div>

          <div className="mt-6 space-y-2">
            <Link
              to="/account/duplicates"
              className="flex items-center gap-3 rounded-xl border border-border bg-background px-4 py-3 transition-colors hover:bg-muted"
            >
              <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-muted text-muted-foreground">
                <GitMerge className="size-4" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-foreground">Doublons de fiches</p>
                <p className="text-xs text-muted-foreground">Detecter et fusionner les fiches en doublon</p>
              </div>
              <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
            </Link>

            <Link
              to="/account/activity"
              className="flex items-center gap-3 rounded-xl border border-border bg-background px-4 py-3 transition-colors hover:bg-muted"
            >
              <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-muted text-muted-foreground">
                <History className="size-4" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-foreground">Activite de l'arbre</p>
                <p className="text-xs text-muted-foreground">Qui a cree, modifie ou supprime des fiches</p>
              </div>
              <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
            </Link>
          </div>

          <div className="mt-6 border-t border-border pt-6">
            <button
              onClick={() => { logout(); navigate({ to: "/" }); }}
              className="flex w-full items-center justify-center gap-2 rounded-xl border border-border py-3 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              <LogOut className="size-4" /> Se deconnecter
            </button>
          </div>
        </div>

        {/* Zone admin : purge BDD */}
        <div className="rounded-2xl border border-orange-200 bg-card p-6">
          <div className="flex items-center gap-2 mb-1">
            <DatabaseBackup className="size-4 text-orange-500" />
            <h2 className="font-semibold text-foreground">Reinitialiser la base</h2>
          </div>
          <p className="mb-4 text-sm text-muted-foreground">
            Supprime toutes les fiches, relations et medias. Les comptes utilisateurs sont conserves.
            Requiert le secret RESET_SECRET configure sur le serveur.
          </p>
          {resetMsg && (
            <p className="mb-3 text-sm text-orange-600 font-medium">{resetMsg}</p>
          )}
          {resetStep === "idle" ? (
            <button
              onClick={() => setResetStep("confirm")}
              className="flex w-full items-center justify-center gap-2 rounded-xl border border-orange-300 py-3 text-sm font-medium text-orange-600 transition-colors hover:bg-orange-50"
            >
              <DatabaseBackup className="size-4" /> Purger la base de donnees
            </button>
          ) : (
            <div className="space-y-3 rounded-xl border border-orange-200 bg-orange-50 p-4">
              <p className="text-sm text-foreground">Entrez le secret pour confirmer :</p>
              <input
                type="password"
                value={resetSecret}
                onChange={(e) => setResetSecret(e.target.value)}
                placeholder="RESET_SECRET"
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-orange-400"
              />
              <div className="flex gap-2">
                <button
                  onClick={() => { setResetStep("idle"); setResetSecret(""); }}
                  disabled={resetBusy}
                  className="flex-1 rounded-xl border border-border py-2.5 text-sm text-muted-foreground hover:text-foreground disabled:opacity-50"
                >
                  Annuler
                </button>
                <button
                  onClick={handleResetDb}
                  disabled={resetBusy || !resetSecret}
                  className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-orange-500 py-2.5 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50"
                >
                  {resetBusy ? (
                    <div className="size-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  ) : (
                    <DatabaseBackup className="size-4" />
                  )}
                  Confirmer la purge
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Zone danger : suppression du compte */}
        <div className="rounded-2xl border border-destructive/30 bg-card p-6">
          <h2 className="mb-1 font-semibold text-foreground">Zone dangereuse</h2>
          <p className="mb-4 text-sm text-muted-foreground">
            La suppression de votre compte est irreversible. Votre fiche et vos liens dans l'arbre
            genealogique sont conserves — seul votre acces au compte sera supprime.
          </p>

          {deleteStep === "idle" ? (
            <button
              onClick={() => setDeleteStep("confirm")}
              className="flex w-full items-center justify-center gap-2 rounded-xl border border-destructive/40 py-3 text-sm font-medium text-destructive transition-colors hover:bg-destructive/10"
            >
              <Trash2 className="size-4" /> Supprimer mon compte
            </button>
          ) : (
            <div className="space-y-3 rounded-xl border border-destructive/40 bg-destructive/5 p-4">
              <div className="flex items-start gap-2.5">
                <AlertTriangle className="mt-0.5 size-4 shrink-0 text-destructive" />
                <p className="text-sm text-foreground">
                  Etes-vous certain ? Cette action supprimera definitivement votre acces.
                  Votre fiche restera visible dans l'arbre.
                </p>
              </div>
              {deleteError && (
                <p className="text-sm text-destructive">{deleteError}</p>
              )}
              <div className="flex gap-2">
                <button
                  onClick={() => { setDeleteStep("idle"); setDeleteError(null); }}
                  disabled={deleteBusy}
                  className="flex-1 rounded-xl border border-border py-2.5 text-sm text-muted-foreground hover:text-foreground disabled:opacity-50"
                >
                  Annuler
                </button>
                <button
                  onClick={handleDeleteAccount}
                  disabled={deleteBusy}
                  className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-destructive py-2.5 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50"
                >
                  {deleteBusy ? (
                    <div className="size-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  ) : (
                    <Trash2 className="size-4" />
                  )}
                  Oui, supprimer
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Row({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-border bg-background px-4 py-3">
      <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-muted text-muted-foreground">{icon}</span>
      <div className="min-w-0">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="truncate text-sm font-medium text-foreground">{value}</p>
      </div>
    </div>
  );
}
