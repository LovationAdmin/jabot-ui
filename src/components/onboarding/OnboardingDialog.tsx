import { useState } from "react";
import { Search, UserCheck, UserPlus, Loader2, Sparkles } from "lucide-react";
import { authApi, personsApi } from "@/lib/api";
import { useAuthStore, useFamilyTreeStore } from "@/lib/store";
import { Person, SearchResult } from "@/lib/types";

// Onboarding unique a la premiere connexion.
// Objectif : recuperer assez d'infos pour verifier si l'utilisateur est deja
// present dans le canvas (recherche floue/phonetique). S'il s'y reconnait il se
// rattache (« C'est moi ») ; sinon il cree sa premiere fiche.
export function OnboardingDialog() {
  const { setOnboarded } = useAuthStore();
  const { addPerson, loadTree } = useFamilyTreeStore();

  const [form, setForm] = useState({
    firstName: "",
    lastName: "",
    nickname: "",
    gender: "other" as Person["gender"],
    cityOfOrigin: "",
    parentNames: "",
    siblingNames: "",
  });
  const [searched, setSearched] = useState(false);
  const [results, setResults] = useState<SearchResult[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const field = (key: keyof typeof form, value: string) => setForm((f) => ({ ...f, [key]: value }));

  const splitList = (s: string) =>
    s.split(",").map((x) => x.trim()).filter(Boolean);

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    if (!form.firstName.trim()) return;
    setBusy(true);
    setError(null);
    try {
      const fullName = `${form.firstName} ${form.lastName}`.trim();
      const matches = await personsApi.search({
        name: fullName || undefined,
        nickname: form.nickname.trim() || undefined,
        parent_names: splitList(form.parentNames),
        sibling_names: splitList(form.siblingNames),
        city_of_origin: form.cityOfOrigin.trim() || undefined,
      });
      setResults(matches);
      setSearched(true);
    } catch {
      // Pas de correspondance ou erreur : on laisse l'utilisateur creer sa fiche.
      setResults([]);
      setSearched(true);
    } finally {
      setBusy(false);
    }
  }

  async function handleLink(personId: string) {
    setBusy(true);
    setError(null);
    try {
      const me = await authApi.linkPerson(personId);
      if (me.personId) setOnboarded(me.personId);
      await loadTree();
    } catch {
      setError("Impossible de vous rattacher a cette fiche. Reessayez.");
    } finally {
      setBusy(false);
    }
  }

  async function handleCreate() {
    setBusy(true);
    setError(null);
    try {
      const created = await authApi.onboard({
        firstName: form.firstName.trim(),
        lastName: form.lastName.trim() || undefined,
        nicknames: form.nickname.trim() ? [form.nickname.trim()] : undefined,
        gender: form.gender,
        cityOfOrigin: form.cityOfOrigin.trim() || undefined,
      });
      addPerson(created);
      setOnboarded(created.id);
      await loadTree();
    } catch {
      setError("Impossible de creer votre fiche. Reessayez.");
    } finally {
      setBusy(false);
    }
  }

  const inputCls =
    "w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />

      <div className="glass relative w-full max-w-lg rounded-2xl border border-border shadow-2xl">
        <div className="flex items-center gap-2.5 border-b border-border px-6 py-4">
          <div className="grid size-8 place-items-center rounded-lg bg-primary text-primary-foreground">
            <Sparkles className="size-4" />
          </div>
          <div>
            <h2 className="font-semibold leading-tight text-foreground">Bienvenue sur Jabot</h2>
            <p className="text-xs text-muted-foreground">Retrouvons-vous dans l'arbre, ou creons votre fiche</p>
          </div>
        </div>

        <div className="max-h-[70vh] overflow-y-auto px-6 py-5">
          <form onSubmit={handleSearch} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">Prenom *</label>
                <input required value={form.firstName} onChange={(e) => field("firstName", e.target.value)} placeholder="Aminata" className={inputCls} />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">Nom de famille</label>
                <input value={form.lastName} onChange={(e) => field("lastName", e.target.value)} placeholder="Diallo" className={inputCls} />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">Surnom</label>
                <input value={form.nickname} onChange={(e) => field("nickname", e.target.value)} placeholder="Ami" className={inputCls} />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">Ville d'origine</label>
                <input value={form.cityOfOrigin} onChange={(e) => field("cityOfOrigin", e.target.value)} placeholder="Dakar" className={inputCls} />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Nom des parents <span className="opacity-60">(separes par des virgules)</span></label>
              <input value={form.parentNames} onChange={(e) => field("parentNames", e.target.value)} placeholder="Mamadou Diallo, Fatou Sow" className={inputCls} />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Nom des freres/soeurs <span className="opacity-60">(separes par des virgules)</span></label>
              <input value={form.siblingNames} onChange={(e) => field("siblingNames", e.target.value)} placeholder="Ibrahima, Awa" className={inputCls} />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Genre</label>
              <div className="flex gap-2">
                {(["male", "female", "other"] as const).map((g) => (
                  <button
                    key={g}
                    type="button"
                    onClick={() => field("gender", g)}
                    className={`flex-1 rounded-lg border py-2 text-xs font-medium transition-colors ${
                      form.gender === g
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border bg-background text-muted-foreground hover:border-primary/50"
                    }`}
                  >
                    {g === "male" ? "Homme" : g === "female" ? "Femme" : "Autre"}
                  </button>
                ))}
              </div>
            </div>

            {error && <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-600">{error}</p>}

            <button
              type="submit"
              disabled={busy || !form.firstName.trim()}
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-primary py-2.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
            >
              {busy ? <Loader2 className="size-4 animate-spin" /> : <Search className="size-4" />}
              {searched ? "Relancer la recherche" : "Me rechercher dans l'arbre"}
            </button>
          </form>

          {/* Resultats */}
          {searched && (
            <div className="mt-5 space-y-3">
              {results.length > 0 ? (
                <>
                  <p className="text-xs font-medium text-muted-foreground">
                    {results.length} correspondance{results.length > 1 ? "s" : ""} trouvee{results.length > 1 ? "s" : ""} — vous reconnaissez-vous ?
                  </p>
                  {results.map((r) => (
                    <div key={r.person.id} className="flex items-center justify-between rounded-xl border border-border bg-background p-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-foreground">
                          {r.person.firstName} {r.person.lastName}
                          <span className="ml-2 text-xs text-primary">{Math.round(r.confidence * 100)}%</span>
                        </p>
                        {r.matchReasons.length > 0 && (
                          <p className="truncate text-xs text-muted-foreground">{r.matchReasons.join(" · ")}</p>
                        )}
                      </div>
                      <button
                        onClick={() => handleLink(r.person.id)}
                        disabled={busy}
                        className="flex shrink-0 items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
                      >
                        <UserCheck className="size-3.5" /> C'est moi
                      </button>
                    </div>
                  ))}
                </>
              ) : (
                <p className="text-xs text-muted-foreground">Aucune correspondance trouvee dans l'arbre.</p>
              )}

              <button
                onClick={handleCreate}
                disabled={busy || !form.firstName.trim()}
                className="flex w-full items-center justify-center gap-2 rounded-lg border border-primary bg-primary/5 py-2.5 text-sm font-medium text-primary transition-colors hover:bg-primary/10 disabled:opacity-50"
              >
                {busy ? <Loader2 className="size-4 animate-spin" /> : <UserPlus className="size-4" />}
                Aucun, creer ma fiche
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
