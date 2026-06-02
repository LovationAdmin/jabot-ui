import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft, UserPlus, Pencil, Trash2, Link2, Unlink, GitMerge,
  History, Loader2, Search, X, Calendar, User,
} from "lucide-react";
import { useAuthStore } from "@/lib/store";
import { auditApi, AuditEntry } from "@/lib/api";

export const Route = createFileRoute("/account/activity")({
  head: () => ({ meta: [{ title: "Activité — Jabot" }] }),
  component: ActivityPage,
});

type ActionFilter = "all" | "create_person" | "update_person" | "delete_person" | "create_relationship" | "delete_relationship" | "merge_persons";

const ACTION_CHIPS: { value: ActionFilter; label: string; icon: React.ElementType }[] = [
  { value: "all",                 label: "Tout",        icon: History  },
  { value: "create_person",       label: "Créations",   icon: UserPlus },
  { value: "update_person",       label: "Modifications", icon: Pencil },
  { value: "delete_person",       label: "Suppressions", icon: Trash2  },
  { value: "create_relationship", label: "Liens",       icon: Link2    },
  { value: "delete_relationship", label: "Liens retirés", icon: Unlink },
  { value: "merge_persons",       label: "Fusions",     icon: GitMerge },
];

const ACTION_LABELS: Record<ActionFilter, string> = Object.fromEntries(
  ACTION_CHIPS.map((c) => [c.value, c.label])
) as Record<ActionFilter, string>;

function actionVisual(action: string) {
  switch (action) {
    case "create_person":       return { icon: UserPlus, tone: "text-green-600",       bg: "bg-green-500/10",    badge: "bg-green-100 text-green-700"   };
    case "update_person":       return { icon: Pencil,   tone: "text-blue-600",        bg: "bg-blue-500/10",     badge: "bg-blue-100 text-blue-700"     };
    case "delete_person":       return { icon: Trash2,   tone: "text-destructive",     bg: "bg-destructive/10",  badge: "bg-red-100 text-red-700"       };
    case "create_relationship": return { icon: Link2,    tone: "text-green-600",       bg: "bg-green-500/10",    badge: "bg-green-100 text-green-700"   };
    case "delete_relationship": return { icon: Unlink,   tone: "text-destructive",     bg: "bg-destructive/10",  badge: "bg-red-100 text-red-700"       };
    case "merge_persons":       return { icon: GitMerge, tone: "text-amber-600",       bg: "bg-amber-500/10",    badge: "bg-amber-100 text-amber-700"   };
    default:                    return { icon: History,  tone: "text-muted-foreground", bg: "bg-muted",           badge: "bg-muted text-muted-foreground" };
  }
}

function personName(d: Record<string, unknown> | null): string {
  if (!d) return "une fiche";
  return `${(d.first_name as string) ?? ""} ${(d.last_name as string) ?? ""}`.trim() || "une fiche";
}

function relTypeLabel(t: string | undefined): string {
  switch (t) {
    case "parent":       return "parent";
    case "child":        return "enfant";
    case "spouse":       return "conjoint(e)";
    case "sibling":      return "frère / sœur";
    case "half_sibling": return "demi-frère / sœur";
    case "step_sibling": return "frère / sœur par alliance";
    default:             return t ?? "parenté";
  }
}

