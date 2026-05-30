import { useState } from "react";
import { X, Loader2, Trash2 } from "lucide-react";
import { personsApi, relationshipsApi } from "@/lib/api";
import { useFamilyTreeStore } from "@/lib/store";
import { Person } from "@/lib/types";

interface Props {
  mode: "create" | "edit";
  person?: Person | null;
  onClose: () => void;
}

const REL_LABELS: Record<string, string> = {
  parent: "Parent de",
  child: "Enfant de",
  sibling: "Frere/soeur de",
  spouse: "Conjoint(e) de",
};

export function PersonFormDialog({ mode, person, onClose }: Props) {
  const { tree, addPerson, updatePerson, deletePerson, addRelationship } = useFamilyTreeStore();

  const [form, setForm] = useState({
    firstName: person?.firstName ?? "",
    lastName: person?.lastName ?? "",
    nickname: person?.nicknames?.[0] ?? "",
    gender: person?.gender ?? ("other" as Person["gender"]),
    cityOfOrigin: person?.cityOfOrigin ?? "",
    birthDate: person?.birthDate ?? "",
    deathDate: person?.deathDate ?? "",
  });
  // Lien de parente optionnel (creation uniquement) pour batir l'arbre.
  const [relType, setRelType] = useState<"" | "parent" | "child" | "sibling" | "spouse">("");
  const [relTarget, setRelTarget] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const field = (k: keyof typeof form, v: string) => setForm((f) => ({ ...f, [k]: v }));

  function payload(): Partial<Person> {
    return {
      firstName: form.firstName.trim(),
      lastName: form.lastName.trim() || undefined,
      nicknames: form.nickname.trim() ? [form.nickname.trim()] : undefined,
      gender: form.gender,
      cityOfOrigin: form.cityOfOrigin.trim() || undefined,
      birthDate: form.birthDate || undefined,
      deathDate: form.deathDate || undefined,
    };
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.firstName.trim()) return;
    setBusy(true);
    setError(null);
    try {
      if (mode === "create") {
        const created = await personsApi.create(payload());
        addPerson(created);
        if (relType && relTarget) {
          const rel = await relationshipsApi.create({
            personAId: relTarget,
            personBId: created.id,
            type: relType,
          });
          addRelationship(rel);
        }
      } else if (person) {
        const updated = await personsApi.update(person.id, payload());
        updatePerson(person.id, updated);
      }
      onClose();
    } catch {
      setError("Echec de l'enregistrement. Reessayez.");
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete() {
    if (!person) return;
    if (!confirm(`Supprimer la fiche de ${person.firstName} ?`)) return;
    setBusy(true);
    setError(null);
    try {
      await personsApi.delete(person.id);
      deletePerson(person.id);
      onClose();
    } catch {
      setError("Echec de la suppression. Reessayez.");
    } finally {
      setBusy(false);
    }
  }

  const inputCls =
    "w-full rounded-xl border border-border bg-background px-3.5 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-ring";
  const others = tree.persons.filter((p) => p.id !== person?.id);

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center p-4 sm:items-center">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      <div className="glass relative w-full max-w-md overflow-hidden rounded-2xl border border-border shadow-2xl">
        <div className="flex items-center justify-between border-b border-border px-6 py-4">
          <h2 className="font-semibold text-foreground">
            {mode === "create" ? "Ajouter une personne" : "Modifier la fiche"}
          </h2>
          <button onClick={onClose} className="grid size-7 place-items-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground">
            <X className="size-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="max-h-[72vh] space-y-4 overflow-y-auto px-6 py-5">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Prenom <span className="text-destructive">*</span></label>
              <input autoFocus required value={form.firstName} onChange={(e) => field("firstName", e.target.value)} placeholder="Aminata" className={inputCls} />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Nom</label>
              <input value={form.lastName} onChange={(e) => field("lastName", e.target.value)} placeholder="Diallo" className={inputCls} />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Surnom</label>
            <input value={form.nickname} onChange={(e) => field("nickname", e.target.value)} placeholder="Ami" className={inputCls} />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Genre</label>
            <div className="grid grid-cols-3 gap-2">
              {(["male", "female", "other"] as const).map((g) => (
                <button key={g} type="button" onClick={() => field("gender", g)}
                  className={`rounded-xl border py-2.5 text-sm font-medium transition-colors ${
                    form.gender === g ? "border-primary bg-primary/10 text-primary" : "border-border bg-background text-muted-foreground hover:border-primary/50"
                  }`}>
                  {g === "male" ? "Homme" : g === "female" ? "Femme" : "Autre"}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Ville d'origine</label>
            <input value={form.cityOfOrigin} onChange={(e) => field("cityOfOrigin", e.target.value)} placeholder="Dakar" className={inputCls} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Naissance</label>
              <input type="date" value={form.birthDate} onChange={(e) => field("birthDate", e.target.value)} className={inputCls} />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Deces</label>
              <input type="date" value={form.deathDate} onChange={(e) => field("deathDate", e.target.value)} className={inputCls} />
            </div>
          </div>

          {mode === "create" && others.length > 0 && (
            <div className="space-y-1.5 rounded-xl border border-dashed border-border p-3">
              <label className="text-xs font-medium text-muted-foreground">Lien de parente (optionnel)</label>
              <div className="grid grid-cols-2 gap-2">
                <select value={relType} onChange={(e) => setRelType(e.target.value as typeof relType)} className={inputCls}>
                  <option value="">Aucun lien</option>
                  {Object.entries(REL_LABELS).map(([k, v]) => (
                    <option key={k} value={k}>{v}</option>
                  ))}
                </select>
                <select value={relTarget} onChange={(e) => setRelTarget(e.target.value)} disabled={!relType} className={inputCls}>
                  <option value="">Choisir une personne</option>
                  {others.map((p) => (
                    <option key={p.id} value={p.id}>{p.firstName} {p.lastName}</option>
                  ))}
                </select>
              </div>
            </div>
          )}

          {error && <p className="rounded-xl bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>}

          <div className="flex items-center gap-2 pt-1">
            {mode === "edit" && (
              <button type="button" onClick={handleDelete} disabled={busy}
                className="grid size-11 shrink-0 place-items-center rounded-xl border border-destructive/30 text-destructive transition-colors hover:bg-destructive/10 disabled:opacity-50" title="Supprimer">
                <Trash2 className="size-4" />
              </button>
            )}
            <button type="submit" disabled={busy || !form.firstName.trim()}
              className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-primary py-3 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50">
              {busy && <Loader2 className="size-4 animate-spin" />}
              {mode === "create" ? "Ajouter" : "Enregistrer"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
