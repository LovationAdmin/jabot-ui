import { useState } from "react";
import { X, UserPlus, Loader2 } from "lucide-react";
import { personsApi, relationshipsApi } from "@/lib/api";
import { useFamilyTreeStore } from "@/lib/store";
import { Person } from "@/lib/types";

interface Props {
  open: boolean;
  onClose: () => void;
  relatedPerson?: Person | null;
}

const RELATIONSHIP_OPTIONS = [
  { value: "parent", label: "Parent de" },
  { value: "child", label: "Enfant de" },
  { value: "spouse", label: "Conjoint(e) de" },
  { value: "sibling", label: "Frère/Sœur de" },
] as const;

export function AddPersonDialog({ open, onClose, relatedPerson }: Props) {
  const { addPerson, addRelationship, tree } = useFamilyTreeStore();

  const [form, setForm] = useState({
    firstName: "",
    lastName: "",
    gender: "other" as Person["gender"],
    birthDate: "",
    cityOfOrigin: "",
    relatedPersonId: relatedPerson?.id ?? "",
    relationshipType: "child" as "parent" | "child" | "spouse" | "sibling",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!open) return null;

  const field = (key: keyof typeof form, value: string) =>
    setForm((f) => ({ ...f, [key]: value }));

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.firstName.trim()) return;
    setSaving(true);
    setError(null);
    try {
      const newPerson = await personsApi.create({
        firstName: form.firstName.trim(),
        lastName: form.lastName.trim() || undefined,
        gender: form.gender,
        birthDate: form.birthDate || undefined,
        cityOfOrigin: form.cityOfOrigin.trim() || undefined,
      });
      addPerson(newPerson);

      if (form.relatedPersonId) {
        const rel = await relationshipsApi.create({
          personAId: newPerson.id,
          personBId: form.relatedPersonId,
          type: form.relationshipType,
        });
        addRelationship(rel);
      }

      onClose();
      setForm({ firstName: "", lastName: "", gender: "other", birthDate: "", cityOfOrigin: "", relatedPersonId: "", relationshipType: "child" });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Erreur lors de la création";
      setError(msg);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />

      {/* Dialog */}
      <div className="glass relative w-full max-w-md rounded-2xl border border-border shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border px-6 py-4">
          <div className="flex items-center gap-2.5">
            <div className="grid size-8 place-items-center rounded-lg bg-primary text-primary-foreground">
              <UserPlus className="size-4" />
            </div>
            <h2 className="font-semibold text-foreground">Ajouter une personne</h2>
          </div>
          <button onClick={onClose} className="grid size-7 place-items-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground">
            <X className="size-4" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4 px-6 py-5">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Prénom *</label>
              <input
                required
                value={form.firstName}
                onChange={(e) => field("firstName", e.target.value)}
                placeholder="Aminata"
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Nom de famille</label>
              <input
                value={form.lastName}
                onChange={(e) => field("lastName", e.target.value)}
                placeholder="Diallo"
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
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

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Date de naissance</label>
              <input
                type="date"
                value={form.birthDate}
                onChange={(e) => field("birthDate", e.target.value)}
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Ville d'origine</label>
              <input
                value={form.cityOfOrigin}
                onChange={(e) => field("cityOfOrigin", e.target.value)}
                placeholder="Dakar"
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
          </div>

          {/* Relationship */}
          {tree.persons.length > 0 && (
            <div className="space-y-3 rounded-xl border border-border bg-muted/30 p-3">
              <p className="text-xs font-medium text-muted-foreground">Lien avec une personne existante (optionnel)</p>
              <div className="space-y-1.5">
                <label className="text-xs text-muted-foreground">Personne liée</label>
                <select
                  value={form.relatedPersonId}
                  onChange={(e) => field("relatedPersonId", e.target.value)}
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                >
                  <option value="">— Aucune —</option>
                  {tree.persons.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.firstName} {p.lastName}
                    </option>
                  ))}
                </select>
              </div>
              {form.relatedPersonId && (
                <div className="space-y-1.5">
                  <label className="text-xs text-muted-foreground">Type de relation</label>
                  <div className="grid grid-cols-2 gap-2">
                    {RELATIONSHIP_OPTIONS.map((opt) => (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => field("relationshipType", opt.value)}
                        className={`rounded-lg border py-1.5 text-xs font-medium transition-colors ${
                          form.relationshipType === opt.value
                            ? "border-primary bg-primary/10 text-primary"
                            : "border-border bg-background text-muted-foreground hover:border-primary/50"
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {error && (
            <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-600">{error}</p>
          )}

          <div className="flex gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 rounded-lg border border-border py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted"
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={saving || !form.firstName.trim()}
              className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-primary py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
            >
              {saving ? <Loader2 className="size-4 animate-spin" /> : <UserPlus className="size-4" />}
              {saving ? "Enregistrement…" : "Ajouter"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
