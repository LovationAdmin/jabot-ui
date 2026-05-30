import { useEffect, useRef, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { User, LogOut, IdCard, ChevronDown } from "lucide-react";
import { useAuthStore, useFamilyTreeStore } from "@/lib/store";

interface Props {
  onEditMyCard?: () => void;
}

export function AccountMenu({ onEditMyCard }: Props) {
  const navigate = useNavigate();
  const { phone, personId, logout } = useAuthStore();
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

  const me = personId ? getPersonById(personId) : undefined;

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex h-8 items-center gap-1.5 rounded-lg border border-border bg-background px-2.5 text-sm text-foreground transition-colors hover:bg-muted"
      >
        <span className="grid size-5 place-items-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground">
          {(me?.firstName?.[0] ?? phone?.slice(-2, -1) ?? "?").toUpperCase()}
        </span>
        <span className="hidden max-w-[8rem] truncate sm:block">{me ? me.firstName : phone}</span>
        <ChevronDown className="size-3.5 text-muted-foreground" />
      </button>

      {open && (
        <div className="absolute right-0 top-10 z-40 w-56 overflow-hidden rounded-xl border border-border bg-card shadow-float">
          <div className="border-b border-border px-4 py-3">
            <p className="text-sm font-medium text-foreground">{me ? `${me.firstName} ${me.lastName}` : "Mon compte"}</p>
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