function describe(e: AuditEntry): { summary: string; detail: string | null } {
  const who = e.actorName ?? "Quelqu'un";
  const d = e.details;
  switch (e.action) {
    case "create_person": {
      const name = personName(d);
      return { summary: `${who} a créé la fiche de ${name}`, detail: null };
    }
    case "update_person": {
      const name = personName(d);
      const changed = d?.changed_fields as string[] | undefined;
      return {
        summary: `${who} a modifié la fiche de ${name}`,
        detail: changed?.length ? changed.join(", ") : null,
      };
    }
    case "delete_person":
      return { summary: `${who} a supprimé la fiche de ${personName(d)}`, detail: null };
    case "create_relationship": {
      const a = (d?.person_a_name as string) ?? "?";
      const b = (d?.person_b_name as string) ?? "?";
      return { summary: `${who} a relié ${a} et ${b}`, detail: relTypeLabel(d?.type as string) };
    }
    case "delete_relationship": {
      const a = (d?.person_a_name as string) ?? "?";
      const b = (d?.person_b_name as string) ?? "?";
      return { summary: `${who} a retiré le lien entre ${a} et ${b}`, detail: relTypeLabel(d?.type as string) };
    }
    case "merge_persons": {
      const src = (d?.source_name as string) ?? "une fiche";
      const tgt = (d?.target_name as string) ?? "une fiche";
      return { summary: `${who} a fusionné ${src} dans ${tgt}`, detail: null };
    }
    default:
      return { summary: `${who} — ${e.action}`, detail: null };
  }
}

