import { useEffect, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { User, LogOut, IdCard, ChevronDown, UserPlus, History, TreePine, Check, Copy, GitMerge, CircleHelp } from "lucide-react";
import { useAuthStore, useFamilyTreeStore } from "@/lib/store";

interface Props {
  onEditMyCard?: () => void;
  onInvite?: () => void;
  onConverge?: () => void;
  onShowTutorial?: () => void;
}

export function AccountMenu({ onEditMyCard, onInvite, onConverge, onShowTutorial }: Props) {
  const { phone, personId, firstName: storedFirstName, logout, treeAccesses, activeTreeId, setActiveTree } = useAuthStore();
  const { getPersonById, loadTree, duplicateCount } = useFamilyTreeStore();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  const me = personId ? getPersonById(personId) : undefined;
  const displayName = me?.firstName ?? storedFirstName;
  const initial = (displayName?.[0] ?? phone?.slice(-2, -1) ?? "?").toUpperCase();

  const activeTree = treeAccesses.find((t) => t.treeId === activeTreeId);
  const hasMultipleTrees = treeAccesses.length > 1;

  const ownedOtherTree = treeAccesses.find((t) => t.treeId !== activeTreeId);

  async function switchTree(treeId: string) {
    setActiveTree(treeId);
    setOpen(false);
    await loadTree();
  }

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((o) => !o)}
        className="relative flex h-8 items-center gap-1.5 rounded-lg border border-border bg-background px-2.5 text-sm text-foreground transition-colors hover:bg-muted"
      >
        <span className="grid size-5 place-items-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground">
          {initial}
        </span>
        <span className="hidden max-w-[8rem] truncate sm:block">{displayName ?? phone}</span>
        <ChevronDown className="size-3.5 text-muted-foreground" />
        {/* Pastille : doublons a examiner */}
        {duplicateCount > 0 && (
          <span className="absolute -right-1 -top-1 grid min-w-4 place-items-center rounded-full bg-amber-500 px-1 text-[10px] font-bold leading-4 text-white">
            {duplicateCount > 9 ? "9+" : duplicateCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-10 z-50 w-60 overflow-hidden rounded-xl border border-border bg-card shadow-float">
          <div className="border-b border-border px-4 py-3">
            <p className="text-sm font-medium text-foreground">
              {me ? `${me.firstName} ${me.lastName}`.trim() : (displayName ?? "Mon compte")}
            </p>
            <p className="text-xs text-muted-foreground">{phone}</p>
          </div>

          {/* Tree switcher — shown when user has access to multiple trees */}
          {hasMultipleTrees && (
            <div className="border-b border-border px-2 py-2">
              <p className="px-2 py-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Mes arbres</p>
              {treeAccesses.map((t) => (
                <button
                  key={t.treeId}
                  onClick={() => switchTree(t.treeId)}
                  className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-sm text-foreground transition-colors hover:bg-muted"
                >
                  <TreePine className="size-4 shrink-0 text-muted-foreground" />
                  <span className="min-w-0 flex-1 truncate text-left">{t.treeName}</span>
                  <span className="text-[10px] text-muted-foreground capitalize">{t.role}</span>
                  {t.treeId === activeTreeId && <Check className="size-3.5 shrink-0 text-primary" />}
                </button>
              ))}
            </div>
          )}

          <div className="p-1">
            {/* Active tree indicator when only one tree */}
            {!hasMultipleTrees && activeTree && (
              <div className="flex items-center gap-2 px-3 py-2 text-xs text-muted-foreground">
                <TreePine className="size-3.5" />
                <span className="truncate">{activeTree.treeName}</span>
                <span className="capitalize">· {activeTree.role}</span>
              </div>
            )}

            {personId && (
              <button
                onClick={() => { setOpen(false); onEditMyCard?.(); }}
                className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-foreground transition-colors hover:bg-muted"
              >
                <IdCard className="size-4 text-muted-foreground" /> Ma fiche
              </button>
            )}
            {/* Relier mon arbre : visible dès que l'utilisateur possède un autre arbre */}
            {onConverge && (
              <button
                onClick={() => { setOpen(false); onConverge(); }}
                className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-primary transition-colors hover:bg-primary/10"
              >
                <GitMerge className="size-4" />
                <span className="flex-1 text-left">Relier mon arbre</span>
                {ownedOtherTree && <span className="text-[10px] text-muted-foreground truncate max-w-[6rem]">{ownedOtherTree.treeName}</span>}
              </button>
            )}
            {onInvite && (
              <button
                onClick={() => { setOpen(false); onInvite(); }}
                className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-foreground transition-colors hover:bg-muted"
              >
                <UserPlus className="size-4 text-muted-foreground" /> Inviter un proche
              </button>
            )}
            {duplicateCount > 0 && (
              <Link
                to="/account/duplicates"
                onClick={() => setOpen(false)}
                className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-foreground transition-colors hover:bg-muted"
              >
                <Copy className="size-4 text-amber-600" />
                <span className="flex-1 text-left">Doublons à examiner</span>
                <span className="grid min-w-5 place-items-center rounded-full bg-amber-500 px-1.5 text-[11px] font-bold text-white">
                  {duplicateCount}
                </span>
              </Link>
            )}
            <Link
              to="/account/activity"
              onClick={() => setOpen(false)}
              className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-foreground transition-colors hover:bg-muted"
            >
              <History className="size-4 text-muted-foreground" /> Journal d'activité
            </Link>
            {onShowTutorial && (
              <button
                onClick={() => { setOpen(false); onShowTutorial(); }}
                className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-foreground transition-colors hover:bg-muted"
              >
                <CircleHelp className="size-4 text-muted-foreground" /> Revoir le tutoriel
              </button>
            )}
            <Link
              to="/account"
              onClick={() => setOpen(false)}
              className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-foreground transition-colors hover:bg-muted"
            >
              <User className="size-4 text-muted-foreground" /> Paramètres du compte
            </Link>
            <button
              onClick={() => { setOpen(false); logout(); }}
              className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-destructive transition-colors hover:bg-destructive/10"
            >
              <LogOut className="size-4" /> Deconnexion
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
