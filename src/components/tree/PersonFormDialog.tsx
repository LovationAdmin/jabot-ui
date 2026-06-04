import { useState, useRef, useEffect } from "react";
import {
  X, Loader2, Trash2, ChevronRight, ChevronLeft,
  Plus, UserPlus, Upload, Mic, Square, Check,
} from "lucide-react";
import { personsApi, relationshipsApi, mediaApi } from "@/lib/api";
import { PersonSearchSelect } from "./PersonSearchSelect";
import { startVoiceRecording, VoiceRecorder } from "@/lib/recorder";
import { useFamilyTreeStore } from "@/lib/store";
import { Person, Relationship, CrossTreeMatch } from "@/lib/types";
import { CrossTreeSuggestionBanner } from "./CrossTreeSuggestionBanner";

// ─── Types ─────────────────────────────────────────────────────────

type Step = "identity" | "parents" | "siblings" | "relatives";
const STEPS: Step[] = ["identity", "parents", "siblings", "relatives"];
const STEP_LABELS: Record<Step, string> = {
  identity: "Identité",
  parents: "Parents",
  siblings: "Frères & Sœurs",
  relatives: "Autres proches",
};

interface RelativeOption { value: string; label: string }

interface PersonDraft {
  _key: string;
  existingId?: string;
  relId?: string;       // set for pre-existing relationships in edit mode
  firstName: string;
  lastName: string;
  relType: string;
}

function emptyDraft(relType: string): PersonDraft {
  return { _key: Math.random().toString(36).slice(2), firstName: "", lastName: "", relType };
}

interface Props {
  mode: "create" | "edit";
  person?: Person | null;
  onClose: () => void;
}

// Direction-aware effective type helper (same logic as EditPanel)
const INVERSE: Record<string, string> = {
  parent: "child", child: "parent",
  grandparent: "grandchild", grandchild: "grandparent",
  uncle_aunt: "nephew_niece", nephew_niece: "uncle_aunt",
  step_parent: "step_child", step_child: "step_parent",
};

function effectiveTypeFor(r: Relationship, viewerId: string): string {
  if (r.personAId === viewerId && INVERSE[r.type]) return INVERSE[r.type];
  return r.type;
}

const PARENT_TYPES = new Set(["parent", "step_parent"]);
const SIBLING_TYPES = new Set(["sibling", "half_sibling", "step_sibling"]);

// ─── Main component ────────────────────────────────────────────────

