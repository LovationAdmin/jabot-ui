import { useState, useRef, useEffect } from "react";
import {
  X, Loader2, Trash2, ChevronRight, ChevronLeft,
  Plus, UserPlus, Check, Upload, Mic, Square,
} from "lucide-react";
import { personsApi, relationshipsApi, mediaApi } from "@/lib/api";
import { useFamilyTreeStore } from "@/lib/store";
import { Person, Relationship } from "@/lib/types";

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
  firstName: string;
  lastName: string;
  gender: "male" | "female" | "other";
  relType: string;
}

function emptyDraft(relType: string): PersonDraft {
  return { _key: Math.random().toString(36).slice(2), firstName: "", lastName: "", gender: "other", relType };
}

interface Props {
  mode: "create" | "edit";
  person?: Person | null;
  onClose: () => void;
}

// ─── Main component ────────────────────────────────────────────────

export function PersonFormDialog({ mode, person, onClose }: Props) {
  const { tree, addPerson, updatePerson, deletePerson, addRelationship } = useFamilyTreeStore();

  const [step, setStep] = useState<Step>("identity");
  const [direction, setDirection] = useState<"forward" | "back">("forward");
  const [savedId, setSavedId] = useState<string | null>(person?.id ?? null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ── Step 1 form ────────────────────────────────────────────────
  const [form, setForm] = useState({
    firstName: person?.firstName ?? "",
    lastName: person?.lastName ?? "",
    nickname: person?.nicknames?.[0] ?? "",
    gender: person?.gender ?? ("other" as Person["gender"]),
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
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => () => { timerRef.current && clearInterval(timerRef.current); }, []);

  async function startRecording() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mr = new MediaRecorder(stream);
      chunksRef.current = [];
      mr.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
      mr.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: "audio/webm" });
        const file = new File([blob], `vocal-${Date.now()}.webm`, { type: "audio/webm" });
        setAudioFiles((ps) => [...ps, file]);
        stream.getTracks().forEach((t) => t.stop());
        setIsRecording(false);
        setRecordingSecs(0);
        timerRef.current && clearInterval(timerRef.current);
      };
      mr.start();
      recorderRef.current = mr;
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
        gender: form.gender,
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

      for (const f of photoFiles) await mediaApi.upload(pid, "photo", f);
      for (const f of audioFiles) await mediaApi.upload(pid, "audio", f);

      if (mode === "edit") {
        onClose();
        return;
      }
      goTo("parents", "forward");
    } catch {
      setError("Echec de l'enregistrement. Reessayez.");
    } finally {
      setBusy(false);
    }
  }

  // ── Save relatives then advance ────────────────────────────────
  async function commitDrafts(drafts: PersonDraft[], nextStep: () => void) {
    if (!savedId || drafts.length === 0) { nextStep(); return; }
    setBusy(true);
    setError(null);
    try {
      for (const d of drafts) {
        if (d.existingId) {
          const rel = await relationshipsApi.create({
            personAId: savedId,
            personBId: d.existingId,
            type: d.relType as Relationship["type"],
          });
          addRelationship(rel);
        } else if (d.firstName.trim()) {
          const created = await personsApi.create({
            firstName: d.firstName.trim(),
            lastName: d.lastName.trim() || undefined,
            gender: d.gender,
          });
          addPerson(created);
          const rel = await relationshipsApi.create({
            personAId: savedId,
            personBId: created.id,
            type: d.relType as Relationship["type"],
          });
          addRelationship(rel);
        }
      }
      nextStep();
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
    } catch {
      setError("Echec de la suppression.");
    } finally {
      setBusy(false);
    }
  }

  const stepIndex = STEPS.indexOf(step);
  const others = tree.persons.filter((p) => p.id !== savedId);

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
          {mode === "create" && (
            <div className="flex gap-1.5">
              {STEPS.map((s, i) => (
                <div key={s} className={`h-1.5 rounded-full transition-all duration-300 ${
                  i === stepIndex ? "w-6 bg-primary" : i < stepIndex ? "w-1.5 bg-primary/40" : "w-1.5 bg-border"
                }`} />
              ))}
            </div>
          )}
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
                    {mode === "edit" ? "Enregistrer" : <>Suivant <ChevronRight className="size-4" /></>}
                  </button>
                </div>
              </>
            )}

            {/* ── Step 2: Parents ───────────────────────────────── */}
            {step === "parents" && (
              <RelativesStep
                title="Ajoutez les parents si vous les connaissez"
                hint="Père, mère, beau-parent, ou les deux."
                relTypeOptions={[
                  { value: "parent", label: "Parent" },
                  { value: "step_parent", label: "Beau-parent / Parent par alliance" },
                ]}
                defaultRelType="parent"
                entries={parents}
                setEntries={setParents}
                existingPersons={others}
                error={error}
                busy={busy}
                onBack={() => goTo("identity", "back")}
                onNext={() => commitDrafts(parents, () => goTo("siblings", "forward"))}
                inputCls={inputCls}
              />
            )}

            {/* ── Step 3: Frères/Sœurs ──────────────────────────── */}
            {step === "siblings" && (
              <RelativesStep
                title="Ajoutez les frères et sœurs si vous les connaissez"
                relTypeOptions={[
                  { value: "sibling", label: "Frère / Sœur" },
                  { value: "half_sibling", label: "Demi-frère / Demi-sœur" },
                  { value: "step_sibling", label: "Frère / Sœur par alliance" },
                ]}
                defaultRelType="sibling"
                entries={siblings}
                setEntries={setSiblings}
                existingPersons={others}
                error={error}
                busy={busy}
                onBack={() => goTo("parents", "back")}
                onNext={() => commitDrafts(siblings, () => goTo("relatives", "forward"))}
                inputCls={inputCls}
              />
            )}

            {/* ── Step 4: Autres proches ────────────────────────── */}
            {step === "relatives" && (
              <RelativesStep
                title="Ajoutez d'autres proches"
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
                defaultRelType="grandparent"
                entries={relatives}
                setEntries={setRelatives}
                existingPersons={others}
                error={error}
                busy={busy}
                onBack={() => goTo("siblings", "back")}
                onNext={() => commitDrafts(relatives, onClose)}
                isLastStep
                inputCls={inputCls}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── RelativesStep sub-component ───────────────────────────────────

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
  isLastStep?: boolean;
  inputCls: string;
}

function RelativesStep({
  title, hint, relTypeOptions, defaultRelType, entries, setEntries,
  existingPersons, error, busy, onBack, onNext, isLastStep, inputCls,
}: RelativesStepProps) {
  const [draftMode, setDraftMode] = useState<"new" | "existing" | null>(null);
  const [draft, setDraft] = useState<PersonDraft>(emptyDraft(defaultRelType));

  const dField = (k: keyof PersonDraft, v: string) =>
    setDraft((d) => ({ ...d, [k]: v }));

  const addEntry = () => {
    if (!draft.firstName.trim() && !draft.existingId) return;
    setEntries((e) => [...e, { ...draft, _key: Math.random().toString(36).slice(2) }]);
    setDraft(emptyDraft(defaultRelType));
    setDraftMode(null);
  };

  const relLabel = (d: PersonDraft) =>
    relTypeOptions.find((o) => o.value === d.relType)?.label ?? d.relType;

  const existingName = (d: PersonDraft) => {
    const p = existingPersons.find((x) => x.id === d.existingId);
    return p ? `${p.firstName} ${p.lastName}`.trim() : "";
  };

  return (
    <>
      <p className="text-sm text-muted-foreground">{title}</p>
      {hint && <p className="text-xs text-muted-foreground/70">{hint}</p>}

      {/* Added entries */}
      {entries.length > 0 && (
        <div className="space-y-2">
          {entries.map((e, i) => (
            <div key={e._key} className="flex items-center justify-between rounded-xl border border-border bg-background px-3 py-2 gap-2">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-foreground">
                  {e.existingId ? existingName(e) : `${e.firstName} ${e.lastName}`.trim()}
                </p>
                <p className="text-xs text-muted-foreground">{relLabel(e)}</p>
              </div>
              <button
                onClick={() => setEntries((es) => es.filter((_, j) => j !== i))}
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
          <div className="grid grid-cols-3 gap-2">
            {(["male", "female", "other"] as const).map((g) => (
              <button
                key={g}
                type="button"
                onClick={() => dField("gender", g)}
                className={`rounded-xl border py-2 text-xs font-medium transition-colors ${
                  draft.gender === g
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border bg-background text-muted-foreground hover:border-primary/50"
                }`}
              >
                {g === "male" ? "Homme" : g === "female" ? "Femme" : "Autre"}
              </button>
            ))}
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
          <select
            autoFocus
            value={draft.existingId ?? ""}
            onChange={(e) => setDraft((d) => ({ ...d, existingId: e.target.value || undefined }))}
            className={inputCls}
          >
            <option value="">Choisir une personne…</option>
            {existingPersons.map((p) => (
              <option key={p.id} value={p.id}>{p.firstName} {p.lastName}</option>
            ))}
          </select>
          <div className="flex gap-2">
            <button
              onClick={() => { setDraftMode(null); setDraft(emptyDraft(defaultRelType)); }}
              className="rounded-xl border border-border px-4 py-2 text-sm text-muted-foreground hover:text-foreground"
            >
              Annuler
            </button>
            <button
              onClick={addEntry}
              disabled={!draft.existingId}
              className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-primary/10 py-2 text-sm font-medium text-primary hover:bg-primary/20 disabled:opacity-50"
            >
              <Check className="size-4" /> Lier
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
