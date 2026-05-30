"use client";

import { memo, useState } from "react";
import { Handle, Position, NodeProps } from "reactflow";
import Image from "next/image";
import { Volume2, Edit, ChevronLeft, ChevronRight } from "lucide-react";
import { PersonNodeData } from "@/lib/types";
import { formatDateShort, getInitials, isDeceased } from "@/lib/utils";
import { cn } from "@/lib/utils";

function PersonNodeComponent({ data }: NodeProps<PersonNodeData>) {
  const { person, isCurrentUser, onOpenDetail, onEdit, isAuthenticated } = data;
  const deceased = isDeceased(person);
  const [photoIdx, setPhotoIdx] = useState(0);
  const hasAudio = person.audios.length > 0;
  const hasPhotos = person.photos.length > 0;

  const handleClick = () => {
    onOpenDetail?.(person);
  };

  const handleEdit = (e: React.MouseEvent) => {
    e.stopPropagation();
    onEdit?.(person);
  };

  const handlePrevPhoto = (e: React.MouseEvent) => {
    e.stopPropagation();
    setPhotoIdx((i) => (i - 1 + person.photos.length) % person.photos.length);
  };

  const handleNextPhoto = (e: React.MouseEvent) => {
    e.stopPropagation();
    setPhotoIdx((i) => (i + 1) % person.photos.length);
  };

  return (
    <div
      onClick={handleClick}
      className={cn(
        "w-[200px] rounded-xl border-2 overflow-hidden cursor-pointer shadow-sm hover:shadow-md transition-all select-none",
        "bg-white",
        deceased && "opacity-80",
        isCurrentUser
          ? "border-primary shadow-primary/20 shadow-md"
          : "border-border hover:border-primary/40"
      )}
    >
      {/* Target handle (top) */}
      <Handle
        type="target"
        position={Position.Top}
        className="!w-3 !h-3 !bg-primary !border-2 !border-white"
      />

      {/* Photo area */}
      <div
        className={cn(
          "relative h-[120px] overflow-hidden",
          deceased
            ? "bg-gradient-to-b from-gray-200 to-gray-100"
            : "bg-gradient-to-b from-amber-100 to-orange-50"
        )}
      >
        {hasPhotos ? (
          <>
            <Image
              src={person.photos[photoIdx].url}
              alt={`${person.firstName} ${person.lastName}`}
              fill
              className="object-cover"
              sizes="200px"
            />
            {person.photos.length > 1 && (
              <>
                <button
                  onClick={handlePrevPhoto}
                  className="absolute left-1 top-1/2 -translate-y-1/2 bg-black/40 hover:bg-black/60 text-white rounded-full p-0.5 transition-colors"
                >
                  <ChevronLeft className="w-3 h-3" />
                </button>
                <button
                  onClick={handleNextPhoto}
                  className="absolute right-1 top-1/2 -translate-y-1/2 bg-black/40 hover:bg-black/60 text-white rounded-full p-0.5 transition-colors"
                >
                  <ChevronRight className="w-3 h-3" />
                </button>
                <div className="absolute bottom-1 left-1/2 -translate-x-1/2 flex gap-1">
                  {person.photos.map((_, i) => (
                    <div
                      key={i}
                      className={cn(
                        "w-1.5 h-1.5 rounded-full bg-white transition-opacity",
                        i === photoIdx ? "opacity-100" : "opacity-50"
                      )}
                    />
                  ))}
                </div>
              </>
            )}
          </>
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <span
              className={cn(
                "text-3xl font-bold",
                deceased ? "text-gray-400" : "text-primary/70"
              )}
            >
              {getInitials(person)}
            </span>
          </div>
        )}

        {/* Audio badge */}
        {hasAudio && (
          <div className="absolute top-2 right-2 bg-primary text-white rounded-full p-1 shadow-sm">
            <Volume2 className="w-3 h-3" />
          </div>
        )}

        {/* Deceased overlay */}
        {deceased && (
          <div className="absolute inset-0 bg-gray-900/10" />
        )}
      </div>

      {/* Info area */}
      <div className="p-3 space-y-1">
        <div className="flex items-start justify-between gap-1">
          <div className="min-w-0 flex-1">
            <p
              className={cn(
                "font-semibold text-sm leading-tight truncate",
                deceased ? "text-gray-500" : "text-foreground"
              )}
            >
              {person.firstName}
            </p>
            <p
              className={cn(
                "font-bold text-sm leading-tight truncate",
                deceased ? "text-gray-600" : "text-primary"
              )}
            >
              {person.lastName}
            </p>
          </div>
          {isAuthenticated && (
            <button
              onClick={handleEdit}
              className="flex-shrink-0 p-1 rounded hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
            >
              <Edit className="w-3 h-3" />
            </button>
          )}
        </div>

        {person.nicknames && person.nicknames.length > 0 && (
          <p className="text-xs text-muted-foreground italic truncate">
            &ldquo;{person.nicknames[0]}&rdquo;
          </p>
        )}

        {/* Dates */}
        <div className="space-y-0.5">
          {person.birthDate && (
            <p className="text-xs text-muted-foreground">
              <span className="text-green-600">●</span>{" "}
              {formatDateShort(person.birthDate)}
            </p>
          )}
          {person.deathDate && (
            <p className="text-xs text-muted-foreground">
              <span className="text-gray-400">†</span>{" "}
              {formatDateShort(person.deathDate)}
            </p>
          )}
        </div>

        {/* City */}
        {person.cityOfOrigin && (
          <p className="text-xs text-muted-foreground/70 truncate">
            📍 {person.cityOfOrigin}
          </p>
        )}

        {/* Current user badge */}
        {isCurrentUser && (
          <div className="mt-1.5 px-2 py-0.5 bg-primary/10 rounded-full">
            <p className="text-xs text-primary font-medium text-center">Vous</p>
          </div>
        )}
      </div>

      {/* Source handle (bottom) */}
      <Handle
        type="source"
        position={Position.Bottom}
        className="!w-3 !h-3 !bg-primary !border-2 !border-white"
      />
    </div>
  );
}

export const PersonNode = memo(PersonNodeComponent);
