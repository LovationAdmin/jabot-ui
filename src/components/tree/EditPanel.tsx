import { useState } from "react";
import { Person, Relationship } from "@/lib/types";
import { X, Calendar, MapPin, Music, ImageIcon, Pencil, Lock } from "lucide-react";

interface EditPanelProps {
  person: Person | null;
  allPersons: Person[];
  relationships: Relationship[];
  onClose: () => void;
  onSelectPerson: (id: string) => void;
  isAuthenticated?: boolean;
  onEdit?: (person: Person) => void;
}

// Lien de parente etendu : on essaie d'abord les relations directes stockees,
// puis on infere grands-parents/oncles-tantes/cousins via 2 niveaux.
const REL_TABS = [
  { key: "grandparent",  label: "Grands-parents" },
  { key: "parent",       label: "Parents" },
  { key: "sibling",      label: "Freres & Soeurs" },
  { key: "child",        label: "Enfants" },
  { key: "spouse",       label: "Conjoints" },
  { key: "uncle_aunt",   label: "Oncles / Tantes" },
  { key: "cousin",       label: "Cousins" },
  { key: "nephew_niece", label: "Neveux / Nieces" },
  { key: "grandchild",   label: "Petits-enfants" },
] as const;

type RelTab = (typeof REL_TABS)[number]["key"];

function getRelatives(
  personId: string,
  allPersons: Person[],
  relationships: Relationship[],
): Record<RelTab, Person[]> {
  const byId = new Map(allPersons.map((p) => [p.id, p]));

  // Relations directes stockees
  const directRels = relationships.filter(
    (r) => r.personAId === personId || r.personBId === personId,
  );
  const otherId = (r: Relationship) => (r.personAId === personId ? r.personBId : r.personAId);

  function directs(type: string): Person[] {
    return directRels
      .filter((r) => r.type === type)
      .map((r) => byId.get(otherId(r)))
      .filter(Boolean) as Person[];
  }

  const parents  = directs("parent");
  const children = directs("child");
  const siblings = directs("sibling");

  // Grands-parents = parents des parents
  const grandparents = [
    ...directs("grandparent"),
    ...parents.flatMap((par) =>
      relationships
        .filter((r) => (r.personAId === par.id || r.personBId === par.id) && r.type === "parent")
        .map((r) => byId.get(r.personAId === par.id ? r.personBId : r.personAId))
        .filter(Boolean) as Person[],
    ),
  ];

  // Petits-enfants = enfants des enfants
  const grandchildren = [
    ...directs("grandchild"),
    ...children.flatMap((child) =>
      relationships
        .filter((r) => (r.personAId === child.id || r.personBId === child.id) && r.type === "child")
        .map((r) => byId.get(r.personAId === child.id ? r.personBId : r.personAId))
        .filter(Boolean) as Person[],
    ),
  ];

  // Oncles/tantes = freres/soeurs des parents
  const unclesAunts = [
    ...directs("uncle_aunt"),
    ...parents.flatMap((par) =>
      relationships
        .filter((r) => (r.personAId === par.id || r.personBId === par.id) && r.type === "sibling")
        .map((r) => byId.get(r.personAId === par.id ? r.personBId : r.personAId))
        .filter(Boolean) as Person[],
    ),
  ];

  // Cousins = enfants des oncles/tantes
  const cousins = [
    ...directs("cousin"),
    ...unclesAunts.flatMap((ua) =>
      relationships
        .filter((r) => (r.personAId === ua.id || r.personBId === ua.id) && r.type === "child")
        .map((r) => byId.get(r.personAId === ua.id ? r.personBId : r.personAId))
        .filter(Boolean) as Person[],
    ),
  ];

  // Neveux/nieces = enfants des freres/soeurs
  const nephewsNieces = [
    ...directs("nephew_niece"),
    ...siblings.flatMap((sib) =>
      relationships
        .filter((r) => (r.personAId === sib.id || r.personBId === sib.id) && r.type === "child")
        .map((r) => byId.get(r.personAId === sib.id ? r.personBId : r.personAId))
        .filter(Boolean) as Person[],
    ),
  ];

  // Deduplication
  const dedup = (arr: Person[]) =>
    arr.filter((p, i, a) => p.id !== personId && a.findIndex((x) => x.id === p.id) === i);

  return {
    grandparent:  dedup(grandparents),
    parent:       dedup(parents),
    sibling:      dedup(siblings),
    child:        dedup(children),
    spouse:       dedup(directs("spouse")),
    uncle_aunt:   dedup(unclesAunts),
    cousin:       dedup(cousins),
    nephew_niece: dedup(nephewsNieces),
    grandchild:   dedup(grandchildren),
  };
}

