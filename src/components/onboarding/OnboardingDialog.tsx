import { useState } from "react";
import { Search, UserCheck, UserPlus, Loader2, Sparkles, ChevronRight, ChevronLeft } from "lucide-react";
import { authApi, personsApi, relationshipsApi, mergeApi } from "@/lib/api";
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

// Parse "Mamadou Diallo, Fatou Sow" → [{ firstName, lastName }]
function parseNames(raw: string): Array<{ firstName: string; lastName: string }> {
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .map((s) => {
      const parts = s.split(" ");
      return { firstName: parts[0] ?? s, lastName: parts.slice(1).join(" ") };
    });
}

// Un vrai doublon ne se limite pas au nom : on exige des signaux concordants
// supplementaires (date de naissance identique et/ou parents en commun), que
// le moteur de recherche backend remonte deja dans matchReasons.
function isLikelyDuplicate(r: SearchResult): boolean {
  const reasons = r.matchReasons.map((s) => s.toLowerCase());
  const sameBirth = reasons.some((s) => s.includes("naissance") || s.includes("birth") || s.includes("date"));
  const sharedParent = reasons.some((s) => s.includes("parent") || s.includes("pere") || s.includes("père") || s.includes("mere") || s.includes("mère"));
  const nameMatch = reasons.some((s) => s.includes("nom") || s.includes("prenom") || s.includes("prénom") || s.includes("name"));

  // Doublon certain : tres forte confiance ET au moins un signal fort
  // (date de naissance ou parent commun) en plus du nom.
  if (r.confidence >= 0.85 && (sameBirth || sharedParent)) return true;
  // Sinon confiance quasi parfaite avec concordance nom + date + parent.
  if (r.confidence >= 0.95 && nameMatch && sameBirth && sharedParent) return true;
  return false;
}

