import { Person } from "@/lib/types";
import { FamilyColor, alpha } from "@/lib/familyColors";
import { SurnameColor } from "@/lib/surnameColors";
import { cn } from "@/lib/utils";
import { MapPin, Music, Lock, ChevronUp, ChevronDown } from "lucide-react";

export const CARD_W = 208;
export const CARD_H = 112;

interface PersonCardProps {
  person: Person;
  selected: boolean;
  onSelect: (id: string) => void;
  isAuthenticated?: boolean;
  familyColor?: FamilyColor;
  // Couleur du nom de famille → bandeau d'identification en haut de la carte.
  surnameColor?: SurnameColor;
  // Surbrillance de lignée : "ancestor"/"descendant" = mis en avant, "dim" = estompé.
  highlight?: "ancestor" | "descendant" | "dim" | null;
  // Direction de lignée actuellement mise en surbrillance pour CETTE carte.
  lineageDir?: "ancestors" | "descendants" | null;
  // Bascule la surbrillance des ascendants / descendants depuis les flèches.
  onToggleAncestors?: (id: string) => void;
  onToggleDescendants?: (id: string) => void;
  // Famille étendue : hors de la composante directe de l'utilisateur.
  isExtended?: boolean;
}

export function PersonCard({
  person, selected, onSelect, isAuthenticated = false, familyColor, surnameColor, highlight,
  lineageDir, onToggleAncestors, onToggleDescendants, isExtended = false,
}: PersonCardProps) {
  const isDeceased = !!person.deathDate;
  const photo = person.photos[0];
  const fullName = [person.firstName, person.lastName].filter(Boolean).join(" ");
  const birthYear = person.birthDate?.slice(0, 4);
  const deathYear = person.deathDate?.slice(0, 4);
  const years = birthYear ? (deathYear ? `${birthYear} – ${deathYear}` : `${birthYear} –`) : null;

  const borderColor = surnameColor?.band ?? familyColor?.border;
  const bgColor = surnameColor?.soft ?? familyColor?.bg;
  const accentColor = familyColor?.accent;

  return (
    <div
      data-card
      data-person-id={person.id}
      onClick={() => onSelect(person.id)}
      style={{
        width: CARD_W,
        height: CARD_H,
        left: person.position?.x ?? 0,
        top: person.position?.y ?? 0,
        borderColor: selected ? (accentColor ?? surnameColor?.band) : (borderColor ?? undefined),
        backgroundColor: bgColor ?? undefined,
      }}
      className={cn(
        "absolute flex cursor-pointer select-none items-center gap-3 rounded-2xl border p-3 transition-all duration-200 ease-out",
        selected
          ? "-translate-y-0.5 shadow-card-selected ring-2"
          : "shadow-card hover:-translate-y-0.5 hover:shadow-float",
        !familyColor && !surnameColor && (selected ? "border-primary/40 bg-card ring-primary/25" : "border-border/70 bg-card"),
        isDeceased && "opacity-80 grayscale-[15%]",
        highlight === "ancestor" && "z-10 -translate-y-0.5 ring-2 ring-amber-400 shadow-float",
        highlight === "descendant" && "z-10 -translate-y-0.5 ring-2 ring-sky-400 shadow-float",
        highlight === "dim" && "opacity-30 grayscale",
        isExtended && "opacity-50 border-dashed",
      )}
    >
      {/* Bandeau nom de famille : identification rapide de la lignée. */}
      {surnameColor && (
        <span
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-0 h-2 rounded-t-2xl"
          style={{ backgroundColor: surnameColor.band }}
        />
      )}

      {/* Photo */}
      <div
        className="relative size-14 shrink-0 overflow-hidden rounded-xl"
        style={familyColor ? { outline: `2px solid ${alpha(familyColor.border, 0.2)}` } : undefined}
      >
        {isAuthenticated && photo ? (
          <img src={photo.url} alt={fullName} crossOrigin="anonymous" className="h-full w-full object-cover" />
        ) : isAuthenticated ? (
          <div
            className="flex h-full w-full items-center justify-center text-xl text-white"
            style={familyColor
              ? { background: `linear-gradient(135deg, ${familyColor.accent}, ${familyColor.border})` }
              : surnameColor
              ? { background: `linear-gradient(135deg, ${surnameColor.band}, ${surnameColor.text})` }
              : undefined}
          >
            {!familyColor && !surnameColor && <span className="brand-gradient absolute inset-0" />}
            <span className="relative">{person.firstName?.[0]?.toUpperCase() ?? "?"}</span>
          </div>
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-muted">
            <Lock className="size-5 text-muted-foreground" />
          </div>
        )}
      </div>

      {/* Info */}
      <div className="min-w-0 flex-1">
        <p className="break-words font-display text-[14px] font-semibold leading-tight text-card-foreground" style={{ display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{fullName}</p>
        {isAuthenticated && person.nicknames && person.nicknames.length > 0 && (
          <p className="truncate text-[11px]" style={familyColor ? { color: familyColor.accent } : { color: "var(--color-primary)" }}>
            &laquo; {person.nicknames[0]} &raquo;
          </p>
        )}
        {isAuthenticated && years && (
          <p className="mt-0.5 text-[11px] text-muted-foreground">{years}</p>
        )}
        {person.cityOfOrigin && (
          <p className="flex items-center gap-0.5 text-[10px] text-muted-foreground">
            <MapPin className="size-2.5 shrink-0" />
            <span className="truncate">{person.cityOfOrigin}</span>
          </p>
        )}
        {!isAuthenticated && (
          <p className="mt-0.5 text-[10px] text-muted-foreground/60">Connectez-vous pour plus</p>
        )}
      </div>

      {/* Audio badge */}
      {isAuthenticated && person.audios.length > 0 && (
        <div
          className="absolute right-2.5 top-2.5 flex size-5 items-center justify-center rounded-full"
          style={familyColor ? { background: alpha(familyColor.accent, 0.13) } : { background: "var(--color-primary-12)" }}
        >
          <Music className="size-2.5" style={familyColor ? { color: familyColor.accent } : { color: "var(--color-primary)" }} />
        </div>
      )}

      {/* Flèches de lignée — visibles sur la carte sélectionnée. La flèche du
          haut éclaire les ascendants, celle du bas les descendants. */}
      {selected && onToggleAncestors && (
        <button
          onClick={(e) => { e.stopPropagation(); onToggleAncestors(person.id); }}
          title="Surligner les ascendants"
          className={cn(
            "absolute left-1/2 top-0 z-20 grid size-6 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full border shadow-sm transition-colors",
            lineageDir === "ancestors"
              ? "border-amber-400 bg-amber-400 text-white"
              : "border-border bg-card text-muted-foreground hover:border-amber-400 hover:text-amber-500",
          )}
        >
          <ChevronUp className="size-3.5" />
        </button>
      )}
      {selected && onToggleDescendants && (
        <button
          onClick={(e) => { e.stopPropagation(); onToggleDescendants(person.id); }}
          title="Surligner les descendants"
          className={cn(
            "absolute left-1/2 bottom-0 z-20 grid size-6 -translate-x-1/2 translate-y-1/2 place-items-center rounded-full border shadow-sm transition-colors",
            lineageDir === "descendants"
              ? "border-sky-400 bg-sky-400 text-white"
              : "border-border bg-card text-muted-foreground hover:border-sky-400 hover:text-sky-500",
          )}
        >
          <ChevronDown className="size-3.5" />
        </button>
      )}
    </div>
  );
}
