import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft, UserPlus, Pencil, Trash2, Link2, Unlink, GitMerge,
  History, Loader2, ChevronDown, Search, X, Calendar,
} from "lucide-react";
import { useAuthStore } from "@/lib/store";
import { auditApi, AuditEntry } from "@/lib/api";

export const Route = createFileRoute("/account/activity")({
  head: () => ({ meta: [{ title: "Activité — Jabot" }] }),
  component: ActivityPage,
});

type ActionFilter = "all" | "create_person" | "update_person" | "delete_person" | "create_relationship" | "delete_relationship" | "merge_persons";

const ACTION_LABELS: Record<ActionFilter, string> = {
  all: "Toutes les actions",
  create_person: "Fiches créées",
  update_person: "Fiches modifiées",
  delete_person: "Fiches supprimées",
  create_relationship: "Liens ajoutés",
  delete_relationship: "Liens supprimés",
  merge_persons: "Fusions",
};

function actionVisual(action: string) {
  switch (action) {
    case "create_person":       return { icon: UserPlus, tone: "text-green-600",      bg: "bg-green-500/10",      badge: "bg-green-100 text-green-700" };
    case "update_person":       return { icon: Pencil,   tone: "text-blue-600",       bg: "bg-blue-500/10",       badge: "bg-blue-100 text-blue-700" };
    case "delete_person":       return { icon: Trash2,   tone: "text-destructive",    bg: "bg-destructive/10",    badge: "bg-red-100 text-red-700" };
    case "create_relationship": return { icon: Link2,    tone: "text-green-600",      bg: "bg-green-500/10",      badge: "bg-green-100 text-green-700" };
    case "delete_relationship": return { icon: Unlink,   tone: "text-destructive",    bg: "bg-destructive/10",    badge: "bg-red-100 text-red-700" };
    case "merge_persons":       return { icon: GitMerge, tone: "text-amber-600",      bg: "bg-amber-500/10",      badge: "bg-amber-100 text-amber-700" };
    default:                    return { icon: History,  tone: "text-muted-foreground", bg: "bg-muted",            badge: "bg-muted text-muted-foreground" };
  }
}

function personName(d: Record<string, unknown> | null): string {
  if (!d) return "une fiche";
  const f = (d.first_name as string) ?? "";
  const l = (d.last_name as string) ?? "";
  return `${f} ${l}`.trim() || "une fiche";
}

function relTypeLabel(t: string | undefined): string {
  switch (t) {
    case "parent":       return "parent";
    case "child":        return "enfant";
    case "spouse":       return "conjoint(e)";
    case "sibling":      return "frère/sœur";
    case "half_sibling": return "demi-frère/sœur";
    case "step_sibling": return "frère/sœur par alliance";
    default:             return t ?? "lien de parenté";
  }
}

function describe(e: AuditEntry): { summary: string; detail: string | null } {
  const who = e.actorName ?? "Quelqu'un";
  const d = e.details;
  switch (e.action) {
    case "create_person": {
      const name = personName(d);
      const birth = d?.birth_year ? ` (né${d.birth_year})` : "";
      return {
        summary: `${who} a créé la fiche de ${name}`,
        detail: d ? `${name}${birth}` : null,
      };
    }
    case "update_person": {
      const name = personName(d);
      const changed = d?.changed_fields as string[] | undefined;
      return {
        summary: `${who} a modifié la fiche de ${name}`,
        detail: changed?.length ? `Champs modifiés : ${changed.join(", ")}` : null,
      };
    }
    case "delete_person": {
      const name = personName(d);
      return {
        summary: `${who} a supprimé la fiche de ${name}`,
        detail: null,
      };
    }
    case "create_relationship": {
      const a = (d?.person_a_name as string) ?? "?";
      const b = (d?.person_b_name as string) ?? "?";
      const type = relTypeLabel(d?.type as string);
      return {
        summary: `${who} a relié ${a} et ${b}`,
        detail: `Type : ${type}`,
      };
    }
    case "delete_relationship": {
      const a = (d?.person_a_name as string) ?? "?";
      const b = (d?.person_b_name as string) ?? "?";
      const type = relTypeLabel(d?.type as string);
      return {
        summary: `${who} a supprimé le lien entre ${a} et ${b}`,
        detail: `Type : ${type}`,
      };
    }
    case "merge_persons": {
      const src = (d?.source_name as string) ?? "une fiche";
      const tgt = (d?.target_name as string) ?? "une fiche";
      return {
        summary: `${who} a fusionné ${src} dans ${tgt}`,
        detail: d?.merged_fields ? `Champs fusionnés : ${(d.merged_fields as string[]).join(", ")}` : null,
      };
    }
    default:
      return { summary: `${who} a effectué une action (${e.action})`, detail: null };
  }
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" });
}

