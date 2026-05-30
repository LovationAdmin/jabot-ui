import { Person } from "@/lib/types";
import { cn } from "@/lib/utils";
import { MapPin, Music } from "lucide-react";

export const CARD_W = 208;
export const CARD_H = 100;

interface PersonCardProps {
  person: Person;
  selected: boolean;
  onSelect: (id: string) => void;
}

export function PersonCard({ person, selected, onSelect }: PersonCardProps) {
  const isDeceased = !!person.deathDate;
  const photo = person.photos[0];
  const fullName = [person.firstName, person.lastName].filter(Boolean).join(" ");
  const birthYear = person.birthDate?.slice(0, 4);
  const deathYear = person.deathDate?.slice(0, 4);
  const years = birthYear ? (deathYear ? `${birthYear} – ${deathYear}` : `${birthYear} –`) : null;

  return (
    <div
      data-card
      onClick={() => onSelect(person.id)}
      style={{ width: CARD_W, height: CARD_H, left: person.position?.x ?? 0, top: person.position?.y ?? 0 }}
      className={cn(
        "absolute flex cursor-pointer select-none items-center gap-3 rounded-2xl border bg-card p-3 transition-all duration-200 ease-out",
        selected
          ? "-translate-y-0.5 border-primary/40 shadow-card-selected ring-2 ring-primary/25"
          : "border-border/70 shadow-card hover:-translate-y-0.5 hover:shadow-float",
        isDeceased && "opacity-80 grayscale-[15%]",
      )}
    >
      {/* Photo */}
      <div className="relative size-14 shrink-0 overflow-hidden rounded-xl">
        {photo ? (
          <img src={photo.url} alt={fullName} className="h-full w-full object-cover" />
        ) : (
          <div className="brand-gradient flex h-full w-full items-center justify-center text-xl text-white">
            {person.firstName?.[0]?.toUpperCase() ?? "?"}
          </div>
        )}
      </div>

      {/* Info */}
      <div className="min-w-0 flex-1">
        <p className="truncate font-display text-[15px] font-semibold leading-snug text-card-foreground">{fullName}</p>
        {person.nicknames && person.nicknames.length > 0 && (
          <p className="truncate text-[11px] text-primary/80">« {person.nicknames[0]} »</p>
        )}
        {years && <p className="mt-0.5 text-[11px] text-muted-foreground">{years}</p>}
        {person.cityOfOrigin && (
          <p className="flex items-center gap-0.5 text-[10px] text-muted-foreground">
            <MapPin className="size-2.5 shrink-0" />
            <span className="truncate">{person.cityOfOrigin}</span>
          </p>
        )}
      </div>

      {/* Audio badge */}
      {person.audios.length > 0 && (
        <div className="absolute right-2.5 top-2.5 flex size-5 items-center justify-center rounded-full bg-primary/12">
          <Music className="size-2.5 text-primary" />
        </div>
      )}
    </div>
  );
}
