import { useEffect, useRef, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { User, LogOut, IdCard, ChevronDown, UserPlus } from "lucide-react";
import { useAuthStore, useFamilyTreeStore } from "@/lib/store";

interface Props {
  onEditMyCard?: () => void;
  onInvite?: () => void;
}

export function AccountMenu({ onEditMyCard, onInvite }: Props) {
  const navigate = useNavigate();
  const { phone, personId, firstName: storedFirstName, logout } = useAuthStore();
  const { getPersonById } = useFamilyTreeStore();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  // Préférer la fiche du store, sinon le prénom mémorisé lors de l'onboarding.
  const me = personId ? getPersonById(personId) : undefined;
  const displayName = me?.firstName ?? storedFirstName;
  const initial = (displayName?.[0] ?? phone?.slice(-2, -1) ?? "?").toUpperCase();

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex h-8 items-center gap-1.5 rounded-lg border border-border bg-background px-2.5 text-sm text-foreground transition-colors hover:bg-muted"
      >
        <span className="grid size-5 place-items-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground">
          {initial}
        </span>
        <span className="hidden max-w-[8rem] truncate sm:block">{displayName ?? phone}</span>
        <ChevronDown className="size-3.5 text-muted-foreground" />
      </button>

      {open && (
        <div className="absolute right-0 top-10 z-40 w-56 overflow-hidden rounded-xl border border-border bg-card shadow-float">
          <div className="border-b border-border px-4 py-3">
            <p className="text-sm font-medium text-foreground">
              {me ? `${me.firstName} ${me.lastName}`.trim() : (displayName ?? "Mon compte")}
            </p>
            <p className="text-xs text-muted-foreground">{phone}</p>
          </div>
          <div className="p-1">
            {personId && (
              <button
                onClick={() => { setOpen(false); onEditMyCard?.(); }}
                className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-foreground transition-colors hover:bg-muted"
              >
                <IdCard className="size-4 text-muted-foreground" /> Ma fiche
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
            <button
              onClick={() => { setOpen(false); navigate({ to: "/account" }); }}
              className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-foreground transition-colors hover:bg-muted"
            >
              <User className="size-4 text-muted-foreground" /> Parametres du compte
            </button>
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
