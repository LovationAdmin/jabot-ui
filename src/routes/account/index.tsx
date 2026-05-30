import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect } from "react";
import { ArrowLeft, Phone, IdCard, LogOut, ShieldCheck } from "lucide-react";
import { useAuthStore, useFamilyTreeStore } from "@/lib/store";

export const Route = createFileRoute("/account/")({
  head: () => ({ meta: [{ title: "Mon compte — Jabot" }] }),
  component: AccountPage,
});

function AccountPage() {
  const navigate = useNavigate();
  const { isAuthenticated, phone, personId, onboarded, logout } = useAuthStore();
  const { tree, loadTree, getPersonById } = useFamilyTreeStore();

  useEffect(() => {
    if (!isAuthenticated) navigate({ to: "/auth" });
  }, [isAuthenticated, navigate]);

  useEffect(() => {
    if (tree.persons.length === 0) loadTree();
  }, [tree.persons.length, loadTree]);

  const me = personId ? getPersonById(personId) : undefined;

  return (
    <div className="canvas-grid min-h-screen bg-canvas p-4">
      <div className="mx-auto max-w-lg pt-8">
        <Link to="/" className="mb-6 flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground">
          <ArrowLeft className="size-4" /> Retour a l'arbre
        </Link>

        <div className="rounded-2xl border border-border bg-card p-6 shadow-float">
          <h1 className="mb-6 font-serif text-2xl text-foreground">Parametres du compte</h1>

          <div className="space-y-4">
            <Row icon={<Phone className="size-4" />} label="Numero de telephone" value={phone ?? "—"} />
            <Row
              icon={<IdCard className="size-4" />}
              label="Ma fiche dans l'arbre"
              value={me ? `${me.firstName} ${me.lastName}` : onboarded ? "Rattachee" : "Non rattachee"}
            />
            <Row
              icon={<ShieldCheck className="size-4" />}
              label="Statut"
              value={onboarded ? "Profil complete" : "Onboarding a finaliser"}
            />
          </div>

          <div className="mt-8 border-t border-border pt-6">
            <button
              onClick={() => { logout(); navigate({ to: "/" }); }}
              className="flex w-full items-center justify-center gap-2 rounded-xl border border-destructive/30 py-3 text-sm font-medium text-destructive transition-colors hover:bg-destructive/10"
            >
              <LogOut className="size-4" /> Se deconnecter
            </button>
          </div>
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
