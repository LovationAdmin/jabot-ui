import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { TreePine, KeyRound, CheckCircle } from "lucide-react";
import { invitationsApi, setActiveTreeId } from "@/lib/api";
import { useAuthStore } from "@/lib/store";
import { z } from "zod";

const searchSchema = z.object({
  token: z.string().optional(),
});

export const Route = createFileRoute("/invite")({
  validateSearch: (search: Record<string, unknown>) => searchSchema.parse(search),
  head: () => ({
    meta: [{ title: "Rejoindre Jabot — Invitation" }],
  }),
  component: InvitePage,
});

function InvitePage() {
  const navigate = useNavigate();
  const { token: urlToken } = Route.useSearch();
  const [token, setToken] = useState(urlToken ?? "");
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!token.trim() || !code.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const res = await invitationsApi.validate(token.trim(), code.trim());
      // Mémorise l'arbre de l'invitation pour que le canvas le charge directement.
      if (res.tree_id) {
        setActiveTreeId(res.tree_id);
        useAuthStore.getState().setActiveTree(res.tree_id);
      }
      setSuccess(true);
      setTimeout(() => navigate({ to: "/" }), 2000);
    } catch (err: any) {
      setError(err?.response?.data?.detail ?? "Code invalide ou invitation expirée.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-canvas px-4">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="mb-8 flex flex-col items-center gap-2">
          <div className="grid size-12 place-items-center rounded-2xl bg-primary text-primary-foreground shadow-lg">
            <TreePine className="size-6" />
          </div>
          <h1 className="font-serif text-3xl text-foreground">Jabot</h1>
          <p className="text-sm text-muted-foreground">Votre arbre généalogique</p>
        </div>

        {success ? (
          <div className="flex flex-col items-center gap-3 rounded-2xl border border-border bg-card p-8 text-center shadow-card">
            <CheckCircle className="size-10 text-green-500" />
            <p className="font-semibold text-foreground">Invitation validée !</p>
            <p className="text-sm text-muted-foreground">Redirection vers l'arbre…</p>
          </div>
        ) : (
          <form
            onSubmit={handleSubmit}
            className="flex flex-col gap-4 rounded-2xl border border-border bg-card p-6 shadow-card"
          >
            <div className="flex items-center gap-2">
              <KeyRound className="size-5 text-primary" />
              <h2 className="font-semibold text-foreground">Valider mon invitation</h2>
            </div>
            <p className="text-xs text-muted-foreground">
              Entrez le code à 6 chiffres reçu par SMS pour accéder à l'arbre.
            </p>

            {!urlToken && (
              <div>
                <label className="mb-1 block text-xs font-medium text-foreground">
                  Token d'invitation
                </label>
                <input
                  type="text"
                  value={token}
                  onChange={(e) => setToken(e.target.value)}
                  placeholder="Collez le token du lien reçu"
                  className="w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm text-foreground outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                />
              </div>
            )}

            <div>
              <label className="mb-1 block text-xs font-medium text-foreground">
                Code de validation
              </label>
              <input
                type="text"
                inputMode="numeric"
                pattern="[0-9]{6}"
                maxLength={6}
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
                placeholder="123456"
                className="w-full rounded-xl border border-border bg-background px-3 py-2.5 text-center text-xl font-mono font-semibold tracking-[0.5em] text-foreground outline-none focus:border-primary focus:ring-1 focus:ring-primary"
              />
            </div>

            {error && (
              <p className="rounded-lg bg-destructive/10 px-3 py-2 text-xs text-destructive">{error}</p>
            )}

            <button
              type="submit"
              disabled={loading || code.length < 6}
              className="rounded-xl bg-primary py-2.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-60"
            >
              {loading ? "Validation…" : "Accéder à l'arbre"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
