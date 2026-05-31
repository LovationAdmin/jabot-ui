import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  ArrowLeft, UserPlus, Pencil, Trash2, Link2, Unlink, GitMerge, History, Loader2,
} from "lucide-react";
import { useAuthStore } from "@/lib/store";
import { auditApi, AuditEntry } from "@/lib/api";

export const Route = createFileRoute("/account/activity")({
  head: () => ({ meta: [{ title: "Activité — Jabot" }] }),
  component: ActivityPage,
});

// Icône + couleur par type d'action
function actionVisual(action: string) {
  switch (action) {
    case "create_person":       return { icon: UserPlus, tone: "text-green-600", bg: "bg-green-500/10" };
    case "update_person":       return { icon: Pencil,   tone: "text-blue-600",  bg: "bg-blue-500/10" };
    case "delete_person":       return { icon: Trash2,   tone: "text-destructive", bg: "bg-destructive/10" };
    case "create_relationship": return { icon: Link2,    tone: "text-green-600", bg: "bg-green-500/10" };
    case "delete_relationship": return { icon: Unlink,   tone: "text-destructive", bg: "bg-destructive/10" };
    case "merge_persons":       return { icon: GitMerge, tone: "text-amber-600", bg: "bg-amber-500/10" };
    default:                    return { icon: History,  tone: "text-muted-foreground", bg: "bg-muted" };
  }
}

function personName(d: Record<string, unknown> | null): string {
  if (!d) return "une fiche";
  const f = (d.first_name as string) ?? "";
  const l = (d.last_name as string) ?? "";
  const full = `${f} ${l}`.trim();
  return full || "une fiche";
}

function relText(d: Record<string, unknown> | null): string {
  if (!d) return "un lien de parenté";
  const a = (d.person_a_name as string) ?? "?";
  const b = (d.person_b_name as string) ?? "?";
  return `${a} ↔ ${b}`;
}

// Phrase lisible décrivant l'événement
function describe(e: AuditEntry): string {
  const who = e.actorName ?? "Quelqu'un";
  switch (e.action) {
    case "create_person":       return `${who} a créé la fiche de ${personName(e.details)}`;
    case "update_person":       return `${who} a modifié la fiche de ${personName(e.details)}`;
    case "delete_person":       return `${who} a supprimé la fiche de ${personName(e.details)}`;
    case "create_relationship": return `${who} a relié ${relText(e.details)}`;
    case "delete_relationship": return `${who} a dissocié ${relText(e.details)}`;
    case "merge_persons": {
      const src = (e.details?.source_name as string) ?? "une fiche";
      const tgt = (e.details?.target_name as string) ?? "une fiche";
      return `${who} a fusionné ${src} dans ${tgt}`;
    }
    default:                    return `${who} a effectué une action (${e.action})`;
  }
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
  if (j < 30) return `il y a ${j} j`;
  return new Date(iso).toLocaleDateString("fr-FR");
}

function ActivityPage() {
  const navigate = useNavigate();
  const { isAuthenticated } = useAuthStore();
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isAuthenticated) { navigate({ to: "/auth" }); return; }
    auditApi
      .myTree()
      .then(setEntries)
      .catch(() => setError("Impossible de charger le journal d'activité."))
      .finally(() => setLoading(false));
  }, [isAuthenticated, navigate]);

  return (
    <div className="canvas-grid min-h-screen bg-canvas p-4">
      <div className="mx-auto max-w-lg space-y-4 pt-8">
        <Link to="/account" className="flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground">
          <ArrowLeft className="size-4" /> Retour au compte
        </Link>

        <div className="rounded-2xl border border-border bg-card p-6 shadow-float">
          <div className="mb-1 flex items-center gap-2">
            <History className="size-5 text-primary" />
            <h1 className="font-serif text-2xl text-foreground">Activité de l'arbre</h1>
          </div>
          <p className="mb-6 text-sm text-muted-foreground">
            Qui a créé, modifié ou supprimé des fiches liées à votre arbre généalogique.
          </p>

          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="size-5 animate-spin text-muted-foreground" />
            </div>
          ) : error ? (
            <p className="rounded-xl bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>
          ) : entries.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              Aucune activité pour le moment.
            </p>
          ) : (
            <ol className="space-y-1">
              {entries.map((e) => {
                const v = actionVisual(e.action);
                const Icon = v.icon;
                return (
                  <li key={e.id} className="flex items-start gap-3 rounded-xl px-2 py-2.5 transition-colors hover:bg-muted/50">
                    <span className={`mt-0.5 grid size-8 shrink-0 place-items-center rounded-lg ${v.bg} ${v.tone}`}>
                      <Icon className="size-4" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm text-foreground">{describe(e)}</p>
                      <p className="text-xs text-muted-foreground">{timeAgo(e.createdAt)}</p>
                    </div>
                  </li>
                );
              })}
            </ol>
          )}
        </div>
      </div>
    </div>
  );
}
