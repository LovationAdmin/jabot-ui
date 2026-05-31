import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowLeft, GitMerge, CheckCircle, AlertCircle, Loader2, Users } from "lucide-react";
import { duplicatesApi, DuplicatePair } from "@/lib/api";
import { useFamilyTreeStore } from "@/lib/store";

export const Route = createFileRoute("/account/duplicates")({
  component: DuplicatesPage,
});

function PersonMini({ p }: { p: DuplicatePair["person_a"] }) {
  const name = [p.first_name, p.last_name].filter(Boolean).join(" ");
  const year = p.birth_date?.slice(0, 4);
  return (
    <div className="rounded-xl border bg-card p-3 text-sm min-w-0 flex-1">
      <p className="font-semibold truncate">{name}</p>
      {year && <p className="text-muted-foreground text-xs">{year}</p>}
      {p.gender && <p className="text-muted-foreground text-xs capitalize">{p.gender}</p>}
    </div>
  );
}

function DuplicatesPage() {
  const navigate = useNavigate();
  const { loadTree } = useFamilyTreeStore();

  const [pairs, setPairs] = useState<DuplicatePair[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [merging, setMerging] = useState<string | null>(null);
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());

  useEffect(() => {
    duplicatesApi
      .detect()
      .then(setPairs)
      .catch(() => setError("Impossible de charger les doublons."))
      .finally(() => setLoading(false));
  }, []);

  const visiblePairs = pairs.filter(
    (p) => !dismissed.has(`${p.person_a.id}-${p.person_b.id}`)
  );

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

  function handleDismiss(pair: DuplicatePair) {
    const key = `${pair.person_a.id}-${pair.person_b.id}`;
    setDismissed((prev) => new Set([...prev, key]));
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
            <p className="font-medium text-foreground">Aucun doublon détecté</p>
            <p className="text-sm">Toutes les fiches semblent uniques.</p>
          </div>
        )}

        {visiblePairs.map((pair) => {
          const key = `${pair.person_a.id}-${pair.person_b.id}`;
          const isMerging = merging === key;
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

              <div className="flex items-center gap-3">
                <PersonMini p={pair.person_a} />
                <Users className="w-4 h-4 text-muted-foreground shrink-0" />
                <PersonMini p={pair.person_b} />
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
                  className="px-4 rounded-xl border text-sm hover:bg-muted transition-colors disabled:opacity-50"
                >
                  Ignorer
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
