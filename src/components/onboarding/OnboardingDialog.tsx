import { useState } from "react";
import { Search, UserCheck, UserPlus, Loader2, Sparkles, ChevronRight, ChevronLeft } from "lucide-react";
import { authApi, personsApi } from "@/lib/api";
import { useAuthStore, useFamilyTreeStore } from "@/lib/store";
import { Person, SearchResult } from "@/lib/types";

type Step = "identity" | "origins" | "results";

const STEPS: Step[] = ["identity", "origins", "results"];

const STEP_LABELS: Record<Step, string> = {
  identity: "Qui etes-vous ?",
  origins: "Vos origines",
  results: "Votre fiche",
};

interface Props {
  onCompleted?: (personId: string) => void;
}

export function OnboardingDialog({ onCompleted }: Props) {
  const { setOnboarded } = useAuthStore();
  const { addPerson, loadTree } = useFamilyTreeStore();

  const [step, setStep] = useState<Step>("identity");
  const [direction, setDirection] = useState<"forward" | "back">("forward");
  const [form, setForm] = useState({
    firstName: "",
    lastName: "",
    nickname: "",
    gender: "other" as Person["gender"],
    cityOfOrigin: "",
    parentNames: "",
    siblingNames: "",
  });
  const [results, setResults] = useState<SearchResult[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const field = (key: keyof typeof form, value: string) => setForm((f) => ({ ...f, [key]: value }));
  const splitList = (s: string) => s.split(",").map((x) => x.trim()).filter(Boolean);

  function goTo(next: Step, dir: "forward" | "back") {
    setDirection(dir);
    setError(null);
    setStep(next);
  }

  async function handleSearchAndNext() {
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
      goTo("results", "forward");
    } catch {
      setResults([]);
      goTo("results", "forward");
    } finally {
      setBusy(false);
    }
  }

  async function handleLink(personId: string) {
    setBusy(true);
    setError(null);
    try {
      const me = await authApi.linkPerson(personId);
      if (me.personId) {
        setOnboarded(me.personId);
        await loadTree();
        onCompleted?.(me.personId);
      } else {
        await loadTree();
      }
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
      // addPerson met la fiche dans le store immédiatement — pas besoin de
      // recharger tout l'arbre (l'endpoint /tree n'inclut pas les nœuds isolés).
      addPerson(created);
      setOnboarded(created.id, created.firstName);
      onCompleted?.(created.id);
    } catch {
      setError("Impossible de creer votre fiche. Reessayez.");
    } finally {
      setBusy(false);
    }
  }

  const inputCls =
    "w-full rounded-xl border border-border bg-background px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-ring";

  const stepIndex = STEPS.indexOf(step);

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />

      <div className="glass relative w-full max-w-md rounded-2xl border border-border shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center gap-3 border-b border-border px-6 py-4">
          <div className="grid size-8 place-items-center rounded-lg bg-primary text-primary-foreground">
            <Sparkles className="size-4" />
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="font-semibold leading-tight text-foreground">Bienvenue sur Jabot</h2>
            <p className="text-xs text-muted-foreground">{STEP_LABELS[step]}</p>
          </div>
          {/* Progress dots */}
          <div className="flex gap-1.5">
            {STEPS.map((s, i) => (
              <div
                key={s}
                className={`h-1.5 rounded-full transition-all duration-300 ${
                  i === stepIndex ? "w-6 bg-primary" : i < stepIndex ? "w-1.5 bg-primary/40" : "w-1.5 bg-border"
                }`}
              />
            ))}
          </div>
        </div>

        {/* Sliding content */}
        <div className="overflow-hidden">
          <div
            key={step}
            className={`animate-slide-${
              direction === "forward" ? "in" : "in-reverse"
            } px-6 py-5 space-y-4`}
          >
            {/* ── Step 1 : Identity ─────────────────────────────── */}
            {step === "identity" && (
              <>
                <p className="text-sm text-muted-foreground">
                  Ces informations permettront de vous retrouver si vous etes deja dans l'arbre.
                </p>

                <div className="space-y-3">
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-muted-foreground">Prenom <span className="text-destructive">*</span></label>
                    <input
                      autoFocus
                      value={form.firstName}
                      onChange={(e) => field("firstName", e.target.value)}
                      placeholder="Aminata"
                      className={inputCls}
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-muted-foreground">Nom de famille</label>
                    <input value={form.lastName} onChange={(e) => field("lastName", e.target.value)} placeholder="Diallo" className={inputCls} />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-muted-foreground">Surnom / petit nom</label>
                    <input value={form.nickname} onChange={(e) => field("nickname", e.target.value)} placeholder="Ami" className={inputCls} />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-muted-foreground">Genre</label>
                    <div className="grid grid-cols-3 gap-2">
                      {(["male", "female", "other"] as const).map((g) => (
                        <button
                          key={g}
                          type="button"
                          onClick={() => field("gender", g)}
                          className={`rounded-xl border py-2.5 text-sm font-medium transition-colors ${
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
                </div>

                <button
                  disabled={!form.firstName.trim()}
                  onClick={() => goTo("origins", "forward")}
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-3 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
                >
                  Suivant <ChevronRight className="size-4" />
                </button>
              </>
            )}

            {/* ── Step 2 : Origins ──────────────────────────────── */}
            {step === "origins" && (
              <>
                <p className="text-sm text-muted-foreground">
                  Ces details affinement la recherche. Vous pouvez laisser vide si vous ne savez pas.
                </p>

                <div className="space-y-3">
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-muted-foreground">Ville ou region d'origine</label>
                    <input value={form.cityOfOrigin} onChange={(e) => field("cityOfOrigin", e.target.value)} placeholder="Dakar, Thies, Ziguinchor..." className={inputCls} />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-muted-foreground">
                      Nom des parents <span className="font-normal text-muted-foreground/60">(separes par des virgules)</span>
                    </label>
                    <input
                      value={form.parentNames}
                      onChange={(e) => field("parentNames", e.target.value)}
                      placeholder="Mamadou Diallo, Fatou Sow"
                      className={inputCls}
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-muted-foreground">
                      Nom des freres et soeurs <span className="font-normal text-muted-foreground/60">(separes par des virgules)</span>
                    </label>
                    <input
                      value={form.siblingNames}
                      onChange={(e) => field("siblingNames", e.target.value)}
                      placeholder="Ibrahima, Awa, Moussa"
                      className={inputCls}
                    />
                  </div>
                </div>

                {error && (
                  <p className="rounded-xl bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>
                )}

                <div className="flex gap-3">
                  <button
                    onClick={() => goTo("identity", "back")}
                    className="flex items-center gap-1 rounded-xl border border-border px-4 py-3 text-sm text-muted-foreground transition-colors hover:text-foreground"
                  >
                    <ChevronLeft className="size-4" />
                  </button>
                  <button
                    disabled={busy}
                    onClick={handleSearchAndNext}
                    className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-primary py-3 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
                  >
                    {busy ? <Loader2 className="size-4 animate-spin" /> : <Search className="size-4" />}
                    Rechercher dans l'arbre
                  </button>
                </div>
              </>
            )}

            {/* ── Step 3 : Results ──────────────────────────────── */}
            {step === "results" && (
              <>
                {results.length > 0 ? (
                  <>
                    <p className="text-sm font-medium text-foreground">
                      {results.length} profil{results.length > 1 ? "s" : ""} trouve{results.length > 1 ? "s" : ""} — vous reconnaissez-vous ?
                    </p>
                    <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                      {results.map((r) => (
                        <div key={r.person.id} className="flex items-center justify-between rounded-xl border border-border bg-background p-3 gap-3">
                          <div className="min-w-0">
                            <p className="truncate text-sm font-medium text-foreground">
                              {r.person.firstName} {r.person.lastName}
                              <span className="ml-2 text-xs text-primary font-normal">{Math.round(r.confidence * 100)}%</span>
                            </p>
                            {r.matchReasons.length > 0 && (
                              <p className="truncate text-xs text-muted-foreground">{r.matchReasons.join(" · ")}</p>
                            )}
                          </div>
                          <button
                            onClick={() => handleLink(r.person.id)}
                            disabled={busy}
                            className="shrink-0 flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                          >
                            <UserCheck className="size-3.5" /> C'est moi
                          </button>
                        </div>
                      ))}
                    </div>
                  </>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    Aucun profil correspondant dans l'arbre pour l'instant.
                  </p>
                )}

                {error && (
                  <p className="rounded-xl bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>
                )}

                <div className="space-y-2 pt-1">
                  <button
                    onClick={handleCreate}
                    disabled={busy}
                    className="flex w-full items-center justify-center gap-2 rounded-xl border border-primary bg-primary/5 py-3 text-sm font-medium text-primary transition-colors hover:bg-primary/10 disabled:opacity-50"
                  >
                    {busy ? <Loader2 className="size-4 animate-spin" /> : <UserPlus className="size-4" />}
                    Aucun, creer ma fiche
                  </button>
                  <button
                    onClick={() => goTo("origins", "back")}
                    className="w-full text-xs text-muted-foreground hover:text-foreground py-1"
                  >
                    Modifier mes informations
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
