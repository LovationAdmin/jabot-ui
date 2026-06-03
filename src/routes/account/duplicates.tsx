import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, GitMerge, CheckCircle, AlertCircle, Loader2, Users, Pencil, Layers } from "lucide-react";
import { duplicatesApi, DuplicatePair } from "@/lib/api";
import { useFamilyTreeStore } from "@/lib/store";
import { buildPersonContext, PersonContext } from "@/lib/relatives";
import { Person } from "@/lib/types";
import { PersonFormDialog } from "@/components/tree/PersonFormDialog";

export const Route = createFileRoute("/account/duplicates")({
  component: DuplicatesPage,
});

// ─── Carte personne enrichie (identite + contexte familial) ────────

function ContextRow({ label, refs }: { label: string; refs: { id: string; name: string }[] }) {
  if (refs.length === 0) return null;
  return (
    <p className="text-xs text-muted-foreground">
      <span className="font-medium text-foreground/70">{label} :</span>{" "}
      {refs.map((r) => r.name).join(", ")}
    </p>
  );
}

function PersonMini({
  fallback,
  person,
  other,
  context,
  onEdit,
}: {
  fallback: DuplicatePair["person_a"];
  person?: Person;
  other?: { birth_date?: string | null };
  context?: PersonContext;
  onEdit?: () => void;
}) {
  const name = person
    ? `${person.firstName} ${person.lastName ?? ""}`.trim()
    : [fallback.first_name, fallback.last_name].filter(Boolean).join(" ");
  const year = (person?.birthDate ?? fallback.birth_date)?.slice(0, 4);
  const gender = person?.gender ?? fallback.gender;
  const photo = person?.photos?.[0]?.url;

  // Surligne l'annee si elle differe de l'autre fiche : indice fort pour decider.
  const otherYear = (other?.birth_date ?? undefined)?.slice(0, 4);
  const yearDiffers = !!year && !!otherYear && year !== otherYear;

  return (
    <div className="rounded-xl border bg-card p-3 text-sm min-w-0 flex-1 space-y-1.5">
      <div className="flex items-start gap-2">
        {photo ? (
          <img src={photo} alt="" className="size-9 shrink-0 rounded-lg object-cover" />
        ) : (
          <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-muted text-xs font-bold text-muted-foreground">
            {(name[0] ?? "?").toUpperCase()}
          </span>
        )}
        <div className="min-w-0 flex-1">
          <p className="font-semibold truncate">{name}</p>
          <p className="text-muted-foreground text-xs">
            {year ? (
              <span className={yearDiffers ? "rounded bg-amber-100 px-1 font-medium text-amber-700" : ""}>
                {year}
              </span>
            ) : null}
            {year && gender ? " · " : null}
            {gender ? (gender === "male" ? "H" : gender === "female" ? "F" : "—") : null}
            {!year && !gender ? "Infos manquantes" : null}
          </p>
        </div>
        {onEdit && (
          <button
            onClick={onEdit}
            className="grid size-7 shrink-0 place-items-center rounded-lg border text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            title="Voir / modifier la fiche"
          >
            <Pencil className="size-3.5" />
          </button>
        )}
      </div>

      {context && (
        <div className="space-y-0.5 pt-0.5">
          {context.generation !== undefined && (
            <p className="flex items-center gap-1 text-xs text-muted-foreground">
              <Layers className="size-3" /> Génération {context.generation}
            </p>
          )}
          <ContextRow label="Parents" refs={context.parents} />
          <ContextRow label="Fratrie" refs={context.siblings} />
          <ContextRow label="Enfants" refs={context.children} />
          <ContextRow label="Conjoint(s)" refs={context.spouses} />
        </div>
      )}
    </div>
  );
}

