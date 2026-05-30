"use client";

import { useState } from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { AudioPlayer } from "./AudioPlayer";
import { PersonCard } from "./PersonCard";
import { Person } from "@/lib/types";
import { useFamilyTreeStore } from "@/lib/store";
import {
  formatDate,
  getAge,
  getInitials,
  isDeceased,
} from "@/lib/utils";
import { cn } from "@/lib/utils";
import {
  Edit,
  MapPin,
  Calendar,
  Users,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";

interface PersonSheetProps {
  person: Person;
  open: boolean;
  onClose: () => void;
  isAuthenticated: boolean;
  onEdit?: (person: Person) => void;
}

export function PersonSheet({
  person,
  open,
  onClose,
  isAuthenticated,
  onEdit,
}: PersonSheetProps) {
  const { getParents, getChildren, getSiblings, getSpouse, setSelectedPerson } =
    useFamilyTreeStore();
  const [photoIdx, setPhotoIdx] = useState(0);

  const parents = getParents(person.id);
  const children = getChildren(person.id);
  const siblings = getSiblings(person.id);
  const spouse = getSpouse(person.id);
  const deceased = isDeceased(person);
  const age = getAge(person.birthDate, person.deathDate);

  const handleRelatedPersonClick = (relatedPerson: Person) => {
    setSelectedPerson(relatedPerson.id);
    onClose();
  };

  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
      <SheetContent
        side="right"
        className="w-full sm:max-w-md p-0 flex flex-col"
      >
        {/* Header */}
        <div className="flex-shrink-0 p-4 border-b">
          <SheetHeader>
            <div className="flex items-start justify-between gap-2">
              <SheetTitle className="text-left leading-tight">
                {person.firstName}{" "}
                <span className="text-primary">{person.lastName}</span>
                {person.nicknames && person.nicknames.length > 0 && (
                  <span className="block text-sm font-normal text-muted-foreground mt-0.5">
                    &ldquo;{person.nicknames.join(", ")}&rdquo;
                  </span>
                )}
              </SheetTitle>
              <div className="flex gap-2 flex-shrink-0">
                {isAuthenticated && onEdit && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => onEdit(person)}
                  >
                    <Edit className="w-3.5 h-3.5 mr-1" />
                    Modifier
                  </Button>
                )}
                <Button size="sm" variant="ghost" asChild>
                  <Link href={`/person/${person.id}`} onClick={onClose}>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </Link>
                </Button>
              </div>
            </div>
          </SheetHeader>
        </div>

        <ScrollArea className="flex-1">
          <div className="p-4 space-y-5">
            {/* Photo carousel */}
            {person.photos.length > 0 ? (
              <div className="relative h-52 rounded-xl overflow-hidden">
                <Image
                  src={person.photos[photoIdx].url}
                  alt={`${person.firstName} ${person.lastName}`}
                  fill
                  className="object-cover"
                  sizes="400px"
                />
                {person.photos.length > 1 && (
                  <>
                    <button
                      onClick={() =>
                        setPhotoIdx(
                          (i) =>
                            (i - 1 + person.photos.length) %
                            person.photos.length
                        )
                      }
                      className="absolute left-2 top-1/2 -translate-y-1/2 bg-black/40 hover:bg-black/70 text-white rounded-full p-1"
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() =>
                        setPhotoIdx((i) => (i + 1) % person.photos.length)
                      }
                      className="absolute right-2 top-1/2 -translate-y-1/2 bg-black/40 hover:bg-black/70 text-white rounded-full p-1"
                    >
                      <ChevronRight className="w-4 h-4" />
                    </button>
                    <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1.5">
                      {person.photos.map((_, i) => (
                        <button
                          key={i}
                          onClick={() => setPhotoIdx(i)}
                          className={cn(
                            "w-2 h-2 rounded-full bg-white transition-opacity",
                            i === photoIdx ? "opacity-100" : "opacity-50"
                          )}
                        />
                      ))}
                    </div>
                  </>
                )}
              </div>
            ) : (
              <div
                className={cn(
                  "h-24 rounded-xl flex items-center justify-center text-4xl font-bold",
                  deceased
                    ? "bg-gray-100 text-gray-400"
                    : "bg-gradient-to-br from-amber-100 to-orange-100 text-primary"
                )}
              >
                {getInitials(person)}
              </div>
            )}

            {/* Status */}
            <div className="flex items-center gap-2 flex-wrap">
              <span
                className={cn(
                  "inline-flex items-center px-3 py-1 rounded-full text-xs font-medium",
                  deceased
                    ? "bg-gray-100 text-gray-600"
                    : "bg-green-100 text-green-700"
                )}
              >
                {deceased ? "Décédé(e)" : "En vie"}
              </span>
              <span className="text-xs text-muted-foreground bg-muted px-3 py-1 rounded-full">
                {person.gender === "male"
                  ? "Homme"
                  : person.gender === "female"
                    ? "Femme"
                    : "Autre"}
              </span>
              {age !== null && (
                <span className="text-xs text-muted-foreground bg-muted px-3 py-1 rounded-full">
                  {age} ans{deceased ? " (décès)" : ""}
                </span>
              )}
            </div>

            {/* Details */}
            <div className="space-y-3">
              {person.birthDate && (
                <div className="flex items-center gap-3 text-sm">
                  <Calendar className="w-4 h-4 text-primary flex-shrink-0" />
                  <div>
                    <span className="text-muted-foreground">Né(e) le </span>
                    <span className="font-medium">
                      {formatDate(person.birthDate)}
                    </span>
                  </div>
                </div>
              )}
              {person.deathDate && (
                <div className="flex items-center gap-3 text-sm">
                  <Calendar className="w-4 h-4 text-gray-400 flex-shrink-0" />
                  <div>
                    <span className="text-muted-foreground">Décédé(e) le </span>
                    <span className="font-medium">
                      {formatDate(person.deathDate)}
                    </span>
                  </div>
                </div>
              )}
              {person.cityOfOrigin && (
                <div className="flex items-center gap-3 text-sm">
                  <MapPin className="w-4 h-4 text-primary flex-shrink-0" />
                  <div>
                    <span className="text-muted-foreground">
                      Originaire de{" "}
                    </span>
                    <span className="font-medium">{person.cityOfOrigin}</span>
                  </div>
                </div>
              )}
            </div>

            {/* Audio */}
            {person.audios.length > 0 && (
              <div className="space-y-3">
                <Separator />
                <h3 className="text-sm font-semibold flex items-center gap-2">
                  <span>🎵</span>
                  Commentaires audio ({person.audios.length})
                </h3>
                {person.audios.map((audio) => (
                  <AudioPlayer key={audio.id} audio={audio} />
                ))}
              </div>
            )}

            {/* Family relationships */}
            {(parents.length > 0 ||
              children.length > 0 ||
              siblings.length > 0 ||
              spouse) && (
              <div className="space-y-4">
                <Separator />
                <h3 className="text-sm font-semibold flex items-center gap-2">
                  <Users className="w-4 h-4 text-primary" />
                  Famille
                </h3>

                {parents.length > 0 && (
                  <div>
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">
                      Parents
                    </p>
                    <div className="space-y-2">
                      {parents.map((p) => (
                        <PersonCard
                          key={p.id}
                          person={p}
                          compact
                          onClick={() => handleRelatedPersonClick(p)}
                        />
                      ))}
                    </div>
                  </div>
                )}

                {spouse && (
                  <div>
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">
                      Conjoint(e)
                    </p>
                    <PersonCard
                      person={spouse}
                      compact
                      onClick={() => handleRelatedPersonClick(spouse)}
                    />
                  </div>
                )}

                {children.length > 0 && (
                  <div>
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">
                      Enfants ({children.length})
                    </p>
                    <div className="space-y-2">
                      {children
                        .sort((a, b) => {
                          if (!a.birthDate) return 1;
                          if (!b.birthDate) return -1;
                          return (
                            new Date(a.birthDate).getTime() -
                            new Date(b.birthDate).getTime()
                          );
                        })
                        .map((p) => (
                          <PersonCard
                            key={p.id}
                            person={p}
                            compact
                            onClick={() => handleRelatedPersonClick(p)}
                          />
                        ))}
                    </div>
                  </div>
                )}

                {siblings.length > 0 && (
                  <div>
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">
                      Frères & Sœurs ({siblings.length})
                    </p>
                    <div className="space-y-2">
                      {siblings
                        .sort((a, b) => {
                          if (!a.birthDate) return 1;
                          if (!b.birthDate) return -1;
                          return (
                            new Date(a.birthDate).getTime() -
                            new Date(b.birthDate).getTime()
                          );
                        })
                        .map((p) => (
                          <PersonCard
                            key={p.id}
                            person={p}
                            compact
                            onClick={() => handleRelatedPersonClick(p)}
                          />
                        ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}
