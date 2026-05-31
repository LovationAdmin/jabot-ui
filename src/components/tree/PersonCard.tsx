import { Person } from "@/lib/types";
import { FamilyColor, alpha } from "@/lib/familyColors";
import { cn } from "@/lib/utils";
import { MapPin, Music, Lock } from "lucide-react";

export const CARD_W = 208;
export const CARD_H = 112;

interface PersonCardProps {
  person: Person;
  selected: boolean;
  onSelect: (id: string) => void;
  isAuthenticated?: boolean;
  familyColor?: FamilyColor;
}

export function PersonCard({ person, selected, onSelect, isAuthenticated = false, familyColor }: PersonCardProps) {
  const isDeceased = !!person.deathDate;
  const photo = person.photos[0];
  const fullName = [person.firstName, person.lastName].filter(Boolean).join(" ");
  const birthYear = person.birthDate?.slice(0, 4);
  const deathYear = person.deathDate?.slice(0, 4);
  const years = birthYear ? (deathYear ? `${birthYear} – ${deathYear}` : `${birthYear} –`) : null;

  const borderColor = familyColor?.border;
  const bgColor = familyColor?.bg;
  const accentColor = familyColor?.accent;

  return (
    <div
      data-card
      onClick={() => onSelect(person.id)}
      style={{
        width: CARD_W,
        height: CARD_H,
        left: person.position?.x ?? 0,
        top: person.position?.y ?? 0,
        borderColor: selected ? accentColor : (borderColor ?? undefined),
        backgroundColor: bgColor ?? undefined,
      }}
      className={cn(
        "absolute flex cursor-pointer select-none items-center gap-3 rounded-2xl border p-3 transition-all duration-200 ease-out",
        selected
          ? "-translate-y-0.5 shadow-card-selected ring-2"
          : "shadow-card hover:-translate-y-0.5 hover:shadow-float",
        !familyColor && (selected ? "border-primary/40 bg-card ring-primary/25" : "border-border/70 bg-card"),
        isDeceased && "opacity-80 grayscale-[15%]",
      )}
    >
      {/* Photo */}
      <div
        className="relative size-14 shrink-0 overflow-hidden rounded-xl"
        style={familyColor ? { outline: `2px solid ${alpha(familyColor.border, 0.2)}` } : undefined}
      >
        {isAuthenticated && photo ? (
          <img src={photo.url} alt={fullName} className="h-full w-full object-cover" />
        ) : isAuthenticated ? (
          <div
            className="flex h-full w-full items-center justify-center text-xl text-white"
            style={familyColor
              ? { background: `linear-gradient(135deg, ${familyColor.accent}, ${familyColor.border})` }
              : undefined}
          >
            {!familyColor && <span className="brand-gradient absolute inset-0" />}
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
        <p className="line-clamp-2 break-words font-display text-[14px] font-semibold leading-tight text-card-foreground">{fullName}</p>
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
    </div>
  );
}
