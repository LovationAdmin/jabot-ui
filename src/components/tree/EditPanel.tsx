import { useState } from "react";
import { Person, Relationship } from "@/lib/types";
import { X, Calendar, MapPin, Music, ImageIcon, Pencil, Lock, Unlink, Plus, UserCheck, Trash2, Loader2 } from "lucide-react";
import { relationshipsApi, personsApi } from "@/lib/api";
import { useFamilyTreeStore } from "@/lib/store";

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

  // Helpers
  const directOfType = (...types: string[]): RelEntry[] =>
    directRels
      .filter((r) => types.includes(r.type))
      .flatMap((r) => {
        const p = byId.get(otherId(r));
        return p ? [{ person: p, relId: r.id, relType: r.type, inferred: false }] : [];
      });

  const infer = (sources: Person[], relType: string, ...types: string[]): RelEntry[] =>
    sources.flatMap((src) =>
      relationships
        .filter((r) => (r.personAId === src.id || r.personBId === src.id) && types.includes(r.type))
        .flatMap((r) => {
          const pid = r.personAId === src.id ? r.personBId : r.personAId;
          if (pid === personId) return [];
          const p = byId.get(pid);
          return p ? [{ person: p, relId: undefined, relType, inferred: true }] : [];
        }),
    );

  const dedup = (arr: RelEntry[]): RelEntry[] =>
    arr.filter((e, i, a) => a.findIndex((x) => x.person.id === e.person.id) === i);

  const parents  = directOfType("parent", "step_parent");
  const children = directOfType("child", "step_child");
  const siblings = directOfType("sibling", "half_sibling", "step_sibling");
  const unclesAunts = dedup([...directOfType("uncle_aunt"), ...infer(parents.map((e) => e.person), "uncle_aunt", "sibling", "half_sibling", "step_sibling")]);
  const cousins     = dedup([...directOfType("cousin"),    ...infer(unclesAunts.map((e) => e.person), "cousin", "child", "step_child")]);
  const nephewsNieces = dedup([...directOfType("nephew_niece"), ...infer(siblings.map((e) => e.person), "nephew_niece", "child", "step_child")]);

  return {
    spouse:       dedup(directOfType("spouse")),
    parent:       dedup(parents),
    grandparent:  dedup([...directOfType("grandparent"), ...infer(parents.map((e) => e.person), "grandparent", "parent", "step_parent")]),
    sibling:      dedup(siblings),
    child:        dedup(children),
    grandchild:   dedup([...directOfType("grandchild"), ...infer(children.map((e) => e.person), "grandchild", "child", "step_child")]),
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
  const { deleteRelationship, addRelationship, getPersonById, deletePerson } = useFamilyTreeStore();
  const [activeGroup, setActiveGroup] = useState("parent");
  const [unlinking, setUnlinking] = useState<string | null>(null);
  const [linkMode, setLinkMode] = useState<{ groupKey: string; relType: string } | null>(null);
  const [linkTarget, setLinkTarget] = useState("");
  const [linkBusy, setLinkBusy] = useState(false);
  const [deleting, setDeleting] = useState(false);

  if (!person) return null;

  const fullName = [person.firstName, person.lastName].filter(Boolean).join(" ");
  const photo = person.photos[0];
  const groups = buildGroups(person.id, allPersons, relationships);
  const nonEmptyGroups = REL_GROUPS.filter((g) => groups[g.key]?.length > 0);
  const currentGroup = nonEmptyGroups.find((g) => g.key === activeGroup)
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

  async function handleLink() {
    if (!linkMode || !linkTarget || !person) return;
    setLinkBusy(true);
    try {
      const rel = await relationshipsApi.create({
        personAId: person.id,
        personBId: linkTarget,
        type: linkMode.relType as Relationship["type"],
      });
      addRelationship(rel);
      setLinkMode(null);
      setLinkTarget("");
    } finally {
      setLinkBusy(false);
    }
  }

  // Personnes non encore liées (pour le sélecteur "lier")
  const linkedIds = new Set(
    Object.values(groups).flat().map((e) => e.person.id).concat([person.id]),
  );
  const candidates = allPersons.filter((p) => !linkedIds.has(p.id));

  // Groupes disponibles pour lier directement (pas inférés)
  const directGroups = REL_GROUPS.filter((g) => !g.inferred);

  // Options de type de relation pour un groupe donné
  const relOptionsFor = (groupKey: string): Array<{ value: string; label: string }> => {
    const g = REL_GROUPS.find((x) => x.key === groupKey);
    return (g?.types ?? []).map((t) => ({ value: t, label: REL_LABEL[t] ?? t }));
  };

  return (
    <aside className="flex h-full w-80 shrink-0 flex-col border-l border-border/60 bg-card">
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

      <div className="flex-1 overflow-y-auto">
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
          {isAuthenticated && person.photos.length > 0 && (
            <div className="mb-5">
              <p className="mb-2 flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                <ImageIcon className="size-3" /> Photos
              </p>
              <div className="grid grid-cols-3 gap-1.5">
                {person.photos.map((ph) => (
                  <img key={ph.id} src={ph.url} alt="" className="aspect-square rounded-xl object-cover" />
                ))}
              </div>
            </div>
          )}

          {/* Audio */}
          {isAuthenticated && person.audios.length > 0 && (
            <div className="mb-5">
              <p className="mb-2 flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                <Music className="size-3" /> Messages audio
              </p>
              <div className="space-y-2">
                {person.audios.map((au) => (
                  <audio key={au.id} controls src={au.url} className="w-full" />
                ))}
              </div>
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
            {(groups[currentGroup] ?? []).map((entry) => (
              <div key={entry.person.id} className="flex items-center gap-2">
                <button
                  onClick={() => onSelectPerson(entry.person.id)}
                  className="flex flex-1 items-center gap-2.5 rounded-xl border border-border bg-background px-3 py-2 text-left transition-colors hover:border-primary/40 hover:bg-muted min-w-0"
                >
                  <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-bold text-primary">
                    {entry.person.firstName?.[0]?.toUpperCase() ?? "?"}
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
            ))}

            {/* Bouton lier une personne (auth + onglet direct) */}
            {isAuthenticated && directGroups.some((g) => g.key === currentGroup) && (
              <>
                {linkMode?.groupKey === currentGroup ? (
                  <div className="mt-2 space-y-2 rounded-xl border border-border bg-background/50 p-3">
                    <select
                      autoFocus
                      value={linkMode.relType}
                      onChange={(e) => setLinkMode({ groupKey: currentGroup, relType: e.target.value })}
                      className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus:border-primary focus:outline-none"
                    >
                      {relOptionsFor(currentGroup).map((o) => (
                        <option key={o.value} value={o.value}>{o.label}</option>
                      ))}
                    </select>
                    <select
                      value={linkTarget}
                      onChange={(e) => setLinkTarget(e.target.value)}
                      className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus:border-primary focus:outline-none"
                    >
                      <option value="">Choisir une personne…</option>
                      {candidates.map((p) => (
                        <option key={p.id} value={p.id}>{p.firstName} {p.lastName}</option>
                      ))}
                    </select>
                    <div className="flex gap-2">
                      <button
                        onClick={() => { setLinkMode(null); setLinkTarget(""); }}
                        className="rounded-lg border border-border px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground"
                      >
                        Annuler
                      </button>
                      <button
                        onClick={handleLink}
                        disabled={!linkTarget || linkBusy}
                        className="flex flex-1 items-center justify-center gap-1 rounded-lg bg-primary/10 py-1.5 text-xs font-medium text-primary hover:bg-primary/20 disabled:opacity-50"
                      >
                        <UserCheck className="size-3.5" /> Lier
                      </button>
                    </div>
                  </div>
                ) : candidates.length > 0 && (
                  <button
                    onClick={() => {
                      const defaultType = REL_GROUPS.find((g) => g.key === currentGroup)?.types[0] ?? currentGroup;
                      setLinkMode({ groupKey: currentGroup, relType: defaultType });
                      setLinkTarget("");
                    }}
                    className="mt-1 flex w-full items-center justify-center gap-1.5 rounded-xl border-2 border-dashed border-border py-2 text-xs text-muted-foreground transition-colors hover:border-primary hover:text-primary"
                  >
                    <Plus className="size-3.5" /> Lier une personne
                  </button>
                )}
              </>
            )}
          </div>
        </div>
      </div>

      {/* Actions */}
      {isAuthenticated && (
        <div className="flex gap-2 border-t border-border/60 p-4">
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
