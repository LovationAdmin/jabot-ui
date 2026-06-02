import { useState, useRef } from "react";
import { Person, Relationship } from "@/lib/types";
import { X, Calendar, MapPin, Music, ImageIcon, Pencil, Lock, Unlink, Plus, UserCheck, Trash2, Loader2, Upload, Mic, Square, UserPlus } from "lucide-react";
import { relationshipsApi, personsApi, mediaApi } from "@/lib/api";
import { startVoiceRecording, VoiceRecorder } from "@/lib/recorder";
import { useFamilyTreeStore } from "@/lib/store";
import { PersonSearchSelect } from "./PersonSearchSelect";
import { computeSurnameStats, buildSurnameColorMap, normalizeSurname } from "@/lib/surnameColors";

// ─── Libellés de relations ─────────────────────────────────────────

const REL_LABEL: Record<string, string> = {
  parent:       "Parent",
  child:        "Enfant",
  sibling:      "Frere / Soeur",
  half_sibling: "Demi-frere / Demi-soeur",
  step_sibling: "Frere / Soeur par alliance",
  step_parent:  "Beau-parent",
  step_child:   "Beau-fils / Belle-fille",
  spouse:       "Conjoint(e)",
  grandparent:  "Grand-parent",
  grandchild:   "Petit-enfant",
  uncle_aunt:   "Oncle / Tante",
  nephew_niece: "Neveu / Niece",
  cousin:       "Cousin(e)",
  homonym:      "Homonyme",
};

// ─── Onglets ───────────────────────────────────────────────────────

interface RelGroup {
  key: string;
  label: string;
  types: string[];
  inferred?: boolean; // calculé sur 2 niveaux, pas de relId disponible
}

const REL_GROUPS: RelGroup[] = [
  { key: "spouse",      label: "Conjoints",         types: ["spouse"] },
  { key: "parent",      label: "Parents",            types: ["parent", "step_parent"] },
  { key: "grandparent", label: "Grands-parents",     types: ["grandparent"], inferred: true },
  { key: "sibling",     label: "Fratrie",            types: ["sibling", "half_sibling", "step_sibling"] },
  { key: "child",       label: "Enfants",            types: ["child", "step_child"] },
  { key: "grandchild",  label: "Petits-enfants",     types: ["grandchild"], inferred: true },
  { key: "uncle_aunt",  label: "Oncles / Tantes",    types: ["uncle_aunt"], inferred: true },
  { key: "nephew_niece",label: "Neveux / Nieces",    types: ["nephew_niece"], inferred: true },
  { key: "cousin",      label: "Cousins",            types: ["cousin"], inferred: true },
  { key: "homonym",     label: "Homonymes",          types: ["homonym"] },
];

interface RelEntry {
  person: Person;
  relId?: string;   // disponible seulement pour les relations directes
  relType: string;
  inferred: boolean;
}