export function OnboardingDialog({ onCompleted }: Props) {
  const { setOnboarded } = useAuthStore();
  const { addPerson, addRelationship, loadTree } = useFamilyTreeStore();

  const [step, setStep] = useState<Step>("identity");
  const [direction, setDirection] = useState<"forward" | "back">("forward");
  const [form, setForm] = useState({
    firstName: "",
    lastName: "",
    nickname: "",
    gender: "other" as Person["gender"],
    birthDate: "",
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
        birth_date: form.birthDate || undefined,
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
      // 1. Rattacher le compte à la fiche existante
      const me = await authApi.linkPerson(personId);
      const linked = results.find((r) => r.person.id === personId)?.person;

      // 2. Enrichir la fiche cible avec les données fraîchement saisies
      //    (les données du formulaire priment sur les champs vides)
      const patch: Partial<Person> = {};
      if (form.firstName.trim()) patch.firstName = form.firstName.trim();
      if (form.lastName.trim()) patch.lastName = form.lastName.trim();
      if (form.nickname.trim()) patch.nicknames = [form.nickname.trim()];
      if (form.gender !== "other") patch.gender = form.gender;
      if (form.birthDate) patch.birthDate = form.birthDate;
      if (form.cityOfOrigin.trim()) patch.cityOfOrigin = form.cityOfOrigin.trim();
      if (Object.keys(patch).length > 0) {
        try { await personsApi.update(personId, patch); } catch { /* silencieux */ }
      }

      // 3. Créer les fiches parents/frères depuis le formulaire et les relier
      for (const { firstName, lastName } of parseNames(form.parentNames)) {
        try {
          const parent = await personsApi.create({ firstName, lastName: lastName || undefined });
          addPerson(parent);
          const rel = await relationshipsApi.create({ personAId: personId, personBId: parent.id, type: "parent" });
          addRelationship(rel);
        } catch { /* silencieux */ }
      }
      for (const { firstName, lastName } of parseNames(form.siblingNames)) {
        try {
          const sibling = await personsApi.create({ firstName, lastName: lastName || undefined });
          addPerson(sibling);
          const rel = await relationshipsApi.create({ personAId: personId, personBId: sibling.id, type: "sibling" });
          addRelationship(rel);
        } catch { /* silencieux */ }
      }

      if (me.personId) {
        setOnboarded(me.personId, form.firstName.trim() || linked?.firstName);
      }

      // 4. Fusionner automatiquement les vrais doublons dans la fiche choisie
      //    (aucun tri manuel : un doublon = même personne selon nom + date de
      //    naissance + parents, voir isLikelyDuplicate).
      const duplicates = results.filter(
        (r) => r.person.id !== personId && isLikelyDuplicate(r),
      );
      for (const dup of duplicates) {
        try { await mergeApi.merge(dup.person.id, personId); } catch { /* silencieux */ }
      }

      await loadTree();
      onCompleted?.(personId);
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
      // 1. Créer la fiche du user
      const created = await authApi.onboard({
        firstName: form.firstName.trim(),
        lastName: form.lastName.trim() || undefined,
        nicknames: form.nickname.trim() ? [form.nickname.trim()] : undefined,
        gender: form.gender,
        birthDate: form.birthDate || undefined,
        cityOfOrigin: form.cityOfOrigin.trim() || undefined,
      });
      addPerson(created);
      setOnboarded(created.id, created.firstName);

      // 2. Créer les fiches des parents et les relier
      for (const { firstName, lastName } of parseNames(form.parentNames)) {
        try {
          const parent = await personsApi.create({ firstName, lastName: lastName || undefined });
          addPerson(parent);
          const rel = await relationshipsApi.create({ personAId: created.id, personBId: parent.id, type: "parent" });
          addRelationship(rel);
        } catch { /* silencieux : l'essentiel est la fiche du user */ }
      }

      // 3. Créer les fiches des frères/sœurs et les relier
      for (const { firstName, lastName } of parseNames(form.siblingNames)) {
        try {
          const sibling = await personsApi.create({ firstName, lastName: lastName || undefined });
          addPerson(sibling);
          const rel = await relationshipsApi.create({ personAId: created.id, personBId: sibling.id, type: "sibling" });
          addRelationship(rel);
        } catch { /* silencieux */ }
      }

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
  const parentCount = splitList(form.parentNames).length;
  const siblingCount = splitList(form.siblingNames).length;

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
            className={`animate-slide-${direction === "forward" ? "in" : "in-reverse"} px-6 py-5 space-y-4`}
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
                    <label className="text-xs font-medium text-muted-foreground">Date de naissance</label>
                    <input type="date" value={form.birthDate} onChange={(e) => field("birthDate", e.target.value)} className={inputCls} />
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
                  Ces details affinent la recherche et permettront de creer les fiches de vos proches.
                </p>

                <div className="space-y-3">
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-muted-foreground">Ville ou region d'origine</label>
                    <input value={form.cityOfOrigin} onChange={(e) => field("cityOfOrigin", e.target.value)} placeholder="Dakar, Thies, Ziguinchor..." className={inputCls} />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-muted-foreground">
                      Noms de vos parents{" "}
                      <span className="font-normal text-muted-foreground/60">(separes par des virgules)</span>
                    </label>
                    <input
                      value={form.parentNames}
                      onChange={(e) => field("parentNames", e.target.value)}
                      placeholder="Mamadou Diallo, Fatou Sow"
                      className={inputCls}
                    />
                    {parentCount > 0 && (
                      <p className="text-[11px] text-primary">
                        {parentCount} fiche{parentCount > 1 ? "s" : ""} parent{parentCount > 1 ? "s" : ""} sera{parentCount > 1 ? "ont" : ""} creee{parentCount > 1 ? "s" : ""} automatiquement
                      </p>
                    )}
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-muted-foreground">
                      Noms de vos freres et soeurs{" "}
                      <span className="font-normal text-muted-foreground/60">(separes par des virgules)</span>
                    </label>
                    <input
                      value={form.siblingNames}
                      onChange={(e) => field("siblingNames", e.target.value)}
                      placeholder="Ibrahima, Awa, Moussa"
                      className={inputCls}
                    />
                    {siblingCount > 0 && (
                      <p className="text-[11px] text-primary">
                        {siblingCount} fiche{siblingCount > 1 ? "s" : ""} frere/soeur{siblingCount > 1 ? "s" : ""} sera{siblingCount > 1 ? "ont" : ""} creee{siblingCount > 1 ? "s" : ""} automatiquement
                      </p>
                    )}
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
                    <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
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

                {(parentCount > 0 || siblingCount > 0) && (
                  <div className="rounded-xl border border-primary/20 bg-primary/5 px-3 py-2.5 text-xs text-primary">
                    En creant votre fiche, {parentCount + siblingCount} fiche{parentCount + siblingCount > 1 ? "s" : ""} de proches sera{parentCount + siblingCount > 1 ? "ont" : ""} aussi creee{parentCount + siblingCount > 1 ? "s" : ""} et reliee{parentCount + siblingCount > 1 ? "s" : ""} — vous pourrez les enrichir ensuite.
                  </div>
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
                    {results.length > 0 ? "Aucun, creer ma fiche" : "Creer ma fiche"}
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