function timeAgo(iso: string): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "";
  const diff = Date.now() - then;
  const min = Math.floor(diff / 60000);
  if (min < 1) return "à l'instant";
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h} h`;
  const j = Math.floor(h / 24);
  if (j < 7) return `${j} j`;
  return new Date(iso).toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
}

function formatDateLabel(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "Date inconnue";
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  if (d.toDateString() === today.toDateString()) return "Aujourd'hui";
  if (d.toDateString() === yesterday.toDateString()) return "Hier";
  return d.toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" });
}

function groupByDate(entries: AuditEntry[]): { label: string; items: AuditEntry[] }[] {
  const groups = new Map<string, AuditEntry[]>();
  for (const e of entries) {
    const label = formatDateLabel(e.createdAt);
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
  const [actorFilter, setActorFilter] = useState("all");
  const [search, setSearch] = useState("");

  useEffect(() => {
    if (!isAuthenticated) return;
    auditApi
      .myTree()
      .then(setEntries)
      .catch(() => setError("Impossible de charger le journal."))
      .finally(() => setLoading(false));
  }, [isAuthenticated]);

  const actors = useMemo(() => {
    const names = new Set(entries.map((e) => e.actorName ?? "Quelqu'un"));
    return Array.from(names).sort();
  }, [entries]);

  const filtered = useMemo(() => entries.filter((e) => {
    if (actionFilter !== "all" && e.action !== actionFilter) return false;
    if (actorFilter !== "all" && (e.actorName ?? "Quelqu'un") !== actorFilter) return false;
    if (search.trim()) {
      const { summary, detail } = describe(e);
      const q = search.toLowerCase();
      if (!summary.toLowerCase().includes(q) && !(detail ?? "").toLowerCase().includes(q)) return false;
    }
    return true;
  }), [entries, actionFilter, actorFilter, search]);

  const grouped = useMemo(() => groupByDate(filtered), [filtered]);
  const hasFilter = actionFilter !== "all" || actorFilter !== "all" || !!search.trim();

  return (
    <div className="canvas-grid min-h-screen bg-canvas">
      <div className="mx-auto max-w-xl px-4 pb-8 pt-6">

        {/* Back */}
        <Link to="/account" className="mb-4 flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground">
          <ArrowLeft className="size-4" /> Retour au compte
        </Link>

        {/* Header card */}
        <div className="rounded-2xl border border-border bg-card shadow-float">

          {/* Title row */}
          <div className="flex items-center justify-between px-5 pt-5">
            <div className="flex items-center gap-2">
              <History className="size-5 text-primary" />
              <h1 className="font-serif text-xl text-foreground">Activité de l'arbre</h1>
            </div>
            {!loading && (
              <span className="rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium text-muted-foreground">
                {filtered.length}{entries.length !== filtered.length ? ` / ${entries.length}` : ""}
              </span>
            )}
          </div>

          {/* Filters — always visible, compact */}
          {!loading && entries.length > 0 && (
            <div className="mt-3 space-y-2 px-5">

              {/* Search */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground pointer-events-none" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Rechercher…"
                  className="w-full rounded-xl border border-border bg-background py-2 pl-8 pr-8 text-sm outline-none focus:ring-2 focus:ring-ring"
                />
                {search && (
                  <button onClick={() => setSearch("")} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                    <X className="size-3.5" />
                  </button>
                )}
              </div>

              {/* Action chips — horizontal scroll on mobile */}
              <div className="-mx-5 flex gap-1.5 overflow-x-auto px-5 pb-0.5 scrollbar-none">
                {ACTION_CHIPS.map(({ value, label, icon: Icon }) => (
                  <button
                    key={value}
                    onClick={() => setActionFilter(value)}
                    className={[
                      "flex shrink-0 items-center gap-1 rounded-full px-3 py-1 text-xs font-medium transition-colors",
                      actionFilter === value
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted text-muted-foreground hover:bg-secondary hover:text-foreground",
                    ].join(" ")}
                  >
                    <Icon className="size-3" />
                    {label}
                  </button>
                ))}
              </div>

              {/* Member filter + reset — one row */}
              {actors.length > 1 && (
                <div className="flex items-center gap-2">
                  <User className="size-3.5 shrink-0 text-muted-foreground" />
                  <select
                    value={actorFilter}
                    onChange={(e) => setActorFilter(e.target.value)}
                    className="min-w-0 flex-1 rounded-lg border border-border bg-background px-2 py-1.5 text-xs outline-none focus:ring-2 focus:ring-ring"
                  >
                    <option value="all">Tous les membres</option>
                    {actors.map((a) => (
                      <option key={a} value={a}>{a}</option>
                    ))}
                  </select>
                  {hasFilter && (
                    <button
                      onClick={() => { setActionFilter("all"); setActorFilter("all"); setSearch(""); }}
                      className="shrink-0 rounded-lg border border-border px-2.5 py-1.5 text-xs text-muted-foreground transition-colors hover:border-destructive/40 hover:text-destructive"
                    >
                      Réinitialiser
                    </button>
                  )}
                </div>
              )}
              {actors.length <= 1 && hasFilter && (
                <button
                  onClick={() => { setActionFilter("all"); setActorFilter("all"); setSearch(""); }}
                  className="flex items-center gap-1 text-xs text-muted-foreground transition-colors hover:text-destructive"
                >
                  <X className="size-3" /> Réinitialiser
                </button>
              )}
            </div>
          )}

          {/* Divider */}
          <div className="mt-4 h-px bg-border" />

          {/* Content */}
          <div className="px-5 py-4">
            {loading ? (
              <div className="flex items-center justify-center py-10">
                <Loader2 className="size-5 animate-spin text-muted-foreground" />
              </div>
            ) : error ? (
              <p className="rounded-xl bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>
            ) : filtered.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">
                {entries.length === 0 ? "Aucune activité pour le moment." : "Aucun résultat."}
              </p>
            ) : (
              <div className="space-y-5">
                {grouped.map(({ label, items }) => (
                  <div key={label}>
                    <div className="mb-2 flex items-center gap-2">
                      <Calendar className="size-3 shrink-0 text-muted-foreground" />
                      <span className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">{label}</span>
                      <div className="h-px flex-1 bg-border" />
                    </div>

                    <ol className="space-y-0.5">
                      {items.map((e) => {
                        const v = actionVisual(e.action);
                        const Icon = v.icon;
                        const { summary, detail } = describe(e);
                        return (
                          <li key={e.id} className="flex items-start gap-3 rounded-xl px-2 py-2 transition-colors hover:bg-muted/40">
                            <span className={`mt-0.5 grid size-7 shrink-0 place-items-center rounded-lg ${v.bg} ${v.tone}`}>
                              <Icon className="size-3.5" />
                            </span>
                            <div className="min-w-0 flex-1">
                              <p className="text-sm leading-snug text-foreground">{summary}</p>
                              {detail && (
                                <p className="mt-0.5 text-xs text-muted-foreground">{detail}</p>
                              )}
                            </div>
                            <span className="mt-1 shrink-0 text-[11px] text-muted-foreground">{timeAgo(e.createdAt)}</span>
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
