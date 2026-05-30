import { Person } from "@/lib/types";
import { cn } from "@/lib/utils";
import { MapPin, Music } from "lucide-react";

export const CARD_W = 200;
export const CARD_H = 96;

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
        "absolute flex cursor-pointer select-none items-center gap-2.5 rounded-2xl border bg-card p-3 transition-all duration-150",
        selected
          ? "border-primary/50 shadow-card-selected ring-2 ring-primary/20"
          : "border-border shadow-card hover:shadow-float",
        isDeceased && "opacity-75 grayscale-[20%]",
      )}
    >
      {/* Photo */}
      <div className="relative size-[3.25rem] shrink-0 overflow-hidden rounded-xl bg-muted">
        {photo ? (
          <img src={photo.url} alt={fullName} className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-2xl">
            {person.gender === "female" ? "👩" : person.gender === "male" ? "👨" : "👤"}
          </div>
        )}
      </div>

      {/* Info */}
      <div className="min-w-0 flex-1">
        <p className="truncate font-serif text-[15px] leading-snug text-card-foreground">{fullName}</p>
        {person.nicknames && person.nicknames.length > 0 && (
          <p className="truncate text-[10px] italic text-muted-foreground">« {person.nicknames[0]} »</p>
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
        <div className="absolute right-2 top-2 flex size-4 items-center justify-center rounded-full bg-primary/10">
          <Music className="size-2.5 text-primary" />
        </div>
      )}
    </div>
  );
}