function buildGroups(
  personId: string,
  allPersons: Person[],
  relationships: Relationship[],
): Record<string, RelEntry[]> {
  const byId = new Map(allPersons.map((p) => [p.id, p]));

  const directRels = relationships.filter(
    (r) => r.personAId === personId || r.personBId === personId,
  );
  const otherId = (r: Relationship) =>
    r.personAId === personId ? r.personBId : r.personAId;

  // Les types DIRECTIONNELS dépendent du sens de l'arête : person_a EST le
  // <type> de person_b (ex: parent → person_a est parent de person_b).
  // Selon que `personId` est person_a ou person_b, le rôle s'inverse.
  //   - parent ↔ child
  //   - grandparent ↔ grandchild
  //   - uncle_aunt ↔ nephew_niece
  //   - step_parent ↔ step_child
  // Les types SYMÉTRIQUES (sibling, spouse, cousin, homonym…) ne s'inversent pas.
  const INVERSE: Record<string, string> = {
    parent: "child", child: "parent",
    grandparent: "grandchild", grandchild: "grandparent",
    uncle_aunt: "nephew_niece", nephew_niece: "uncle_aunt",
    step_parent: "step_child", step_child: "step_parent",
  };

  // Rôle EFFECTIF de l'autre personne vu depuis `personId`.
  // Si personId est person_b sur une arête "parent", l'autre (person_a) est
  // bien son parent → rôle "parent". Si personId est person_a, l'autre
  // (person_b) est son enfant → rôle inversé "child".
  const effectiveType = (r: Relationship): string => {
    if (r.personBId === personId && INVERSE[r.type]) {
      // personId est la cible (person_b) : le type reste tel quel côté "autre".
      return r.type;
    }
    if (r.personAId === personId && INVERSE[r.type]) {
      // personId est la source (person_a) : on inverse le rôle de l'autre.
      return INVERSE[r.type];
    }
    return r.type; // type symétrique
  };

  // Helper : retourne les entrées dont le rôle effectif correspond aux types.
  const directOfType = (...types: string[]): RelEntry[] =>
    directRels
      .filter((r) => types.includes(effectiveType(r)))
      .flatMap((r) => {
        const p = byId.get(otherId(r));
        return p ? [{ person: p, relId: r.id, relType: effectiveType(r), inferred: false }] : [];
      });

  const dedup = (arr: RelEntry[]): RelEntry[] =>
    arr.filter((e, i, a) => a.findIndex((x) => x.person.id === e.person.id) === i);

  // ── Adjacence sanguine (parent/enfant) pour la déduction ───────────
  // On construit les liens de filiation à partir des arêtes parent/child
  // uniquement (les liens par alliance step_* restent traités à part).
  const bloodParents = new Map<string, Set<string>>(); // enfant → {parents}
  const bloodChildren = new Map<string, Set<string>>(); // parent → {enfants}
  const addEdge = (parent: string, child: string) => {
    if (!bloodParents.has(child)) bloodParents.set(child, new Set());
    bloodParents.get(child)!.add(parent);
    if (!bloodChildren.has(parent)) bloodChildren.set(parent, new Set());
    bloodChildren.get(parent)!.add(child);
  };
  for (const r of relationships) {
    if (r.type === "parent") addEdge(r.personAId, r.personBId);       // A parent de B
    else if (r.type === "child") addEdge(r.personBId, r.personAId);   // A enfant de B
  }
  const parentsOf = (pid: string) => bloodParents.get(pid) ?? new Set<string>();
  const childrenOf = (pid: string) => bloodChildren.get(pid) ?? new Set<string>();

  // Fratrie déduite des parents communs : 2+ parents communs → frère/sœur
  // plein ; exactement 1 parent commun → demi-frère/demi-sœur.
  const deducedSiblings = (pid: string): RelEntry[] => {
    const mine = parentsOf(pid);
    if (mine.size === 0) return [];
    const out: RelEntry[] = [];
    for (const q of allPersons) {
      if (q.id === pid) continue;
      const theirs = parentsOf(q.id);
      let common = 0;
      for (const p of mine) if (theirs.has(p)) common++;
      if (common === 0) continue;
      const relType = common >= 2 ? "sibling" : "half_sibling";
      out.push({ person: q, relId: undefined, relType, inferred: true });
    }
    return out;
  };

  // Enfants déduits (via filiation sanguine) d'un ensemble de personnes.
  const deducedChildren = (sources: Person[], relType: string): RelEntry[] =>
    sources.flatMap((src) =>
      [...childrenOf(src.id)].flatMap((cid) => {
        if (cid === personId) return [];
        const p = byId.get(cid);
        return p ? [{ person: p, relId: undefined, relType, inferred: true }] : [];
      }),
    );

  // Parents déduits (via filiation sanguine) d'un ensemble de personnes.
  const deducedParents = (sources: Person[], relType: string): RelEntry[] =>
    sources.flatMap((src) =>
      [...parentsOf(src.id)].flatMap((pid) => {
        if (pid === personId) return [];
        const p = byId.get(pid);
        return p ? [{ person: p, relId: undefined, relType, inferred: true }] : [];
      }),
    );

  const parents  = directOfType("parent", "step_parent");
  const children = directOfType("child", "step_child");

  // Fratrie : liens explicites (incl. par alliance) + déduction parents communs.
  // Les liens explicites priment (dedup garde la 1re occurrence) pour conserver
  // un éventuel relId et un type saisi manuellement.
  const siblings = dedup([
    ...directOfType("sibling", "half_sibling", "step_sibling"),
    ...deducedSiblings(personId),
  ]);

  // Grands-parents : parents des parents (+ explicites).
  const grandparents = dedup([
    ...directOfType("grandparent"),
    ...deducedParents(parents.map((e) => e.person), "grandparent"),
  ]);
  // Petits-enfants : enfants des enfants (+ explicites).
  const grandchildren = dedup([
    ...directOfType("grandchild"),
    ...deducedChildren(children.map((e) => e.person), "grandchild"),
  ]);
  // Oncles/tantes : fratrie des parents (+ explicites). On déduit la fratrie
  // de CHAQUE parent via les parents communs, pas seulement les liens saisis.
  const unclesAunts = dedup([
    ...directOfType("uncle_aunt"),
    ...parents.flatMap((e) => deducedSiblings(e.person.id)
      .map((s) => ({ ...s, relType: "uncle_aunt" }))),
  ]).filter((e) => e.person.id !== personId);
  // Cousins : enfants des oncles/tantes (+ explicites).
  const cousins = dedup([
    ...directOfType("cousin"),
    ...deducedChildren(unclesAunts.map((e) => e.person), "cousin"),
  ]).filter((e) => e.person.id !== personId);
  // Neveux/nièces : enfants de la fratrie (+ explicites).
  const nephewsNieces = dedup([
    ...directOfType("nephew_niece"),
    ...deducedChildren(siblings.map((e) => e.person), "nephew_niece"),
  ]).filter((e) => e.person.id !== personId);

  return {
    spouse:       dedup(directOfType("spouse")),
    parent:       dedup(parents),
    grandparent:  grandparents,
    sibling:      siblings,
    child:        dedup(children),
    grandchild:   grandchildren,
    uncle_aunt:   unclesAunts,
    nephew_niece: nephewsNieces,
    cousin:       cousins,
    homonym:      dedup(directOfType("homonym")),
  };
}