export function PersonFormDialog({ mode, person, onClose }: Props) {
  const { tree, addPerson, updatePerson, deletePerson, addRelationship, deleteRelationship, loadTree, requestFitTree } = useFamilyTreeStore();

  const [step, setStep] = useState<Step>("identity");
  const [direction, setDirection] = useState<"forward" | "back">("forward");
  const [savedId, setSavedId] = useState<string | null>(person?.id ?? null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [crossTreeMatches, setCrossTreeMatches] = useState<CrossTreeMatch[]>([]);

  // ── Step 1 form ────────────────────────────────────────────────
  const [form, setForm] = useState({
    firstName: person?.firstName ?? "",
    lastName: person?.lastName ?? "",
    nickname: person?.nicknames?.[0] ?? "",
    birthDate: person?.birthDate ?? "",
    isDeceased: !!person?.deathDate,
    deathDate: person?.deathDate ?? "",
    cityOfOrigin: person?.cityOfOrigin ?? "",
  });
  const [photoFiles, setPhotoFiles] = useState<File[]>([]);
  const [audioFiles, setAudioFiles] = useState<File[]>([]);
  const photoRef = useRef<HTMLInputElement>(null);
  const audioRef = useRef<HTMLInputElement>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingSecs, setRecordingSecs] = useState(0);
  const recorderRef = useRef<VoiceRecorder | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => () => { timerRef.current && clearInterval(timerRef.current); }, []);

  async function startRecording() {
    try {
      recorderRef.current = await startVoiceRecording(
        (file) => {
          setAudioFiles((ps) => [...ps, file]);
          setIsRecording(false);
          setRecordingSecs(0);
          timerRef.current && clearInterval(timerRef.current);
        },
        () => {
          setIsRecording(false);
          timerRef.current && clearInterval(timerRef.current);
          alert("Erreur pendant l'enregistrement.");
        },
      );
      setIsRecording(true);
      setRecordingSecs(0);
      timerRef.current = setInterval(() => setRecordingSecs((s) => s + 1), 1000);
    } catch {
      alert("Impossible d'accéder au microphone.");
    }
  }

  function stopRecording() {
    recorderRef.current?.stop();
  }

  // ── Relative lists ─────────────────────────────────────────────
  const [parents, setParents] = useState<PersonDraft[]>([]);
  const [siblings, setSiblings] = useState<PersonDraft[]>([]);
  const [relatives, setRelatives] = useState<PersonDraft[]>([]);

  // Pre-populate from existing relationships in edit mode
  useEffect(() => {
    if (mode !== "edit" || !person) return;
    const byId = new Map(tree.persons.map((p) => [p.id, p]));
    const personRels = tree.relationships.filter(
      (r) => r.personAId === person.id || r.personBId === person.id,
    );

    const newParents: PersonDraft[] = [];
    const newSiblings: PersonDraft[] = [];
    const newRelatives: PersonDraft[] = [];
    const seen = new Set<string>();

    for (const r of personRels) {
      const otherId = r.personAId === person.id ? r.personBId : r.personAId;
      if (seen.has(otherId)) continue;
      seen.add(otherId);
      const other = byId.get(otherId);
      if (!other) continue;
      const eff = effectiveTypeFor(r, person.id);

      const draft: PersonDraft = {
        _key: r.id,
        relId: r.id,
        existingId: other.id,
        firstName: other.firstName,
        lastName: other.lastName ?? "",
        relType: eff,
      };

      if (PARENT_TYPES.has(eff)) newParents.push(draft);
      else if (SIBLING_TYPES.has(eff)) newSiblings.push(draft);
      else newRelatives.push(draft);
    }

    setParents(newParents);
    setSiblings(newSiblings);
    setRelatives(newRelatives);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const field = (k: keyof typeof form, v: string | boolean) =>
    setForm((f) => ({ ...f, [k]: v }));

  function goTo(next: Step, dir: "forward" | "back") {
    setDirection(dir);
    setError(null);
    setStep(next);
  }

  // ── Step 1: save identity + media ──────────────────────────────
  async function saveIdentity() {
    setBusy(true);
    setError(null);
    try {
      const payload: Partial<Person> = {
        firstName: form.firstName.trim(),
        lastName: form.lastName.trim() || undefined,
        nicknames: form.nickname.trim() ? [form.nickname.trim()] : [],
        cityOfOrigin: form.cityOfOrigin.trim() || undefined,
        birthDate: form.birthDate || undefined,
        deathDate: form.isDeceased && form.deathDate ? form.deathDate : undefined,
      };

      let pid: string;
      if (mode === "create") {
        const created = await personsApi.create(payload);
        addPerson(created);
        pid = created.id;
        setSavedId(pid);
      } else if (person) {
        const updated = await personsApi.update(person.id, payload);
        updatePerson(person.id, updated);
        pid = person.id;
      } else return;

      // Upload direct navigateur → Cloudinary (ne transite pas par le backend).
      for (const f of photoFiles) await mediaApi.uploadDirect(pid, "photo", f);
      for (const f of audioFiles) await mediaApi.uploadDirect(pid, "audio", f);

      // Refresh tree so the person card data is up-to-date without a full reload.
      loadTree().catch(() => {});
      goTo("parents", "forward");
    } catch {
      setError("Echec de l'enregistrement. Reessayez.");
    } finally {
      setBusy(false);
    }
  }

  // ── Remove an existing relationship immediately ────────────────
  async function removeExistingRel(
    relId: string,
    setter: React.Dispatch<React.SetStateAction<PersonDraft[]>>,
  ) {
    try {
      await relationshipsApi.delete(relId);
      deleteRelationship(relId);
      setter((prev) => prev.filter((d) => d.relId !== relId));
      loadTree();
    } catch {
      // keep in list silently
    }
  }

  // ── Save relatives then advance ────────────────────────────────
  async function commitDrafts(drafts: PersonDraft[], nextStep: () => void | Promise<void>) {
    const newDrafts = drafts.filter((d) => !d.relId);
    const currentId = savedId ?? person?.id;
    if (!currentId || newDrafts.length === 0) { nextStep(); return; }
    setBusy(true);
    setError(null);
    try {
      for (const d of newDrafts) {
        const isDirectional = d.relType in INVERSE;

        if (d.existingId) {
          const aId = isDirectional ? d.existingId : currentId;
          const bId = isDirectional ? currentId : d.existingId;
          const rel = await relationshipsApi.create({
            personAId: aId,
            personBId: bId,
            type: d.relType as Relationship["type"],
          });
          addRelationship(rel);
        } else if (d.firstName.trim()) {
          const created = await personsApi.create({
            firstName: d.firstName.trim(),
            lastName: d.lastName.trim() || undefined,
          });
          addPerson(created);
          const aId = isDirectional ? created.id : currentId;
          const bId = isDirectional ? currentId : created.id;
          const rel = await relationshipsApi.create({
            personAId: aId,
            personBId: bId,
            type: d.relType as Relationship["type"],
          });
          addRelationship(rel);
        }
      }
      await nextStep();
    } catch {
      setError("Echec lors de l'ajout des proches. Reessayez.");
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete() {
    if (!person) return;
    if (!confirm(`Supprimer la fiche de ${person.firstName} ?`)) return;
    setBusy(true);
    try {
      await personsApi.delete(person.id);
      deletePerson(person.id);
      onClose();
      loadTree().catch(() => {});
    } catch {
      setError("Echec de la suppression.");
    } finally {
      setBusy(false);
    }
  }

  const stepIndex = STEPS.indexOf(step);
  const currentId = savedId ?? person?.id;
  const others = tree.persons.filter((p) => p.id !== currentId);

  const inputCls =
    "w-full rounded-xl border border-border bg-background px-3.5 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-ring";

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center p-4 sm:items-center">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      <div className="glass relative w-full max-w-lg overflow-hidden rounded-2xl border border-border shadow-2xl">
        {/* Header */}
        <div className="flex items-center gap-3 border-b border-border px-6 py-4">
          <div className="min-w-0 flex-1">
            <h2 className="font-semibold text-foreground">
              {mode === "create" ? "Ajouter une personne" : "Modifier la fiche"}
            </h2>
            <p className="text-xs text-muted-foreground">{STEP_LABELS[step]}</p>
          </div>
          <div className="flex gap-1.5">
            {STEPS.map((s, i) => (
              <div key={s} className={`h-1.5 rounded-full transition-all duration-300 ${
                i === stepIndex ? "w-6 bg-primary" : i < stepIndex ? "w-1.5 bg-primary/40" : "w-1.5 bg-border"
              }`} />
            ))}
          </div>
          <button onClick={onClose} className="grid size-7 place-items-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground">
            <X className="size-4" />
          </button>
        </div>

        {/* Sliding content */}
        <div className="overflow-hidden">
          <div
            key={step}
            className={`animate-slide-${direction === "forward" ? "in" : "in-reverse"} max-h-[72vh] space-y-4 overflow-y-auto px-6 py-5`}
          >
            {/* ── Step 1: Identité ─────────────────────────────── */}
            {step === "identity" && (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-muted-foreground">
                      Prénom <span className="text-destructive">*</span>
                    </label>
                    <input
                      autoFocus
                      required
                      value={form.firstName}
                      onChange={(e) => field("firstName", e.target.value)}
                      placeholder="Aminata"
                      className={inputCls}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-muted-foreground">Nom</label>
                    <input
                      value={form.lastName}
                      onChange={(e) => field("lastName", e.target.value)}
                      placeholder="Diallo"
                      className={inputCls}
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground">Surnom / petit nom</label>
                  <input
                    value={form.nickname}
                    onChange={(e) => field("nickname", e.target.value)}
                    placeholder="Ami"
                    className={inputCls}
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground">Ville d'origine</label>
                  <input
                    value={form.cityOfOrigin}
                    onChange={(e) => field("cityOfOrigin", e.target.value)}
                    placeholder="Dakar"
                    className={inputCls}
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground">Date de naissance</label>
                  <input
                    type="date"
                    value={form.birthDate}
                    onChange={(e) => field("birthDate", e.target.value)}
                    className={inputCls}
                  />
                </div>

                <div className="space-y-2">
                  <label className="flex items-center justify-between text-xs font-medium text-muted-foreground">
                    Décédé(e)
                    <button
                      type="button"
                      onClick={() => field("isDeceased", !form.isDeceased)}
                      className={`relative h-5 w-9 rounded-full transition-colors ${form.isDeceased ? "bg-primary" : "bg-border"}`}
                    >
                      <div className={`absolute top-0.5 size-4 rounded-full bg-white shadow transition-transform ${form.isDeceased ? "left-4.5" : "left-0.5"}`} />
                    </button>
                  </label>
                  {form.isDeceased && (
                    <input
                      type="date"
                      value={form.deathDate}
                      onChange={(e) => field("deathDate", e.target.value)}
                      placeholder="Date de décès"
                      className={inputCls}
                    />
                  )}
                </div>

                {/* Photos */}
                <div className="space-y-2">
                  <label className="text-xs font-medium text-muted-foreground">Photos</label>
                  <div className="flex flex-wrap gap-2">
                    {[...(person?.photos ?? [])].map((ph) => (
                      <div key={ph.id} className="relative size-16 overflow-hidden rounded-xl">
                        <img src={ph.url} alt="" className="h-full w-full object-cover" />
                      </div>
                    ))}
                    {photoFiles.map((f, i) => (
                      <div key={i} className="relative size-16 overflow-hidden rounded-xl ring-2 ring-primary/40">
                        <img src={URL.createObjectURL(f)} alt="" className="h-full w-full object-cover" />
                        <button
                          onClick={() => setPhotoFiles((ps) => ps.filter((_, j) => j !== i))}
                          className="absolute right-0.5 top-0.5 grid size-5 place-items-center rounded-full bg-black/60 text-white"
                        >
                          <X className="size-3" />
                        </button>
                      </div>
                    ))}
                    <button
                      type="button"
                      onClick={() => photoRef.current?.click()}
                      className="flex size-16 items-center justify-center rounded-xl border-2 border-dashed border-border text-muted-foreground hover:border-primary hover:text-primary"
                    >
                      <Plus className="size-5" />
                    </button>
                    <input
                      ref={photoRef}
                      type="file"
                      accept="image/*"
                      multiple
                      hidden
                      onChange={(e) => setPhotoFiles((ps) => [...ps, ...Array.from(e.target.files ?? [])])}
                    />
                  </div>
                </div>

                {/* Audio */}
                <div className="space-y-2">
                  <label className="text-xs font-medium text-muted-foreground">Messages vocaux</label>
                  <div className="space-y-1.5">
                    {[...(person?.audios ?? [])].map((au) => (
                      <div key={au.id} className="flex items-center gap-2 rounded-xl border border-border bg-background px-3 py-2 text-sm">
                        <Mic className="size-3.5 shrink-0 text-primary" />
                        <audio controls src={au.url} className="h-7 flex-1 min-w-0" />
                      </div>
                    ))}
                    {audioFiles.map((f, i) => (
                      <div key={i} className="flex items-center gap-2 rounded-xl border border-primary/30 bg-background px-3 py-2 text-sm">
                        <Mic className="size-3.5 shrink-0 text-primary" />
                        <span className="min-w-0 flex-1 truncate text-foreground">{f.name}</span>
                        <button
                          onClick={() => setAudioFiles((ps) => ps.filter((_, j) => j !== i))}
                          className="text-muted-foreground hover:text-destructive"
                        >
                          <X className="size-3.5" />
                        </button>
                      </div>
                    ))}
                    <div className="flex gap-2">
                      {isRecording ? (
                        <button
                          type="button"
                          onClick={stopRecording}
                          className="flex flex-1 items-center justify-center gap-2 rounded-xl border-2 border-destructive bg-destructive/10 py-2.5 text-sm font-medium text-destructive animate-pulse"
                        >
                          <Square className="size-4" />
                          Arrêter ({recordingSecs}s)
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={startRecording}
                          className="flex flex-1 items-center justify-center gap-2 rounded-xl border-2 border-dashed border-border py-2.5 text-sm text-muted-foreground hover:border-primary hover:text-primary"
                        >
                          <Mic className="size-4" /> Enregistrer
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => audioRef.current?.click()}
                        className="flex flex-1 items-center justify-center gap-2 rounded-xl border-2 border-dashed border-border py-2.5 text-sm text-muted-foreground hover:border-primary hover:text-primary"
                      >
                        <Upload className="size-4" /> Importer
                      </button>
                    </div>
                    <input
                      ref={audioRef}
                      type="file"
                      accept="audio/*"
                      multiple
                      hidden
                      onChange={(e) => setAudioFiles((ps) => [...ps, ...Array.from(e.target.files ?? [])])}
                    />
                  </div>
                </div>

                {error && (
                  <p className="rounded-xl bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>
                )}

                <div className="flex items-center gap-2 pt-1">
                  {mode === "edit" && person && (
                    <button
                      type="button"
                      onClick={handleDelete}
                      disabled={busy}
                      className="grid size-11 shrink-0 place-items-center rounded-xl border border-destructive/30 text-destructive hover:bg-destructive/10 disabled:opacity-50"
                      title="Supprimer"
                    >
                      <Trash2 className="size-4" />
                    </button>
                  )}
                  <button
                    onClick={saveIdentity}
                    disabled={busy || !form.firstName.trim()}
                    className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-primary py-3 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                  >
                    {busy && <Loader2 className="size-4 animate-spin" />}
                    Suivant <ChevronRight className="size-4" />
                  </button>
                </div>
              </>
            )}

            {/* ── Step 2: Parents ───────────────────────────────── */}
            {step === "parents" && (
              <RelativesStep
                title="Parents"
                hint="Père, mère, beau-parent, ou les deux."
                relTypeOptions={[
                  { value: "parent", label: "Parent" },
                  { value: "step_parent", label: "Beau-parent / Parent par alliance" },
                ]}
                defaultRelType="parent"
                entries={parents}
                setEntries={setParents}
                existingPersons={others}
                excludeIds={currentId ? new Set([currentId]) : undefined}
                error={error}
                busy={busy}
                onBack={() => goTo("identity", "back")}
                onNext={() => commitDrafts(parents, () => goTo("siblings", "forward"))}
                onRemoveExisting={(relId) => removeExistingRel(relId, setParents)}
                inputCls={inputCls}
              />
            )}

            {/* ── Step 3: Frères/Sœurs ──────────────────────────── */}
            {step === "siblings" && (
              <RelativesStep
                title="Frères et sœurs"
                relTypeOptions={[
                  { value: "sibling", label: "Frère / Sœur" },
                  { value: "half_sibling", label: "Demi-frère / Demi-sœur" },
                  { value: "step_sibling", label: "Frère / Sœur par alliance" },
                ]}
                defaultRelType="sibling"
                entries={siblings}
                setEntries={setSiblings}
                existingPersons={others}
                excludeIds={currentId ? new Set([currentId]) : undefined}
                error={error}
                busy={busy}
                onBack={() => goTo("parents", "back")}
                onNext={() => commitDrafts(siblings, () => goTo("relatives", "forward"))}
                onRemoveExisting={(relId) => removeExistingRel(relId, setSiblings)}
                inputCls={inputCls}
              />
            )}

            {/* ── Step 4: Autres proches ────────────────────────── */}
            {step === "relatives" && (
              <RelativesStep
                title="Autres proches"
                hint="Vous pourrez toujours en ajouter plus tard."
                relTypeOptions={[
                  { value: "spouse", label: "Conjoint(e)" },
                  { value: "child", label: "Enfant" },
                  { value: "step_child", label: "Beau-fils / Belle-fille" },
                  { value: "grandparent", label: "Grand-parent" },
                  { value: "grandchild", label: "Petit-enfant" },
                  { value: "uncle_aunt", label: "Oncle / Tante" },
                  { value: "nephew_niece", label: "Neveu / Nièce" },
                  { value: "cousin", label: "Cousin(e)" },
                  { value: "homonym", label: "Homonyme" },
                ]}
                defaultRelType="spouse"
                entries={relatives}
                setEntries={setRelatives}
                existingPersons={others}
                excludeIds={currentId ? new Set([currentId]) : undefined}
                error={error}
                busy={busy}
                onBack={() => goTo("siblings", "back")}
                onNext={() => commitDrafts(relatives, async () => {
                  await loadTree();
                  requestFitTree();
                  // Scan cross-arbre après la dernière étape
                  const pid = savedId ?? person?.id;
                  if (pid) {
                    try {
                      const suggestions = await personsApi.getCrossTreeSuggestions(pid);
                      if (suggestions.length > 0) {
                        setCrossTreeMatches(suggestions);
                        setStep("cross_tree" as Step);
                        return; // ne pas fermer — montrer les suggestions
                      }
                    } catch { /* silencieux */ }
                  }
                  onClose();
                })}
                onRemoveExisting={(relId) => removeExistingRel(relId, setRelatives)}
                isLastStep
                inputCls={inputCls}
              />
            )}

            {/* ── Étape cross-arbre : suggestions de doublons dans d'autres arbres ── */}
            {(step as string) === "cross_tree" && (
              <div className="space-y-4 px-6 py-5">
                <CrossTreeSuggestionBanner
                  personName={form.firstName || person?.firstName || ""}
                  matches={crossTreeMatches}
                  onDismiss={onClose}
                />
                <button
                  onClick={onClose}
                  className="w-full rounded-xl border border-border py-2.5 text-sm text-muted-foreground transition-colors hover:bg-muted"
                >
                  Fermer
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── RelativesStep sub-component ───────────────────────────────────

const REL_LABEL: Record<string, string> = {
  parent: "Parent", step_parent: "Beau-parent",
  sibling: "Frère / Sœur", half_sibling: "Demi-frère / Demi-sœur", step_sibling: "Frère/Sœur par alliance",
  spouse: "Conjoint(e)", child: "Enfant", step_child: "Beau-fils / Belle-fille",
  grandparent: "Grand-parent", grandchild: "Petit-enfant",
  uncle_aunt: "Oncle / Tante", nephew_niece: "Neveu / Nièce",
  cousin: "Cousin(e)", homonym: "Homonyme",
};

interface RelativesStepProps {
  title: string;
  hint?: string;
  relTypeOptions: RelativeOption[];
  defaultRelType: string;
  entries: PersonDraft[];
  setEntries: React.Dispatch<React.SetStateAction<PersonDraft[]>>;
  existingPersons: Person[];
  error: string | null;
  busy: boolean;
  onBack: () => void;
  onNext: () => void;
  onRemoveExisting: (relId: string) => void;
  isLastStep?: boolean;
  inputCls: string;
  excludeIds?: Set<string>;
}

function RelativesStep({
  title, hint, relTypeOptions, defaultRelType, entries, setEntries,
  existingPersons, error, busy, onBack, onNext, onRemoveExisting, isLastStep, inputCls,
  excludeIds,
}: RelativesStepProps) {
  const [draftMode, setDraftMode] = useState<"new" | "existing" | null>(null);
  const [draft, setDraft] = useState<PersonDraft>(emptyDraft(defaultRelType));
  const [selectedExisting, setSelectedExisting] = useState<Person | null>(null);

  const dField = (k: keyof PersonDraft, v: string) =>
    setDraft((d) => ({ ...d, [k]: v }));

  const addEntry = () => {
    if (!draft.firstName.trim() && !draft.existingId) return;
    setEntries((e) => [...e, { ...draft, _key: Math.random().toString(36).slice(2) }]);
    setDraft(emptyDraft(defaultRelType));
    setSelectedExisting(null);
    setDraftMode(null);
  };

  const relLabel = (d: PersonDraft) =>
    REL_LABEL[d.relType] ?? relTypeOptions.find((o) => o.value === d.relType)?.label ?? d.relType;

  const personName = (d: PersonDraft) => {
    if (d.existingId) {
      const p = existingPersons.find((x) => x.id === d.existingId);
      if (p) return `${p.firstName} ${p.lastName ?? ""}`.trim();
    }
    return `${d.firstName} ${d.lastName}`.trim();
  };

  return (
    <>
      <p className="text-sm font-medium text-foreground">{title}</p>
      {hint && <p className="text-xs text-muted-foreground/70">{hint}</p>}

      {/* Added entries */}
      {entries.length > 0 && (
        <div className="space-y-2">
          {entries.map((e, i) => (
            <div key={e._key} className="flex items-center justify-between rounded-xl border border-border bg-background px-3 py-2 gap-2">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-foreground">{personName(e)}</p>
                <p className="text-xs text-muted-foreground">
                  {relLabel(e)}
                  {e.relId && <span className="ml-1 text-[10px] opacity-50">· existant</span>}
                </p>
              </div>
              <button
                onClick={() => {
                  if (e.relId) {
                    onRemoveExisting(e.relId);
                  } else {
                    setEntries((es) => es.filter((_, j) => j !== i));
                  }
                }}
                className="shrink-0 text-muted-foreground hover:text-destructive"
              >
                <X className="size-4" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Add form */}
      {draftMode === null ? (
        <div className="flex gap-2">
          <button
            onClick={() => setDraftMode("new")}
            className="flex flex-1 items-center justify-center gap-2 rounded-xl border-2 border-dashed border-border py-3 text-sm text-muted-foreground hover:border-primary hover:text-primary transition-colors"
          >
            <UserPlus className="size-4" /> Nouvelle personne
          </button>
          {existingPersons.length > 0 && (
            <button
              onClick={() => setDraftMode("existing")}
              className="flex flex-1 items-center justify-center gap-2 rounded-xl border-2 border-dashed border-border py-3 text-sm text-muted-foreground hover:border-primary hover:text-primary transition-colors"
            >
              <Check className="size-4" /> Déjà dans l'arbre
            </button>
          )}
        </div>
      ) : draftMode === "new" ? (
        <div className="space-y-3 rounded-xl border border-border bg-background/50 p-3">
          {relTypeOptions.length > 1 && (
            <select value={draft.relType} onChange={(e) => dField("relType", e.target.value)} className={inputCls}>
              {relTypeOptions.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          )}
          <div className="grid grid-cols-2 gap-2">
            <input
              autoFocus
              value={draft.firstName}
              onChange={(e) => dField("firstName", e.target.value)}
              placeholder="Prénom *"
              className={inputCls}
            />
            <input
              value={draft.lastName}
              onChange={(e) => dField("lastName", e.target.value)}
              placeholder="Nom"
              className={inputCls}
            />
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => { setDraftMode(null); setDraft(emptyDraft(defaultRelType)); }}
              className="rounded-xl border border-border px-4 py-2 text-sm text-muted-foreground hover:text-foreground"
            >
              Annuler
            </button>
            <button
              onClick={addEntry}
              disabled={!draft.firstName.trim()}
              className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-primary/10 py-2 text-sm font-medium text-primary hover:bg-primary/20 disabled:opacity-50"
            >
              <Plus className="size-4" /> Ajouter
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-3 rounded-xl border border-border bg-background/50 p-3">
          {relTypeOptions.length > 1 && (
            <select value={draft.relType} onChange={(e) => dField("relType", e.target.value)} className={inputCls}>
              {relTypeOptions.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          )}
          <PersonSearchSelect
            autoFocus
            selected={selectedExisting}
            excludeIds={new Set([
              ...(excludeIds ?? []),
              ...entries.map((e) => e.existingId).filter(Boolean) as string[],
            ])}
            onSelect={(p) => {
              setSelectedExisting(p);
              setDraft((d) => ({ ...d, existingId: p.id }));
            }}
            onClear={() => {
              setSelectedExisting(null);
              setDraft((d) => ({ ...d, existingId: undefined }));
            }}
            placeholder="Rechercher une personne dans l'arbre…"
          />
          <div className="flex gap-2">
            <button
              onClick={() => { setDraftMode(null); setDraft(emptyDraft(defaultRelType)); setSelectedExisting(null); }}
              className="rounded-xl border border-border px-4 py-2 text-sm text-muted-foreground hover:text-foreground"
            >
              Annuler
            </button>
            <button
              onClick={addEntry}
              disabled={!draft.existingId}
              className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-primary/10 py-2 text-sm font-medium text-primary hover:bg-primary/20 disabled:opacity-50"
            >
              Lier
            </button>
          </div>
        </div>
      )}

      {error && (
        <p className="rounded-xl bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>
      )}

      <div className="flex gap-3 pt-1">
        <button
          onClick={onBack}
          disabled={busy}
          className="flex items-center gap-1 rounded-xl border border-border px-4 py-3 text-sm text-muted-foreground hover:text-foreground disabled:opacity-50"
        >
          <ChevronLeft className="size-4" />
        </button>
        <button
          onClick={onNext}
          disabled={busy}
          className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-primary py-3 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
        >
          {busy && <Loader2 className="size-4 animate-spin" />}
          {isLastStep ? "Terminer" : <>Suivant <ChevronRight className="size-4" /></>}
        </button>
      </div>
    </>
  );
}