function timeAgo(iso: string): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "";
  const diff = Date.now() - then;
  const min = Math.floor(diff / 60000);
  if (min < 1) return "à l'instant";
  if (min < 60) return `il y a ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `il y a ${h} h`;
  const j = Math.floor(h / 24);
  if (j < 7) return `il y a ${j} j`;
  return formatDate(iso);
}

function groupByDate(entries: AuditEntry[]): { label: string; items: AuditEntry[] }[] {
  const groups = new Map<string, AuditEntry[]>();
  for (const e of entries) {
    const label = formatDate(e.createdAt) || "Date inconnue";
    if (!groups.has(label)) groups.set(label, []);
    groups.get(label)!.push(e);
  }
  return [...groups.entries()].map(([label, items]) => ({ label, items }));
}

function ActivityPage() {
  const { isAuthenticated } = useAuthStore();
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionFilter, setActionFilter] = useState<ActionFilter>("all");
  const [actorFilter, setActorFilter] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [filterOpen, setFilterOpen] = useState(false);

  useEffect(() => {
    if (!isAuthenticated) return;
    auditApi
      .myTree()
      .then(setEntries)
      .catch(() => setError("Impossible de charger le journal d'activité."))
      .finally(() => setLoading(false));
  }, [isAuthenticated]);

  const actors = useMemo(() => {
    const names = new Set(entries.map((e) => e.actorName ?? "Quelqu'un"));
    return ["all", ...Array.from(names).sort()];
  }, [entries]);

  const filtered = useMemo(() => {
    return entries.filter((e) => {
      if (actionFilter !== "all" && e.action !== actionFilter) return false;
      if (actorFilter !== "all" && (e.actorName ?? "Quelqu'un") !== actorFilter) return false;
      if (search.trim()) {
        const { summary, detail } = describe(e);
        const q = search.toLowerCase();
        if (!summary.toLowerCase().includes(q) && !(detail ?? "").toLowerCase().includes(q)) return false;
      }
      return true;
    });
  }, [entries, actionFilter, actorFilter, search]);

  const grouped = useMemo(() => groupByDate(filtered), [filtered]);

  const hasFilter = actionFilter !== "all" || actorFilter !== "all" || search.trim();

  return (
    <div className="canvas-grid min-h-screen bg-canvas p-4">
      <div className="mx-auto max-w-xl space-y-4 pt-8">
        <Link to="/account" className="flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground">
          <ArrowLeft className="size-4" /> Retour au compte
        </Link>

        <div className="rounded-2xl border border-border bg-card p-6 shadow-float">
          {/* Header */}
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <History className="size-5 text-primary" />
                <h1 className="font-serif text-2xl text-foreground">Activité de l'arbre</h1>
              </div>
              <p className="mt-1 text-sm text-muted-foreground">
                Toutes les modifications apportées à votre arbre généalogique.
              </p>
            </div>
            {!loading && entries.length > 0 && (
              <span className="shrink-0 rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium text-muted-foreground">
                {filtered.length} / {entries.length}
              </span>
            )}
          </div>

          {/* Filters */}
          {!loading && entries.length > 0 && (
            <div className="mt-4 space-y-2">
              {/* Search */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Rechercher une fiche, un nom…"
                  className="w-full rounded-xl border border-border bg-background py-2 pl-8 pr-3 text-sm outline-none focus:ring-2 focus:ring-ring"
                />
                {search && (
                  <button onClick={() => setSearch("")} className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-0.5 text-muted-foreground hover:text-foreground">
                    <X className="size-3.5" />
                  </button>
                )}
              </div>

              {/* Advanced filters toggle */}
              <button
                onClick={() => setFilterOpen((o) => !o)}
                className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                <ChevronDown className={`size-3.5 transition-transform ${filterOpen ? "rotate-180" : ""}`} />
                Filtres avancés
                {hasFilter && actionFilter !== "all" || actorFilter !== "all" ? (
                  <span className="rounded-full bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium text-primary">actif</span>
                ) : null}
              </button>

              {filterOpen && (
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="mb-1 block text-xs font-medium text-muted-foreground">Type d'action</label>
                    <select
                      value={actionFilter}
                      onChange={(e) => setActionFilter(e.target.value as ActionFilter)}
                      className="w-full rounded-lg border border-border bg-background px-2 py-1.5 text-xs outline-none focus:ring-2 focus:ring-ring"
                    >
                      {(Object.keys(ACTION_LABELS) as ActionFilter[]).map((k) => (
                        <option key={k} value={k}>{ACTION_LABELS[k]}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-muted-foreground">Membre</label>
                    <select
                      value={actorFilter}
                      onChange={(e) => setActorFilter(e.target.value)}
                      className="w-full rounded-lg border border-border bg-background px-2 py-1.5 text-xs outline-none focus:ring-2 focus:ring-ring"
                    >
                      <option value="all">Tous les membres</option>
                      {actors.filter((a) => a !== "all").map((a) => (
                        <option key={a} value={a}>{a}</option>
                      ))}
                    </select>
                  </div>
                </div>
              )}

              {hasFilter && (
                <button
                  onClick={() => { setActionFilter("all"); setActorFilter("all"); setSearch(""); }}
                  className="flex items-center gap-1 text-xs text-muted-foreground hover:text-destructive transition-colors"
                >
                  <X className="size-3" /> Réinitialiser les filtres
                </button>
              )}
            </div>
          )}

          <div className="mt-5">
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="size-5 animate-spin text-muted-foreground" />
              </div>
            ) : error ? (
              <p className="rounded-xl bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>
            ) : filtered.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">
                {entries.length === 0 ? "Aucune activité pour le moment." : "Aucun résultat pour ces filtres."}
              </p>
            ) : (
              <div className="space-y-6">
                {grouped.map(({ label, items }) => (
                  <div key={label}>
                    {/* Date group header */}
                    <div className="mb-2 flex items-center gap-2">
                      <Calendar className="size-3.5 shrink-0 text-muted-foreground" />
                      <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</span>
                      <div className="h-px flex-1 bg-border" />
                    </div>

                    <ol className="space-y-1">
                      {items.map((e) => {
                        const v = actionVisual(e.action);
                        const Icon = v.icon;
                        const { summary, detail } = describe(e);
                        return (
                          <li key={e.id} className="flex items-start gap-3 rounded-xl px-2 py-2.5 transition-colors hover:bg-muted/50">
                            <span className={`mt-0.5 grid size-8 shrink-0 place-items-center rounded-lg ${v.bg} ${v.tone}`}>
                              <Icon className="size-4" />
                            </span>
                            <div className="min-w-0 flex-1">
                              <p className="text-sm text-foreground">{summary}</p>
                              {detail && (
                                <p className="mt-0.5 text-xs text-muted-foreground">{detail}</p>
                              )}
                              <div className="mt-1 flex items-center gap-2">
                                <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${v.badge}`}>
                                  {ACTION_LABELS[e.action as ActionFilter] ?? e.action}
                                </span>
                                <span className="text-[11px] text-muted-foreground">{timeAgo(e.createdAt)}</span>
                              </div>
                            </div>
                          </li>
                        );
                      })}
                    </ol>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