// ─── Composant principal ───────────────────────────────────────────

interface EditPanelProps {
  person: Person | null;
  allPersons: Person[];
  relationships: Relationship[];
  onClose: () => void;
  onSelectPerson: (id: string) => void;
  isAuthenticated?: boolean;
  onEdit?: (person: Person) => void;
}

export function EditPanel({
  person, allPersons, relationships, onClose, onSelectPerson,
  isAuthenticated, onEdit,
}: EditPanelProps) {
  const { deleteRelationship, addRelationship, addPerson, loadTree, getPersonById, deletePerson, updatePerson } = useFamilyTreeStore();

  // Couleurs par nom de famille (même dégradé que le canvas) → report sur les
  // liens de parenté pour identifier d'un coup d'œil la lignée de chaque proche.
  const surnameColorMap = buildSurnameColorMap(computeSurnameStats(allPersons));
  const surnameColorOf = (p: Person) => surnameColorMap.get(normalizeSurname(p.lastName));
  const [activeGroup, setActiveGroup] = useState("parent");
  const [unlinking, setUnlinking] = useState<string | null>(null);
  const [linkMode, setLinkMode] = useState<{ groupKey: string; relType: string } | null>(null);
  const [linkTarget, setLinkTarget] = useState<Person | null>(null);
  const [linkBusy, setLinkBusy] = useState(false);
  const [deleting, setDeleting] = useState(false);
  // Sous-mode du formulaire de liaison : choisir une fiche existante ou en créer une.
  const [createNew, setCreateNew] = useState(false);
  const [newFirst, setNewFirst] = useState("");
  const [newLast, setNewLast] = useState("");
  const [newBirth, setNewBirth] = useState("");

  // Media state
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [deletingMedia, setDeletingMedia] = useState<string | null>(null);
  const [recording, setRecording] = useState(false);
  const [uploadingAudio, setUploadingAudio] = useState(false);
  const [audioProgress, setAudioProgress] = useState(0);
  const [photoProgress, setPhotoProgress] = useState(0);
  const photoInputRef = useRef<HTMLInputElement>(null);
  const audioInputRef = useRef<HTMLInputElement>(null);
  const voiceRecorderRef = useRef<VoiceRecorder | null>(null);

  if (!person) return null;

  const fullName = [person.firstName, person.lastName].filter(Boolean).join(" ");
  const photo = person.photos[0];
  const groups = buildGroups(person.id, allPersons, relationships);
  const nonEmptyGroups = REL_GROUPS.filter((g) => groups[g.key]?.length > 0);
  // L'onglet actif est respecté tant qu'il correspond à un groupe valide —
  // y compris un groupe vide (ex: « Enfants » sans enfant encore lié), pour
  // pouvoir y rattacher une personne. À défaut, on retombe sur le premier
  // groupe non vide, sinon « Parents ».
  const currentGroup = REL_GROUPS.find((g) => g.key === activeGroup)
    ? activeGroup
    : nonEmptyGroups[0]?.key ?? "parent";

  async function handleUnlink(relId: string) {
    setUnlinking(relId);
    try {
      await relationshipsApi.delete(relId);
      deleteRelationship(relId);
    } finally {
      setUnlinking(null);
    }
  }

  async function handleDeletePerson() {
    if (!person) return;
    if (!confirm(`Supprimer définitivement la fiche de ${fullName} ? Cette action est irréversible.`)) return;
    setDeleting(true);
    try {
      await personsApi.delete(person.id);
      deletePerson(person.id);
      onClose();
    } catch {
      alert("Échec de la suppression. Réessayez.");
    } finally {
      setDeleting(false);
    }
  }

  function resetLinkForm() {
    setLinkMode(null);
    setLinkTarget(null);
    setCreateNew(false);
    setNewFirst("");
    setNewLast("");
    setNewBirth("");
  }

  // Crée l'arête entre la personne courante et `targetId` selon le rôle choisi.
  // Convention : type "parent" = personAId IS PARENT OF personBId.
  // Règle universelle pour les types directionnels : personAId = cible
  // (porteur du rôle), personBId = personne courante (point de vue). Les types
  // symétriques (spouse, sibling…) : l'ordre n'a pas d'importance.
  async function createRelationship(targetId: string, relType: string) {
    const DIRECTIONAL = new Set([
      "parent", "child", "step_parent", "step_child",
      "grandparent", "grandchild", "uncle_aunt", "nephew_niece",
    ]);
    const isDirectional = DIRECTIONAL.has(relType);
    const rel = await relationshipsApi.create({
      personAId: isDirectional ? targetId : person!.id,
      personBId: isDirectional ? person!.id : targetId,
      type: relType as Relationship["type"],
    });
    addRelationship(rel);
  }

  async function handleLink() {
    if (!linkMode || !linkTarget || !person) return;
    setLinkBusy(true);
    try {
      await createRelationship(linkTarget.id, linkMode.relType);
      resetLinkForm();
      loadTree();
    } finally {
      setLinkBusy(false);
    }
  }

  async function handleCreateAndLink() {
    if (!linkMode || !person || !newFirst.trim()) return;
    setLinkBusy(true);
    try {
      const created = await personsApi.create({
        firstName: newFirst.trim(),
        lastName: newLast.trim() || undefined,
        birthDate: newBirth.trim() || undefined,
      });
      addPerson(created);
      await createRelationship(created.id, linkMode.relType);
      resetLinkForm();
      loadTree();
    } catch {
      alert("Échec de la création de la fiche. Réessayez.");
    } finally {
      setLinkBusy(false);
    }
  }

  async function handlePhotoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !person) return;
    setUploadingPhoto(true);
    setPhotoProgress(0);
    try {
      const media = await mediaApi.uploadDirect(person.id, "photo", file, setPhotoProgress);
      updatePerson(person.id, { photos: [...person.photos, media] });
    } catch {
      alert("Échec de l'envoi de la photo.");
    } finally {
      setUploadingPhoto(false);
      setPhotoProgress(0);
      if (photoInputRef.current) photoInputRef.current.value = "";
    }
  }

  async function handleDeleteMedia(mediaId: string, type: "photo" | "audio") {
    if (!person) return;
    setDeletingMedia(mediaId);
    try {
      await mediaApi.delete(mediaId);
      if (type === "photo") {
        updatePerson(person.id, { photos: person.photos.filter((m) => m.id !== mediaId) });
      } else {
        updatePerson(person.id, { audios: person.audios.filter((m) => m.id !== mediaId) });
      }
    } catch {
      alert("Échec de la suppression.");
    } finally {
      setDeletingMedia(null);
    }
  }

  async function handleAudioFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !person) return;
    setUploadingAudio(true);
    setAudioProgress(0);
    try {
      const media = await mediaApi.uploadDirect(person.id, "audio", file, setAudioProgress);
      updatePerson(person.id, { audios: [...person.audios, media] });
    } catch {
      alert("Échec de l'envoi de l'audio.");
    } finally {
      setUploadingAudio(false);
      setAudioProgress(0);
      if (audioInputRef.current) audioInputRef.current.value = "";
    }
  }

  async function uploadRecordedAudio(file: File) {
    if (!person) return;
    setUploadingAudio(true);
    setAudioProgress(0);
    try {
      const media = await mediaApi.uploadDirect(person.id, "audio", file, setAudioProgress);
      updatePerson(person.id, { audios: [...person.audios, media] });
    } catch {
      alert("Échec de l'envoi de l'enregistrement.");
    } finally {
      setUploadingAudio(false);
      setAudioProgress(0);
    }
  }

  async function startRecording() {
    try {
      voiceRecorderRef.current = await startVoiceRecording(
        (file) => { setRecording(false); uploadRecordedAudio(file); },
        () => { setRecording(false); alert("Erreur pendant l'enregistrement."); },
      );
      setRecording(true);
    } catch {
      alert("Impossible d'accéder au microphone.");
    }
  }

  function stopRecording() {
    voiceRecorderRef.current?.stop();
    voiceRecorderRef.current = null;
  }

  // Personnes déjà liées + soi-même : à exclure du typeahead de liaison.
  const linkedIds = new Set(
    Object.values(groups).flat().map((e) => e.person.id).concat([person.id]),
  );

  // Contexte familial de la personne courante, transmis à la recherche pour
  // booster les candidats de la même famille (désambiguïsation des homonymes).
  // Les parents de la personne courante sont aussi les parents de sa fratrie ;
  // sa fratrie (+ elle-même) sont les frères/sœurs potentiels d'un candidat.
  const searchContext = {
    parentNames: (groups.parent ?? []).map((e) => e.person.firstName).filter(Boolean) as string[],
    siblingNames: [
      ...(groups.sibling ?? []).map((e) => e.person.firstName),
      person.firstName,
    ].filter(Boolean) as string[],
  };

  // Groupes disponibles pour lier directement (pas inférés)
  const directGroups = REL_GROUPS.filter((g) => !g.inferred);

  // Options de type de relation pour un groupe donné
  const relOptionsFor = (groupKey: string): Array<{ value: string; label: string }> => {
    const g = REL_GROUPS.find((x) => x.key === groupKey);
    return (g?.types ?? []).map((t) => ({ value: t, label: REL_LABEL[t] ?? t }));
  };

  return (
    <aside className="flex max-h-[44vh] sm:max-h-none h-full w-full sm:w-80 shrink-0 flex-col border-l border-border/60 bg-card">
      {/* Indicateur de glissement (mobile uniquement) */}
      <div className="flex justify-center pt-2 pb-0 sm:hidden">
        <div className="h-1 w-10 rounded-full bg-border" />
      </div>

      {/* Header */}
      <div className="flex items-center justify-between border-b border-border/60 px-5 py-4">
        <h2 className="font-display text-lg font-semibold text-foreground">Fiche</h2>
        <button
          onClick={onClose}
          className="grid size-7 place-items-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          <X className="size-4" />
        </button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="p-5">
          {/* Photo */}
          <div className="relative mx-auto mb-4 size-24 overflow-hidden rounded-3xl">
            {isAuthenticated && photo ? (
              <img src={photo.url} alt={fullName} className="h-full w-full object-cover" />
            ) : isAuthenticated ? (
              <div className="brand-gradient flex h-full w-full items-center justify-center text-4xl text-white">
                {person.firstName?.[0]?.toUpperCase() ?? "?"}
              </div>
            ) : (
              <div className="flex h-full w-full items-center justify-center bg-muted">
                <Lock className="size-8 text-muted-foreground" />
              </div>
            )}
          </div>

          {/* Nom */}
          <div className="mb-5 text-center">
            <h3 className="font-display text-2xl font-bold text-foreground">{fullName}</h3>
            {isAuthenticated && person.nicknames && person.nicknames.length > 0 && (
              <p className="mt-0.5 text-sm text-primary/80">&laquo; {person.nicknames.join(", ")} &raquo;</p>
            )}
            {/* Badge homonyme */}
            {groups.homonym?.length > 0 && (
              <div className="mt-1.5 flex flex-wrap justify-center gap-1">
                {groups.homonym.map((e) => (
                  <span key={e.person.id} className="rounded-full border border-amber-400/40 bg-amber-400/10 px-2 py-0.5 text-[10px] font-medium text-amber-600">
                    Homonyme de {e.person.firstName} {e.person.lastName}
                  </span>
                ))}
              </div>
            )}
            {!isAuthenticated && (
              <p className="mt-2 text-xs text-muted-foreground">
                <a href="/auth" className="text-primary underline underline-offset-2">Connectez-vous</a> pour voir le profil complet
              </p>
            )}
          </div>

          {/* Détails — auth seulement */}
          {isAuthenticated && (
            <div className="mb-5 space-y-2 text-sm">
              {(person.birthDate || person.deathDate) && (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Calendar className="size-3.5 shrink-0" />
                  <span>{person.birthDate ?? "?"}{person.deathDate ? ` - ${person.deathDate}` : ""}</span>
                </div>
              )}
              {person.cityOfOrigin && (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <MapPin className="size-3.5 shrink-0" />
                  <span>{person.cityOfOrigin}</span>
                </div>
              )}
            </div>
          )}
          {!isAuthenticated && person.cityOfOrigin && (
            <div className="mb-5 flex items-center gap-2 text-sm text-muted-foreground">
              <MapPin className="size-3.5 shrink-0" />
              <span>{person.cityOfOrigin}</span>
            </div>
          )}

          {/* Photos */}
          {isAuthenticated && (
            <div className="mb-5">
              <div className="mb-2 flex items-center justify-between">
                <p className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  <ImageIcon className="size-3" /> Photos
                </p>
                {person.photos.length < 3 && (
                  <>
                    <input ref={photoInputRef} type="file" accept="image/*" className="hidden" onChange={handlePhotoUpload} />
                    <button
                      onClick={() => photoInputRef.current?.click()}
                      disabled={uploadingPhoto}
                      className="flex items-center gap-1 rounded-lg border border-border px-2 py-0.5 text-[10px] text-muted-foreground transition-colors hover:border-primary hover:text-primary disabled:opacity-50"
                    >
                      {uploadingPhoto ? <Loader2 className="size-3 animate-spin" /> : <Upload className="size-3" />}
                      {uploadingPhoto ? `${Math.round(photoProgress * 100)}%` : "Ajouter"}
                    </button>
                  </>
                )}
              </div>
              {person.photos.length > 0 ? (
                <div className="grid grid-cols-3 gap-1.5">
                  {person.photos.map((ph) => (
                    <div key={ph.id} className="relative group aspect-square">
                      <img src={ph.url} alt="" className="h-full w-full rounded-xl object-cover" />
                      <button
                        onClick={() => handleDeleteMedia(ph.id, "photo")}
                        disabled={deletingMedia === ph.id}
                        className="absolute right-1 top-1 hidden group-hover:grid size-5 place-items-center rounded-full bg-black/60 text-white transition-opacity hover:bg-destructive"
                      >
                        {deletingMedia === ph.id ? <Loader2 className="size-2.5 animate-spin" /> : <X className="size-2.5" />}
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-muted-foreground/60">Aucune photo</p>
              )}
            </div>
          )}

          {/* Audio */}
          {isAuthenticated && (
            <div className="mb-5">
              <div className="mb-2 flex items-center justify-between">
                <p className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  <Music className="size-3" /> Messages audio
                </p>
                {person.audios.length < 3 && (
                  <div className="flex items-center gap-1">
                    <input ref={audioInputRef} type="file" accept="audio/*" className="hidden" onChange={handleAudioFileUpload} />
                    <button
                      onClick={() => audioInputRef.current?.click()}
                      disabled={uploadingAudio || recording}
                      className="flex items-center gap-1 rounded-lg border border-border px-2 py-0.5 text-[10px] text-muted-foreground transition-colors hover:border-primary hover:text-primary disabled:opacity-50"
                    >
                      {uploadingAudio ? <Loader2 className="size-3 animate-spin" /> : <Upload className="size-3" />}
                      {uploadingAudio ? `${Math.round(audioProgress * 100)}%` : ""}
                    </button>
                    <button
                      onClick={recording ? stopRecording : startRecording}
                      disabled={uploadingAudio}
                      className={`flex items-center gap-1 rounded-lg border px-2 py-0.5 text-[10px] transition-colors disabled:opacity-50 ${
                        recording
                          ? "border-destructive bg-destructive/10 text-destructive hover:bg-destructive/20 animate-pulse"
                          : "border-border text-muted-foreground hover:border-primary hover:text-primary"
                      }`}
                    >
                      {recording ? <Square className="size-3" /> : <Mic className="size-3" />}
                      {recording ? "Arrêter" : "Enregistrer"}
                    </button>
                  </div>
                )}
              </div>
              {person.audios.length > 0 ? (
                <div className="space-y-2">
                  {person.audios.map((au) => (
                    <div key={au.id} className="flex items-center gap-2">
                      <audio controls src={au.url} className="min-w-0 flex-1 h-8" style={{ height: "32px" }} />
                      <button
                        onClick={() => handleDeleteMedia(au.id, "audio")}
                        disabled={deletingMedia === au.id}
                        className="grid size-7 shrink-0 place-items-center rounded-lg border border-border text-muted-foreground transition-colors hover:border-destructive/40 hover:text-destructive disabled:opacity-50"
                      >
                        {deletingMedia === au.id ? <Loader2 className="size-3 animate-spin" /> : <Trash2 className="size-3" />}
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-muted-foreground/60">Aucun audio</p>
              )}
            </div>
          )}
        </div>

        {/* ── Onglets famille ───────────────────────────────── */}
        <div className="border-t border-border/60">
          {/* Tab bar */}
          <div className="flex overflow-x-auto border-b border-border/60 px-2 pt-1 scrollbar-none">
            {REL_GROUPS.map((g) => {
              const count = groups[g.key]?.length ?? 0;
              return (
                <button
                  key={g.key}
                  onClick={() => setActiveGroup(g.key)}
                  className={`shrink-0 whitespace-nowrap rounded-t-lg px-3 py-2 text-xs font-medium transition-colors ${
                    currentGroup === g.key
                      ? "border-b-2 border-primary text-primary"
                      : count > 0
                      ? "text-muted-foreground hover:text-foreground"
                      : "text-muted-foreground/40 hover:text-muted-foreground"
                  }`}
                >
                  {g.label}
                  {count > 0 && (
                    <span className="ml-1 text-[10px] opacity-60">({count})</span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Tab content */}
          <div className="space-y-1.5 p-3">
            {/* État vide pour un groupe direct : invite à rattacher */}
            {isAuthenticated
              && (groups[currentGroup]?.length ?? 0) === 0
              && directGroups.some((g) => g.key === currentGroup)
              && linkMode?.groupKey !== currentGroup && (
              <p className="px-1 py-2 text-center text-xs text-muted-foreground">
                Aucun lien pour le moment. Rattachez une personne existante ci-dessous.
              </p>
            )}
            {(groups[currentGroup] ?? []).map((entry) => {
              const sc = surnameColorOf(entry.person);
              return (
              <div key={entry.person.id} className="flex items-center gap-2">
                <button
                  onClick={() => onSelectPerson(entry.person.id)}
                  className="relative flex flex-1 items-center gap-2.5 overflow-hidden rounded-xl border border-border bg-background px-3 py-2 pl-4 text-left transition-colors hover:border-primary/40 hover:bg-muted min-w-0"
                >
                  {/* Liseré couleur du nom de famille (même dégradé que le canvas). */}
                  {sc && (
                    <span
                      aria-hidden
                      className="pointer-events-none absolute inset-y-0 left-0 w-1.5"
                      style={{ backgroundColor: sc.band }}
                    />
                  )}
                  <div
                    className="flex size-8 shrink-0 items-center justify-center rounded-full text-sm font-bold"
                    style={sc
                      ? { backgroundColor: sc.soft, color: sc.text }
                      : undefined}
                  >
                    <span className={sc ? "" : "text-primary"}>
                      {entry.person.firstName?.[0]?.toUpperCase() ?? "?"}
                    </span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-foreground">
                      {[entry.person.firstName, entry.person.lastName].filter(Boolean).join(" ")}
                    </p>
                    <p className="text-[10px] text-muted-foreground">
                      {REL_LABEL[entry.relType] ?? entry.relType}
                      {entry.inferred && " ·"}
                      {entry.inferred && <span className="italic opacity-60"> déduit</span>}
                    </p>
                  </div>
                </button>

                {/* Bouton dissocier — seulement pour liens directs */}
                {isAuthenticated && entry.relId && (
                  <button
                    onClick={() => handleUnlink(entry.relId!)}
                    disabled={unlinking === entry.relId}
                    title="Dissocier ce lien"
                    className="grid size-8 shrink-0 place-items-center rounded-xl border border-border text-muted-foreground transition-colors hover:border-destructive/40 hover:bg-destructive/10 hover:text-destructive disabled:opacity-50"
                  >
                    {unlinking === entry.relId ? (
                      <div className="size-3 animate-spin rounded-full border border-current border-t-transparent" />
                    ) : (
                      <Unlink className="size-3.5" />
                    )}
                  </button>
                )}
              </div>
              );
            })}

            {/* Lier / créer une personne (auth + onglet direct) */}
            {isAuthenticated && directGroups.some((g) => g.key === currentGroup) && (
              <>
                {linkMode?.groupKey === currentGroup ? (
                  <div className="mt-2 space-y-2 rounded-xl border border-border bg-background/50 p-3">
                    {/* Type de relation */}
                    <select
                      value={linkMode.relType}
                      onChange={(e) => setLinkMode({ groupKey: currentGroup, relType: e.target.value })}
                      className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus:border-primary focus:outline-none"
                    >
                      {relOptionsFor(currentGroup).map((o) => (
                        <option key={o.value} value={o.value}>{o.label}</option>
                      ))}
                    </select>

                    {/* Bascule existante / nouvelle */}
                    <div className="flex gap-1 rounded-lg bg-muted p-0.5 text-xs">
                      <button
                        onClick={() => setCreateNew(false)}
                        className={`flex-1 rounded-md py-1.5 font-medium transition-colors ${!createNew ? "bg-card text-foreground shadow-sm" : "text-muted-foreground"}`}
                      >
                        Fiche existante
                      </button>
                      <button
                        onClick={() => setCreateNew(true)}
                        className={`flex-1 rounded-md py-1.5 font-medium transition-colors ${createNew ? "bg-card text-foreground shadow-sm" : "text-muted-foreground"}`}
                      >
                        Nouvelle fiche
                      </button>
                    </div>

                    {createNew ? (
                      <div className="space-y-2">
                        <input
                          autoFocus
                          value={newFirst}
                          onChange={(e) => setNewFirst(e.target.value)}
                          placeholder="Prénom *"
                          className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none"
                        />
                        <input
                          value={newLast}
                          onChange={(e) => setNewLast(e.target.value)}
                          placeholder="Nom"
                          className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none"
                        />
                        <input
                          value={newBirth}
                          onChange={(e) => setNewBirth(e.target.value)}
                          placeholder="Date de naissance (AAAA ou AAAA-MM-JJ)"
                          className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none"
                        />
                        <div className="flex gap-2">
                          <button
                            onClick={resetLinkForm}
                            className="rounded-lg border border-border px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground"
                          >
                            Annuler
                          </button>
                          <button
                            onClick={handleCreateAndLink}
                            disabled={!newFirst.trim() || linkBusy}
                            className="flex flex-1 items-center justify-center gap-1 rounded-lg bg-primary/10 py-1.5 text-xs font-medium text-primary hover:bg-primary/20 disabled:opacity-50"
                          >
                            {linkBusy ? <Loader2 className="size-3.5 animate-spin" /> : <UserPlus className="size-3.5" />}
                            Créer &amp; lier
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        <PersonSearchSelect
                          autoFocus
                          excludeIds={linkedIds}
                          selected={linkTarget}
                          onSelect={setLinkTarget}
                          onClear={() => setLinkTarget(null)}
                          context={searchContext}
                        />
                        <div className="flex gap-2">
                          <button
                            onClick={resetLinkForm}
                            className="rounded-lg border border-border px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground"
                          >
                            Annuler
                          </button>
                          <button
                            onClick={handleLink}
                            disabled={!linkTarget || linkBusy}
                            className="flex flex-1 items-center justify-center gap-1 rounded-lg bg-primary/10 py-1.5 text-xs font-medium text-primary hover:bg-primary/20 disabled:opacity-50"
                          >
                            {linkBusy ? <Loader2 className="size-3.5 animate-spin" /> : <UserCheck className="size-3.5" />}
                            Lier
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <button
                    onClick={() => {
                      const defaultType = REL_GROUPS.find((g) => g.key === currentGroup)?.types[0] ?? currentGroup;
                      setLinkMode({ groupKey: currentGroup, relType: defaultType });
                      setLinkTarget(null);
                      setCreateNew(false);
                    }}
                    className="mt-1 flex w-full items-center justify-center gap-1.5 rounded-xl border-2 border-dashed border-border py-2 text-xs text-muted-foreground transition-colors hover:border-primary hover:text-primary"
                  >
                    <Plus className="size-3.5" /> Lier ou créer une personne
                  </button>
                )}
              </>
            )}
          </div>
        </div>
      </div>

      {/* Actions */}
      {isAuthenticated && (
        <div className="flex gap-2 p-4">
          <button
            onClick={() => onEdit?.(person)}
            className="brand-gradient flex flex-1 items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-opacity hover:opacity-90"
          >
            <Pencil className="size-4" /> Modifier
          </button>
          <button
            onClick={handleDeletePerson}
            disabled={deleting}
            title="Supprimer cette fiche"
            className="grid size-11 shrink-0 place-items-center rounded-xl border border-destructive/30 text-destructive transition-colors hover:bg-destructive/10 disabled:opacity-50"
          >
            {deleting ? <Loader2 className="size-4 animate-spin" /> : <Trash2 className="size-4" />}
          </button>
        </div>
      )}
    </aside>
  );
}
