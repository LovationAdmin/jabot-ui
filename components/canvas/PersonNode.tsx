"use client";

import { memo } from "react";
import { Handle, Position, NodeProps } from "reactflow";
import Image from "next/image";
import { Volume2, Pencil, MapPin } from "lucide-react";
import { PersonNodeData } from "@/lib/types";
import { getInitials, isDeceased } from "@/lib/utils";
import { cn } from "@/lib/utils";

function yearOf(dateStr?: string): string {
  if (!dateStr) return "";
  const y = new Date(dateStr).getFullYear();
  return Number.isNaN(y) ? "" : String(y);
}

function PersonNodeComponent({ data }: NodeProps<PersonNodeData>) {
  const { person, isCurrentUser, onOpenDetail, onEdit, isAuthenticated } = data;
  const deceased = isDeceased(person);
  const hasAudio = person.audios.length > 0;
  const photo = person.photos[0];

  const birth = yearOf(person.birthDate);
  const death = yearOf(person.deathDate);
  const lifespan = birth || death ? `${birth || "?"}${death ? " – " + death : ""}` : "";

  const handleClick = () => onOpenDetail?.(person);
  const handleEdit = (e: React.MouseEvent) => {
    e.stopPropagation();
    onEdit?.(person);
  };

  return (
    <div
      onClick={handleClick}
      className={cn(
        "group/card relative w-[164px] cursor-pointer select-none rounded-2xl border bg-card px-3 pb-3 pt-4",
        "shadow-[0_1px_2px_rgba(16,24,40,0.04),0_4px_16px_-4px_rgba(16,24,40,0.08)]",
        "transition-all duration-200 ease-out",
        "hover:-translate-y-0.5 hover:shadow-[0_2px_4px_rgba(16,24,40,0.06),0_12px_28px_-6px_rgba(16,24,40,0.16)]",
        isCurrentUser
          ? "border-primary/40 ring-2 ring-primary/30"
          : "border-border hover:border-primary/30",
        deceased && "bg-muted/30"
      )}
    >
      <Handle
        type="target"
        position={Position.Top}
        className="!top-0 !left-1/2 !-translate-x-1/2"
      />

      {/* Avatar */}
      <div className="flex justify-center">
        <div
          className={cn(
            "relative h-16 w-16 overflow-hidden rounded-full ring-4 ring-white",
            "shadow-[0_2px_8px_rgba(16,24,40,0.12)]",
            deceased && "grayscale"
          )}
        >
          {photo ? (
            <Image
              src={photo.url}
              alt={`${person.firstName} ${person.lastName}`}
              fill
              className="object-cover"
              sizes="64px"
            />
          ) : (
            <div
              className={cn(
                "flex h-full w-full items-center justify-center text-lg font-semibold",
                deceased
                  ? "bg-muted text-muted-foreground"
                  : "bg-gradient-to-br from-primary/15 to-primary/5 text-primary"
              )}
            >
              {getInitials(person)}
            </div>
          )}
        </div>

        {/* Audio badge */}
        {hasAudio && (
          <div className="absolute right-6 top-2 flex h-5 w-5 items-center justify-center rounded-full bg-primary text-white shadow-sm ring-2 ring-white">
            <Volume2 className="h-2.5 w-2.5" />
          </div>
        )}

        {/* Deceased marker */}
        {deceased && (
          <div className="absolute left-6 top-2 flex h-5 w-5 items-center justify-center rounded-full bg-muted text-muted-foreground ring-2 ring-white">
            <span className="text-[11px] leading-none">†</span>
          </div>
        )}
      </div>

      {/* Name */}
      <div className="mt-2.5 text-center">
        <p
          className={cn(
            "truncate text-[13px] font-semibold leading-tight",
            deceased ? "text-muted-foreground" : "text-foreground"
          )}
        >
          {person.firstName}
        </p>
        <p
          className={cn(
            "truncate text-[13px] font-semibold leading-tight",
            deceased ? "text-muted-foreground" : "text-primary"
          )}
        >
          {person.lastName}
        </p>
        {person.nicknames && person.nicknames.length > 0 && (
          <p className="mt-0.5 truncate text-[11px] italic text-muted-foreground">
            « {person.nicknames[0]} »
          </p>
        )}
      </div>

      {/* Meta */}
      <div className="mt-1.5 space-y-0.5 text-center">
        {lifespan && (
          <p className="text-[11px] font-medium text-muted-foreground">{lifespan}</p>
        )}
        {person.cityOfOrigin && (
          <p className="flex items-center justify-center gap-0.5 truncate text-[11px] text-muted-foreground/80">
            <MapPin className="h-2.5 w-2.5 shrink-0" />
            <span className="truncate">{person.cityOfOrigin}</span>
          </p>
        )}
      </div>

      {isCurrentUser && (
        <div className="mx-auto mt-2 w-fit rounded-full bg-primary/10 px-2 py-0.5">
          <p className="text-[10px] font-semibold text-primary">Vous</p>
        </div>
      )}

      {/* Edit button (hover, auth only) */}
      {isAuthenticated && (
        <button
          onClick={handleEdit}
          className={cn(
            "absolute right-2 top-2 flex h-6 w-6 items-center justify-center rounded-lg",
            "bg-white/90 text-muted-foreground shadow-sm ring-1 ring-border",
            "opacity-0 transition-all duration-150 hover:bg-accent hover:text-primary",
            "group-hover/card:opacity-100"
          )}
          aria-label="Modifier"
        >
          <Pencil className="h-3 w-3" />
        </button>
      )}

      <Handle
        type="source"
        position={Position.Bottom}
        className="!bottom-0 !left-1/2 !-translate-x-1/2"
      />
    </div>
  );
}

export const PersonNode = memo(PersonNodeComponent);
