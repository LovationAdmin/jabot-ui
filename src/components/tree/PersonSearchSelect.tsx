import { useState, useEffect, useRef, useCallback } from "react";
import { Search, Loader2, X, Users } from "lucide-react";
import { personsApi } from "@/lib/api";
import { Person, SearchResult } from "@/lib/types";

const FAMILY_REASON_PREFIX = "Correspondance familiale";

interface PersonSearchSelectProps {
  /** Identifiants à exclure des résultats (déjà liés, soi-même…). */
  excludeIds?: Set<string>;
  /** Appelé quand l'utilisateur choisit une personne. */
  onSelect: (person: Person) => void;
  /** Personne actuellement choisie (pour afficher l'état). */
  selected?: Person | null;
  /** Réinitialise la sélection. */
  onClear?: () => void;
  placeholder?: string;
  autoFocus?: boolean;
  /**
   * Contexte familial de la personne depuis laquelle on lie. Transmis à
   * l'API de recherche : le backend booste les candidats dont les parents /
   * la fratrie correspondent à ces noms → les bons homonymes (même famille)
   * remontent en tête.
   */
  context?: { parentNames?: string[]; siblingNames?: string[] };
}

/**
 * Champ de recherche de personne en saisie semi-automatique (typeahead).
 *
 * Remplace l'ancien <select> qui listait TOUTES les fiches : à l'échelle de
 * centaines de milliers de personnes (et de nombreux homonymes), un dropdown
 * exhaustif est inutilisable. Ici on interroge l'API de recherche floue/
 * phonétique (`/persons/search`) avec un débounce, et on affiche les
 * meilleurs résultats enrichis (année de naissance, ville) pour distinguer
 * les homonymes.
 */
export function PersonSearchSelect({
  excludeIds,
  onSelect,
  selected,
  onClear,
  placeholder = "Rechercher un nom…",
  autoFocus,
  context,
}: PersonSearchSelectProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [activeIdx, setActiveIdx] = useState(0);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reqIdRef = useRef(0);
  const containerRef = useRef<HTMLDivElement>(null);

  const runSearch = useCallback(
    async (q: string) => {
      const trimmed = q.trim();
      if (trimmed.length < 2) {
        setResults([]);
        setLoading(false);
        return;
      }
      const reqId = ++reqIdRef.current;
      setLoading(true);
      try {
        const matches = await personsApi.search({
          name: trimmed,
          parent_names: context?.parentNames?.length ? context.parentNames : undefined,
          sibling_names: context?.siblingNames?.length ? context.siblingNames : undefined,
        });
        // Ignore les réponses obsolètes (course entre requêtes).
        if (reqId !== reqIdRef.current) return;
        const filtered = matches.filter((m) => !excludeIds?.has(m.person.id));
        setResults(filtered.slice(0, 8));
        setActiveIdx(0);
      } catch {
        if (reqId === reqIdRef.current) setResults([]);
      } finally {
        if (reqId === reqIdRef.current) setLoading(false);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [excludeIds, JSON.stringify(context ?? {})],
  );

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => runSearch(query), 250);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query, runSearch]);

  // Ferme la liste au clic extérieur.
  useEffect(() => {
    const onDocClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  function choose(p: Person) {
    onSelect(p);
    setQuery("");
    setResults([]);
    setOpen(false);
  }

  function subtitle(p: Person): string {
    const bits: string[] = [];
    const birthYear = p.birthDate?.slice(0, 4);
    const deathYear = p.deathDate?.slice(0, 4);
    if (birthYear) bits.push(deathYear ? `${birthYear}–${deathYear}` : `né(e) ${birthYear}`);
    if (p.cityOfOrigin) bits.push(p.cityOfOrigin);
    return bits.join(" · ");
  }

  // État sélectionné : on montre un « chip » avec bouton pour changer.
  if (selected) {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-primary/40 bg-primary/5 px-3 py-2">
        <div className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary/15 text-xs font-bold text-primary">
          {selected.firstName?.[0]?.toUpperCase() ?? "?"}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-foreground">
            {[selected.firstName, selected.lastName].filter(Boolean).join(" ")}
          </p>
          {subtitle(selected) && (
            <p className="truncate text-[10px] text-muted-foreground">{subtitle(selected)}</p>
          )}
        </div>
        {onClear && (
          <button
            type="button"
            onClick={onClear}
            className="grid size-6 shrink-0 place-items-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            <X className="size-3.5" />
          </button>
        )}
      </div>
    );
  }

  return (
    <div ref={containerRef} className="relative">
      <div className="flex items-center gap-2 rounded-lg border border-border bg-background px-3 py-2 focus-within:border-primary">
        <Search className="size-3.5 shrink-0 text-muted-foreground" />
        <input
          autoFocus={autoFocus}
          value={query}
          onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown") { e.preventDefault(); setActiveIdx((i) => Math.min(i + 1, results.length - 1)); }
            else if (e.key === "ArrowUp") { e.preventDefault(); setActiveIdx((i) => Math.max(i - 1, 0)); }
            else if (e.key === "Enter" && results[activeIdx]) { e.preventDefault(); choose(results[activeIdx].person); }
            else if (e.key === "Escape") setOpen(false);
          }}
          placeholder={placeholder}
          className="min-w-0 flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground focus:outline-none"
        />
        {loading && <Loader2 className="size-3.5 shrink-0 animate-spin text-muted-foreground" />}
      </div>

      {open && query.trim().length >= 2 && (
        <div className="absolute z-50 mt-1 max-h-64 w-full overflow-y-auto rounded-lg border border-border bg-card shadow-float">
          {results.length === 0 && !loading ? (
            <p className="px-3 py-3 text-center text-xs text-muted-foreground">Aucun résultat</p>
          ) : (
            results.map((r, i) => {
              const p = r.person;
              const familyMatch = r.matchReasons.some((reason) => reason.startsWith(FAMILY_REASON_PREFIX));
              return (
                <button
                  key={p.id}
                  type="button"
                  onMouseEnter={() => setActiveIdx(i)}
                  onClick={() => choose(p)}
                  className={`flex w-full items-center gap-2.5 px-3 py-2 text-left transition-colors ${
                    i === activeIdx ? "bg-muted" : "hover:bg-muted/60"
                  }`}
                >
                  <div className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
                    {p.firstName?.[0]?.toUpperCase() ?? "?"}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-foreground">
                      {[p.firstName, p.lastName].filter(Boolean).join(" ")}
                    </p>
                    {subtitle(p) && (
                      <p className="truncate text-[10px] text-muted-foreground">{subtitle(p)}</p>
                    )}
                  </div>
                  {familyMatch && (
                    <span
                      title="Proche de la même famille"
                      className="flex shrink-0 items-center gap-1 rounded-full border border-emerald-400/40 bg-emerald-400/10 px-1.5 py-0.5 text-[9px] font-medium text-emerald-600"
                    >
                      <Users className="size-2.5" /> Famille
                    </span>
                  )}
                </button>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