export function EditPanel({
  person, allPersons, relationships, onClose, onSelectPerson,
  isAuthenticated, onEdit,
}: EditPanelProps) {
  const [activeTab, setActiveTab] = useState<RelTab>("parent");

  if (!person) return null;

  const fullName = [person.firstName, person.lastName].filter(Boolean).join(" ");
  const photo = person.photos[0];
  const relatives = getRelatives(person.id, allPersons, relationships);
  const nonEmptyTabs = REL_TABS.filter((t) => relatives[t.key].length > 0);
  const currentTab = nonEmptyTabs.find((t) => t.key === activeTab) ? activeTab : nonEmptyTabs[0]?.key;

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

          {/* Name */}
          <div className="mb-5 text-center">
            <h3 className="font-display text-2xl font-bold text-foreground">{fullName}</h3>
            {isAuthenticated && person.nicknames && person.nicknames.length > 0 && (
              <p className="mt-0.5 text-sm text-primary/80">&laquo; {person.nicknames.join(", ")} &raquo;</p>
            )}
            {!isAuthenticated && (
              <p className="mt-2 text-xs text-muted-foreground">
                <a href="/auth" className="text-primary underline underline-offset-2">Connectez-vous</a> pour voir le profil complet
              </p>
            )}
          </div>

          {/* Details */}
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

          {/* City seule pour visiteurs */}
          {!isAuthenticated && person.cityOfOrigin && (
            <div className="mb-5 flex items-center gap-2 text-sm text-muted-foreground">
              <MapPin className="size-3.5 shrink-0" />
              <span>{person.cityOfOrigin}</span>
            </div>
          )}

          {/* Photo gallery — auth uniquement */}
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

          {/* Audio — auth uniquement */}
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
        {nonEmptyTabs.length > 0 && (
          <div className="border-t border-border/60">
            {/* Tab bar */}
            <div className="flex overflow-x-auto border-b border-border/60 px-2 pt-1 scrollbar-none">
              {nonEmptyTabs.map((t) => (
                <button
                  key={t.key}
                  onClick={() => setActiveTab(t.key)}
                  className={`shrink-0 whitespace-nowrap rounded-t-lg px-3 py-2 text-xs font-medium transition-colors ${
                    currentTab === t.key
                      ? "border-b-2 border-primary text-primary"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {t.label}
                  <span className="ml-1 text-[10px] opacity-60">
                    ({relatives[t.key].length})
                  </span>
                </button>
              ))}
            </div>

            {/* Tab content */}
            <div className="space-y-1.5 p-3">
              {currentTab &&
                relatives[currentTab].map((rel) => (
                  <button
                    key={rel.id}
                    onClick={() => onSelectPerson(rel.id)}
                    className="flex w-full items-center gap-2.5 rounded-xl border border-border bg-background px-3 py-2 text-left transition-colors hover:border-primary/40 hover:bg-muted"
                  >
                    <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-bold text-primary">
                      {rel.firstName?.[0]?.toUpperCase() ?? "?"}
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-foreground">
                        {[rel.firstName, rel.lastName].filter(Boolean).join(" ")}
                      </p>
                      {rel.cityOfOrigin && (
                        <p className="truncate text-[10px] text-muted-foreground">{rel.cityOfOrigin}</p>
                      )}
                    </div>
                  </button>
                ))}
            </div>
          </div>
        )}
      </div>

      {/* Actions */}
      {isAuthenticated && (
        <div className="border-t border-border/60 p-4">
          <button
            onClick={() => onEdit?.(person)}
            className="brand-gradient flex w-full items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-opacity hover:opacity-90"
          >
            <Pencil className="size-4" /> Modifier
          </button>
        </div>
      )}
    </aside>
  );
}
