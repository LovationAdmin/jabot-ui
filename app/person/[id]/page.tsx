"use client";

import { useParams, useRouter } from "next/navigation";
import { useFamilyTreeStore, useAuthStore } from "@/lib/store";
import { PersonCard } from "@/components/person/PersonCard";
import { PersonForm } from "@/components/person/PersonForm";
import { AudioPlayer } from "@/components/person/AudioPlayer";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  ArrowLeft,
  Edit,
  MapPin,
  Calendar,
  Users,
  Trees,
} from "lucide-react";
import { formatDate, getAge, getInitials, isDeceased } from "@/lib/utils";
import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { cn } from "@/lib/utils";

export default function PersonDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const { getPersonById, getParents, getChildren, getSiblings, getSpouse } =
    useFamilyTreeStore();
  const { isAuthenticated } = useAuthStore();
  const [isEditing, setIsEditing] = useState(false);
  const [photoIndex, setPhotoIndex] = useState(0);

  const person = getPersonById(id);

  if (!person) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center space-y-4">
          <Trees className="w-12 h-12 text-muted-foreground mx-auto" />
          <h2 className="text-xl font-semibold">Personne introuvable</h2>
          <Button asChild>
            <Link href="/">Retour à l&apos;arbre</Link>
          </Button>
        </div>
      </div>
    );
  }

  const parents = getParents(id);
  const children = getChildren(id);
  const siblings = getSiblings(id);
  const spouse = getSpouse(id);
  const deceased = isDeceased(person);
  const age = getAge(person.birthDate, person.deathDate);

  if (isEditing) {
    return (
      <div className="min-h-screen bg-background p-4">
        <div className="max-w-2xl mx-auto">
          <Button
            variant="ghost"
            size="sm"
            className="mb-6"
            onClick={() => setIsEditing(false)}
          >
            <ArrowLeft className="w-4 h-4 mr-1" />
            Annuler
          </Button>
          <PersonForm person={person} onSuccess={() => setIsEditing(false)} />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-amber-50 to-background">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-white/90 backdrop-blur-sm border-b px-4 h-14 flex items-center justify-between">
        <Button variant="ghost" size="sm" onClick={() => router.back()}>
          <ArrowLeft className="w-4 h-4 mr-1" />
          Retour
        </Button>
        <div className="flex items-center gap-2">
          <Trees className="w-5 h-5 text-primary" />
          <span className="font-semibold">Jabot</span>
        </div>
        {isAuthenticated && (
          <Button size="sm" onClick={() => setIsEditing(true)}>
            <Edit className="w-4 h-4 mr-1" />
            Modifier
          </Button>
        )}
      </div>

      <div className="max-w-2xl mx-auto p-4 space-y-6">
        {/* Photo section */}
        <div className="relative">
          {person.photos.length > 0 ? (
            <div className="relative h-64 rounded-2xl overflow-hidden">
              <Image
                src={person.photos[photoIndex].url}
                alt={`${person.firstName} ${person.lastName}`}
                fill
                className="object-cover"
              />
              {person.photos.length > 1 && (
                <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5">
                  {person.photos.map((_, i) => (
                    <button
                      key={i}
                      onClick={() => setPhotoIndex(i)}
                      className={cn(
                        "w-2 h-2 rounded-full transition-all",
                        i === photoIndex ? "bg-white w-5" : "bg-white/60"
                      )}
                    />
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div
              className={cn(
                "h-32 rounded-2xl flex items-center justify-center text-5xl font-bold",
                deceased
                  ? "bg-gray-100 text-gray-400"
                  : "bg-gradient-to-br from-amber-100 to-orange-100 text-primary"
              )}
            >
              {getInitials(person)}
            </div>
          )}
        </div>

        {/* Main info */}
        <div className="bg-white rounded-2xl p-6 shadow-sm border space-y-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground">
              {person.firstName}{" "}
              <span className="text-primary">{person.lastName}</span>
            </h1>
            {person.nicknames && person.nicknames.length > 0 && (
              <p className="text-muted-foreground text-sm mt-0.5">
                &quot;{person.nicknames.join(", ")}&quot;
              </p>
            )}
            <div className="flex items-center gap-2 mt-2">
              <span
                className={cn(
                  "inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium",
                  deceased
                    ? "bg-gray-100 text-gray-600"
                    : "bg-green-100 text-green-700"
                )}
              >
                {deceased ? "Décédé(e)" : "En vie"}
              </span>
              <span className="text-sm text-muted-foreground">
                {person.gender === "male"
                  ? "Homme"
                  : person.gender === "female"
                    ? "Femme"
                    : "Autre"}
              </span>
              {age !== null && (
                <span className="text-sm text-muted-foreground">
                  {age} ans{deceased ? " (à son décès)" : ""}
                </span>
              )}
            </div>
          </div>

          <Separator />

          <div className="space-y-3 text-sm">
            {person.birthDate && (
              <div className="flex items-center gap-3 text-muted-foreground">
                <Calendar className="w-4 h-4 text-primary" />
                <span>
                  Né(e) le{" "}
                  <span className="font-medium text-foreground">
                    {formatDate(person.birthDate)}
                  </span>
                </span>
              </div>
            )}
            {person.deathDate && (
              <div className="flex items-center gap-3 text-muted-foreground">
                <Calendar className="w-4 h-4 text-gray-400" />
                <span>
                  Décédé(e) le{" "}
                  <span className="font-medium text-foreground">
                    {formatDate(person.deathDate)}
                  </span>
                </span>
              </div>
            )}
            {person.cityOfOrigin && (
              <div className="flex items-center gap-3 text-muted-foreground">
                <MapPin className="w-4 h-4 text-primary" />
                <span>
                  Originaire de{" "}
                  <span className="font-medium text-foreground">
                    {person.cityOfOrigin}
                  </span>
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Audio section */}
        {person.audios.length > 0 && (
          <div className="bg-white rounded-2xl p-6 shadow-sm border space-y-4">
            <h2 className="font-semibold flex items-center gap-2">
              <span className="text-lg">🎵</span>
              Commentaires audio ({person.audios.length})
            </h2>
            <div className="space-y-3">
              {person.audios.map((audio) => (
                <AudioPlayer key={audio.id} audio={audio} />
              ))}
            </div>
          </div>
        )}

        {/* Family section */}
        <div className="bg-white rounded-2xl p-6 shadow-sm border space-y-5">
          <h2 className="font-semibold flex items-center gap-2">
            <Users className="w-5 h-5 text-primary" />
            Relations familiales
          </h2>

          {parents.length > 0 && (
            <div>
              <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                Parents
              </h3>
              <div className="grid gap-2">
                {parents.map((p) => (
                  <PersonCard key={p.id} person={p} compact />
                ))}
              </div>
            </div>
          )}

          {spouse && (
            <div>
              <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                Conjoint(e)
              </h3>
              <PersonCard person={spouse} compact />
            </div>
          )}

          {children.length > 0 && (
            <div>
              <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                Enfants ({children.length})
              </h3>
              <div className="grid gap-2">
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
                    <PersonCard key={p.id} person={p} compact />
                  ))}
              </div>
            </div>
          )}

          {siblings.length > 0 && (
            <div>
              <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                Frères & Sœurs ({siblings.length})
              </h3>
              <div className="grid gap-2">
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
                    <PersonCard key={p.id} person={p} compact />
                  ))}
              </div>
            </div>
          )}

          {parents.length === 0 &&
            children.length === 0 &&
            siblings.length === 0 &&
            !spouse && (
              <p className="text-muted-foreground text-sm text-center py-4">
                Aucune relation familiale enregistrée
              </p>
            )}
        </div>

        {/* View on canvas */}
        <Button
          className="w-full"
          variant="outline"
          asChild
        >
          <Link href={`/?focus=${id}`}>
            <Trees className="w-4 h-4 mr-2" />
            Voir sur l&apos;arbre généalogique
          </Link>
        </Button>
      </div>
    </div>
  );
}
