"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Person, MediaFile } from "@/lib/types";
import { useFamilyTreeStore } from "@/lib/store";
import { mediaApi, personsApi, relationshipsApi } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PhotoUpload } from "./PhotoUpload";
import { AudioPlayer } from "./AudioPlayer";
import { useToast } from "@/hooks/use-toast";
import { Upload, Trash2, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatDuration } from "@/lib/utils";

const personSchema = z.object({
  firstName: z.string().min(1, "Le prénom est requis"),
  lastName: z.string().min(1, "Le nom est requis"),
  nicknames: z.string().optional(),
  gender: z.enum(["male", "female", "other"]),
  birthDate: z.string().optional(),
  deathDate: z.string().optional(),
  cityOfOrigin: z.string().optional(),
  relationshipType: z
    .enum(["parent", "child", "sibling", "spouse"])
    .optional(),
  relatedPersonId: z.string().optional(),
});

type PersonFormValues = z.infer<typeof personSchema>;

interface PersonFormProps {
  person?: Person;
  relatedPersonId?: string;
  defaultRelationshipType?: "parent" | "child" | "sibling" | "spouse";
  onSuccess: (person: Person) => void;
}

export function PersonForm({
  person,
  relatedPersonId,
  defaultRelationshipType,
  onSuccess,
}: PersonFormProps) {
  const { addPerson, updatePerson, addRelationship } = useFamilyTreeStore();
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [photos, setPhotos] = useState<MediaFile[]>(person?.photos || []);
  const [audios, setAudios] = useState<MediaFile[]>(person?.audios || []);
  const [audioUploadingIdx, setAudioUploadingIdx] = useState<number | null>(
    null
  );
  const audioInputRef = useState<HTMLInputElement | null>(null);

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<PersonFormValues>({
    resolver: zodResolver(personSchema),
    defaultValues: {
      firstName: person?.firstName || "",
      lastName: person?.lastName || "",
      nicknames: person?.nicknames?.join(", ") || "",
      gender: person?.gender || "male",
      birthDate: person?.birthDate || "",
      deathDate: person?.deathDate || "",
      cityOfOrigin: person?.cityOfOrigin || "",
      relationshipType: defaultRelationshipType,
      relatedPersonId: relatedPersonId || "",
    },
  });

  const genderValue = watch("gender");
  const relationshipType = watch("relationshipType");

  // Photo management
  const handleAddPhoto = async (file: File) => {
    if (photos.length >= 3) return;

    // Create local preview
    const localUrl = URL.createObjectURL(file);
    const tempMedia: MediaFile = {
      id: `temp_${Date.now()}`,
      url: localUrl,
      type: "photo",
      order: photos.length,
    };
    setPhotos((prev) => [...prev, tempMedia]);

    // If person exists, upload to server
    if (person?.id) {
      try {
        const result = await mediaApi.upload(person.id, "photo", file);
        setPhotos((prev) =>
          prev.map((p) =>
            p.id === tempMedia.id ? { ...p, id: result.id, url: result.url } : p
          )
        );
      } catch {
        // Keep local URL in demo mode
      }
    }
  };

  const handleRemovePhoto = async (id: string) => {
    setPhotos((prev) => prev.filter((p) => p.id !== id));
    if (person?.id && !id.startsWith("temp_")) {
      try {
        await mediaApi.delete(id);
      } catch {
        // ignore
      }
    }
  };

  // Audio management
  const handleAddAudio = async (file: File) => {
    if (audios.length >= 3) return;

    // Get duration via Audio element
    const getDuration = () =>
      new Promise<number>((resolve) => {
        const audio = new Audio(URL.createObjectURL(file));
        audio.onloadedmetadata = () => resolve(audio.duration);
        audio.onerror = () => resolve(0);
      });

    const duration = await getDuration();
    const localUrl = URL.createObjectURL(file);

    const tempMedia: MediaFile = {
      id: `temp_audio_${Date.now()}`,
      url: localUrl,
      type: "audio",
      duration,
      order: audios.length,
      name: file.name,
    };

    setAudios((prev) => [...prev, tempMedia]);

    if (person?.id) {
      try {
        const result = await mediaApi.upload(person.id, "audio", file);
        setAudios((prev) =>
          prev.map((a) =>
            a.id === tempMedia.id
              ? {
                  ...a,
                  id: result.id,
                  url: result.url,
                  duration: result.duration,
                }
              : a
          )
        );
      } catch {
        // Keep local in demo
      }
    }
  };

  const handleRemoveAudio = async (id: string) => {
    setAudios((prev) => prev.filter((a) => a.id !== id));
    if (person?.id && !id.startsWith("temp_")) {
      try {
        await mediaApi.delete(id);
      } catch {
        // ignore
      }
    }
  };

  const onSubmit = async (data: PersonFormValues) => {
    setIsSubmitting(true);
    try {
      const personData = {
        firstName: data.firstName,
        lastName: data.lastName,
        nicknames: data.nicknames
          ? data.nicknames
              .split(",")
              .map((s) => s.trim())
              .filter(Boolean)
          : [],
        gender: data.gender,
        birthDate: data.birthDate || undefined,
        deathDate: data.deathDate || undefined,
        cityOfOrigin: data.cityOfOrigin || undefined,
        photos,
        audios,
      };

      if (person?.id) {
        // Update existing
        try {
          const updated = await personsApi.update(person.id, personData);
          updatePerson(person.id, { ...updated, photos, audios });
          onSuccess({ ...person, ...personData, photos, audios });
        } catch {
          // Demo mode: update locally
          updatePerson(person.id, personData);
          onSuccess({ ...person, ...personData, photos, audios });
        }
        toast({
          title: "Personne mise à jour",
          description: `${data.firstName} ${data.lastName} a été mis(e) à jour.`,
        });
      } else {
        // Create new
        const newPersonData: Omit<Person, "id"> = {
          ...personData,
          generation: 0,
        };

        try {
          const created = await personsApi.create(newPersonData);
          addPerson(created);

          // Create relationship if specified
          if (data.relationshipType && data.relatedPersonId) {
            const relData = {
              personAId: data.relatedPersonId,
              personBId: created.id,
              type: data.relationshipType,
            };
            try {
              const rel = await relationshipsApi.create(relData);
              addRelationship(rel);
            } catch {
              addRelationship({ ...relData, id: `rel_${Date.now()}` });
            }
          }

          onSuccess(created);
        } catch {
          // Demo mode
          const demoId = `p_${Date.now()}`;
          const demoPerson: Person = { ...newPersonData, id: demoId };
          addPerson(demoPerson);

          if (data.relationshipType && data.relatedPersonId) {
            addRelationship({
              id: `rel_${Date.now()}`,
              personAId: data.relatedPersonId,
              personBId: demoId,
              type: data.relationshipType,
            });
          }

          onSuccess(demoPerson);
        }

        toast({
          title: "Membre ajouté",
          description: `${data.firstName} ${data.lastName} a été ajouté(e) à l'arbre.`,
        });
      }
    } catch (error) {
      toast({
        title: "Erreur",
        description: "Une erreur est survenue. Veuillez réessayer.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
      {/* Name fields */}
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="firstName">
            Prénom <span className="text-destructive">*</span>
          </Label>
          <Input
            id="firstName"
            placeholder="Kofi"
            {...register("firstName")}
            className={cn(errors.firstName && "border-destructive")}
          />
          {errors.firstName && (
            <p className="text-xs text-destructive">{errors.firstName.message}</p>
          )}
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="lastName">
            Nom <span className="text-destructive">*</span>
          </Label>
          <Input
            id="lastName"
            placeholder="Mensah"
            {...register("lastName")}
            className={cn(errors.lastName && "border-destructive")}
          />
          {errors.lastName && (
            <p className="text-xs text-destructive">{errors.lastName.message}</p>
          )}
        </div>
      </div>

      {/* Nicknames */}
      <div className="space-y-1.5">
        <Label htmlFor="nicknames">Surnom(s)</Label>
        <Input
          id="nicknames"
          placeholder="Grand-père, Papa Kofi, ..."
          {...register("nicknames")}
        />
        <p className="text-xs text-muted-foreground">
          Séparez plusieurs surnoms par des virgules
        </p>
      </div>

      {/* Gender */}
      <div className="space-y-1.5">
        <Label>
          Genre <span className="text-destructive">*</span>
        </Label>
        <div className="flex gap-2">
          {(["male", "female", "other"] as const).map((g) => (
            <button
              key={g}
              type="button"
              onClick={() => setValue("gender", g)}
              className={cn(
                "flex-1 py-2 rounded-lg border text-sm font-medium transition-colors",
                genderValue === g
                  ? "bg-primary text-primary-foreground border-primary"
                  : "border-border hover:bg-accent"
              )}
            >
              {g === "male" ? "Homme" : g === "female" ? "Femme" : "Autre"}
            </button>
          ))}
        </div>
      </div>

      {/* Dates */}
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="birthDate">Date de naissance</Label>
          <Input
            id="birthDate"
            type="date"
            {...register("birthDate")}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="deathDate">Date de décès</Label>
          <Input
            id="deathDate"
            type="date"
            {...register("deathDate")}
          />
        </div>
      </div>

      {/* City */}
      <div className="space-y-1.5">
        <Label htmlFor="cityOfOrigin">Ville d&apos;origine</Label>
        <Input
          id="cityOfOrigin"
          placeholder="Accra, Abidjan, Dakar..."
          {...register("cityOfOrigin")}
        />
      </div>

      {/* Relationship (only for new persons) */}
      {!person && (
        <div className="space-y-1.5">
          <Label>Relation avec un membre existant</Label>
          <Select
            value={relationshipType || ""}
            onValueChange={(v) =>
              setValue(
                "relationshipType",
                v as "parent" | "child" | "sibling" | "spouse"
              )
            }
          >
            <SelectTrigger>
              <SelectValue placeholder="Choisir une relation" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="parent">Parent de</SelectItem>
              <SelectItem value="child">Enfant de</SelectItem>
              <SelectItem value="sibling">Frère/Sœur de</SelectItem>
              <SelectItem value="spouse">Conjoint(e) de</SelectItem>
            </SelectContent>
          </Select>
        </div>
      )}

      {/* Photos */}
      <div className="space-y-2">
        <Label>Photos (max. 3)</Label>
        <PhotoUpload
          photos={photos}
          maxPhotos={3}
          onAdd={handleAddPhoto}
          onRemove={handleRemovePhoto}
        />
      </div>

      {/* Audio uploads */}
      <div className="space-y-2">
        <Label>Commentaires audio (max. 3)</Label>
        <div className="space-y-2">
          {audios.map((audio) => (
            <div key={audio.id} className="relative">
              <AudioPlayer audio={audio} compact />
              <button
                type="button"
                onClick={() => handleRemoveAudio(audio.id)}
                className="absolute top-1 right-1 p-1 bg-white border rounded-full hover:bg-destructive hover:text-destructive-foreground transition-colors"
              >
                <Trash2 className="w-3 h-3" />
              </button>
            </div>
          ))}

          {audios.length < 3 && (
            <label className="block">
              <input
                type="file"
                accept="audio/*"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleAddAudio(file);
                  e.target.value = "";
                }}
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="text-xs"
                onClick={(e) => {
                  e.preventDefault();
                  (e.currentTarget.previousElementSibling as HTMLInputElement)?.click();
                }}
              >
                <Upload className="w-3 h-3 mr-1.5" />
                Ajouter un audio
              </Button>
            </label>
          )}
          <p className="text-xs text-muted-foreground">
            {audios.length}/3 fichiers · MP3, WAV, M4A
          </p>
        </div>
      </div>

      {/* Submit */}
      <Button type="submit" className="w-full" disabled={isSubmitting}>
        {isSubmitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
        {person ? "Enregistrer les modifications" : "Ajouter à l'arbre"}
      </Button>
    </form>
  );
}