function DuplicatesPage() {
  const navigate = useNavigate();
  const { tree, loadTree, setDuplicateCount, getPersonById } = useFamilyTreeStore();

  const [pairs, setPairs] = useState<DuplicatePair[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [merging, setMerging] = useState<string | null>(null);
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  const [editing, setEditing] = useState<Person | null>(null);

  const refresh = () =>
    duplicatesApi
      .detect()
      .then(setPairs)
      .catch(() => setError("Impossible de charger les doublons."))
      .finally(() => setLoading(false));

  // Refresh silencieux (sans spinner) pour les recalculs reactifs apres edition.
  const silentRefresh = () =>
    duplicatesApi.detect().then(setPairs).catch(() => {});

  useEffect(() => {
    // L'arbre est necessaire pour afficher le contexte familial et editer une fiche.
    if (tree.persons.length === 0) loadTree();
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Signature des champs qui influencent la detection (identite + relations).
  // Toute modification d'une fiche (date, nom, sexe) ou d'un lien la fait changer.
  const treeSignature = useMemo(
    () =>
      tree.persons
        .map((p) => `${p.id}:${p.firstName}:${p.lastName ?? ""}:${p.birthDate ?? ""}:${p.gender}`)
        .join("|") +
      "#" +
      tree.relationships.map((r) => `${r.personAId}>${r.personBId}:${r.type}`).join("|"),
    [tree],
  );

  // Recalcule dynamiquement les doublons quand l'arbre change (edition d'une
  // fiche, ajout/suppression de lien…), debounce pour collapser les rafales.
  const firstSig = useRef(true);
  useEffect(() => {
    if (firstSig.current) {
      firstSig.current = false;
      return;
    }
    const t = setTimeout(() => silentRefresh(), 400);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [treeSignature]);

  const visiblePairs = pairs.filter(
    (p) => !dismissed.has(`${p.person_a.id}-${p.person_b.id}`)
  );

  // Garde la pastille (menu compte + alerte) alignee sur ce qui reste a examiner.
  useEffect(() => {
    if (!loading) setDuplicateCount(visiblePairs.length);
  }, [visiblePairs.length, loading, setDuplicateCount]);

  // Contexte familial calcule a partir de l'arbre charge (sans appel reseau).
  const contextFor = useMemo(() => {
    const cache = new Map<string, PersonContext>();
    return (id: string) => {
      if (!cache.has(id)) cache.set(id, buildPersonContext(id, tree));
      return cache.get(id)!;
    };
  }, [tree]);

  async function handleMerge(pair: DuplicatePair) {
    const key = `${pair.person_a.id}-${pair.person_b.id}`;
    setMerging(key);
    try {
      // Keep person_b (target), absorb person_a (source)
      await duplicatesApi.merge(pair.person_a.id, pair.person_b.id);
      setDismissed((prev) => new Set([...prev, key]));
      await loadTree();
    } catch {
      setError("La fusion a échoué. Réessaie.");
    } finally {
      setMerging(null);
    }
  }

  // "Ignorer" = declarer que ce n'est PAS un doublon. Persiste cote serveur et
  // s'applique a tout l'arbre (tout membre, toute session). Retrait optimiste.
  async function handleDismiss(pair: DuplicatePair) {
    const key = `${pair.person_a.id}-${pair.person_b.id}`;
    setDismissed((prev) => new Set([...prev, key]));
    try {
      await duplicatesApi.ignore(pair.person_a.id, pair.person_b.id);
    } catch {
      // Echec : on remet la paire et on signale.
      setDismissed((prev) => {
        const next = new Set(prev);
        next.delete(key);
        return next;
      });
      setError("Impossible d'ignorer ce doublon. Réessaie.");
    }
  }

  // A la fermeture de l'edition : recharge l'arbre. Le recalcul des doublons se
  // declenche automatiquement via le refresh reactif (treeSignature).
  async function handleEditClose() {
    setEditing(null);
    await loadTree();
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-10 bg-background/80 backdrop-blur border-b px-4 py-3 flex items-center gap-3">
        <button
          onClick={() => navigate({ to: "/account" })}
          className="p-2 rounded-lg hover:bg-muted transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
        </button>
        <h1 className="font-semibold text-base">Doublons détectés</h1>
      </header>

      <div className="max-w-lg mx-auto px-4 py-6 space-y-4">
        {loading && (
          <div className="flex items-center justify-center gap-2 py-12 text-muted-foreground">
            <Loader2 className="w-5 h-5 animate-spin" />
            <span>Analyse en cours…</span>
          </div>
        )}

        {error && (
          <div className="flex items-center gap-2 rounded-xl border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
            <AlertCircle className="w-4 h-4 shrink-0" />
            {error}
          </div>
        )}

        {!loading && visiblePairs.length === 0 && !error && (
          <div className="flex flex-col items-center gap-3 py-16 text-center text-muted-foreground">
            <CheckCircle className="w-10 h-10 text-green-500" />
            <p className="font-medium text-foreground">Aucun doublon à examiner</p>
            <p className="text-sm">Les doublons évidents sont fusionnés automatiquement au chargement.</p>
          </div>
        )}

        {!loading && visiblePairs.length > 0 && (
          <p className="text-xs text-muted-foreground">
            Vérifie chaque paire : <strong className="text-foreground/80">Fusionner</strong> si c'est la même
            personne, modifier une fiche pour lever l'ambiguïté, ou{" "}
            <strong className="text-foreground/80">Pas un doublon</strong> — ce choix est partagé avec tout l'arbre
            et la paire ne reviendra plus.
          </p>
        )}

        {visiblePairs.map((pair) => {
          const key = `${pair.person_a.id}-${pair.person_b.id}`;
          const isMerging = merging === key;
          const personA = getPersonById(pair.person_a.id);
          const personB = getPersonById(pair.person_b.id);
          return (
            <div key={key} className="rounded-2xl border bg-card p-4 space-y-3">
              <div className="flex items-center gap-2">
                <span
                  className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                    pair.confidence === "high"
                      ? "bg-red-100 text-red-700"
                      : "bg-yellow-100 text-yellow-700"
                  }`}
                >
                  {pair.confidence === "high" ? "Doublon probable" : "Possible doublon"} — {Math.round(pair.score * 100)}%
                </span>
              </div>

              <div className="flex items-start gap-3">
                <PersonMini
                  fallback={pair.person_a}
                  person={personA}
                  other={pair.person_b}
                  context={personA ? contextFor(personA.id) : undefined}
                  onEdit={personA ? () => setEditing(personA) : undefined}
                />
                <Users className="w-4 h-4 text-muted-foreground shrink-0 mt-3" />
                <PersonMini
                  fallback={pair.person_b}
                  person={personB}
                  other={pair.person_a}
                  context={personB ? contextFor(personB.id) : undefined}
                  onEdit={personB ? () => setEditing(personB) : undefined}
                />
              </div>

              <div className="flex gap-2 pt-1">
                <button
                  onClick={() => handleMerge(pair)}
                  disabled={isMerging}
                  className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-foreground text-background py-2 text-sm font-medium hover:opacity-80 transition-opacity disabled:opacity-50"
                >
                  {isMerging ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <GitMerge className="w-4 h-4" />
                  )}
                  Fusionner
                </button>
                <button
                  onClick={() => handleDismiss(pair)}
                  disabled={isMerging}
                  title="Marquer comme « pas un doublon » pour tout l'arbre"
                  className="px-4 rounded-xl border text-sm hover:bg-muted transition-colors disabled:opacity-50"
                >
                  Pas un doublon
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {editing && (
        <PersonFormDialog mode="edit" person={editing} onClose={handleEditClose} />
      )}
    </div>
  );
}
