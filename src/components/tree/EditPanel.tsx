import { Person } from "@/lib/types";
import { X, Calendar, MapPin, Music, ImageIcon } from "lucide-react";

interface EditPanelProps {
  person: Person | null;
  onClose: () => void;
  isAuthenticated?: boolean;
}

export function EditPanel({ person, onClose, isAuthenticated }: EditPanelProps) {
  if (!person) return null;

  const fullName = [person.firstName, person.lastName].filter(Boolean).join(" ");
  const photo = person.photos[0];

  return (
    <aside className="flex h-full w-80 shrink-0 flex-col border-l border-border/60 bg-card">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border/60 px-5 py-4">
        <h2 className="font-display text-lg font-semibold text-foreground">Fiche</h2>
        <button
          onClick={onClose}
          className="grid size-7 place-items-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          <X className="size-4" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-5">
        {/* Photo */}
        <div className="relative mx-auto mb-4 size-24 overflow-hidden rounded-3xl">
          {photo ? (
            <img src={photo.url} alt={fullName} className="h-full w-full object-cover" />
          ) : (
            <div className="brand-gradient flex h-full w-full items-center justify-center text-4xl text-white">
              {person.firstName?.[0]?.toUpperCase() ?? "?"}
            </div>
          )}
        </div>

        {/* Name */}
        <div className="mb-5 text-center">
          <h3 className="font-display text-2xl font-bold text-foreground">{fullName}</h3>
          {person.nicknames && person.nicknames.length > 0 && (
            <p className="mt-0.5 text-sm text-primary/80">« {person.nicknames.join(", ")} »</p>
          )}
        </div>

        {/* Details */}
        <div className="mb-5 space-y-2 text-sm">
          {(person.birthDate || person.deathDate) && (
            <div className="flex items-center gap-2 text-muted-foreground">
              <Calendar className="size-3.5 shrink-0" />
              <span>
                {person.birthDate ?? "?"}{person.deathDate ? ` – ${person.deathDate}` : ""}
              </span>
            </div>
          )}
          {person.cityOfOrigin && (
            <div className="flex items-center gap-2 text-muted-foreground">
              <MapPin className="size-3.5 shrink-0" />
              <span>{person.cityOfOrigin}</span>
            </div>
          )}
        </div>

        {/* Photo gallery */}
        {person.photos.length > 0 && (
          <div className="mb-5">
            <p className="mb-2 flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              <ImageIcon className="size-3" /> Photos
            </p>
            <div className="grid grid-cols-3 gap-1.5">
              {person.photos.map((ph) => (
                <img key={ph.id} src={ph.url} alt="" className="aspect-square rounded-xl object-cover" />
              ))}
            </div>
          </div>
        )}

        {/* Audio */}
        {person.audios.length > 0 && (
          <div className="mb-5">
            <p className="mb-2 flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              <Music className="size-3" /> Messages audio
            </p>
            <div className="space-y-2">
              {person.audios.map((au) => (
                <audio key={au.id} controls src={au.url} className="w-full" />
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Actions */}
      {isAuthenticated && (
        <div className="border-t border-border/60 p-4">
          <button className="brand-gradient w-full rounded-xl px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-opacity hover:opacity-90">
            Modifier
          </button>
        </div>
      )}
    </aside>
  );
}
