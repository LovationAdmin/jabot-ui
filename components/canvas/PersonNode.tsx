"use client";

import { memo } from "react";
import { Handle, Position, NodeProps } from "reactflow";
import Image from "next/image";
import { Volume2, Check } from "lucide-react";
import { PersonNodeData } from "@/lib/types";
import { getInitials, isDeceased } from "@/lib/utils";
import { cn } from "@/lib/utils";

export const CARD_W = 240;
export const CARD_H = 76;

function yearOnly(dateStr?: string): string {
  if (!dateStr) return "";
  const y = new Date(dateStr).getFullYear();
  return Number.isNaN(y) ? "" : String(y);
}

function PersonNodeComponent({ data }: NodeProps<PersonNodeData>) {
  const { person, isCurrentUser, onOpenDetail, isAuthenticated } = data;
  const deceased = isDeceased(person);
  const hasAudio = person.audios.length > 0;
  const photo = person.photos[0];

  const birth = yearOnly(person.birthDate);
  const death = yearOnly(person.deathDate);
  const lifespan = birth ? `${birth}${death ? " — " + death : " — "}` : "";

  return (
    <div
      onClick={() => onOpenDetail?.(person)}
      style={{ width: CARD_W, height: CARD_H }}
      className={cn(
        "group absolute flex cursor-pointer select-none items-center gap-3 rounded-xl bg-card p-2.5 text-left",
        "ring-1 ring-border shadow-card",
        "transition-all duration-200 ease-out",
        "hover:-translate-y-0.5 hover:shadow-float",
        isCurrentUser
          ? "ring-2 ring-accent shadow-card-selected"
          : "hover:ring-accent/40",
        deceased && "opacity-75"
      )}
    >
      <Handle
        type="target"
        position={Position.Top}
        className="!-top-px !left-1/2 !-translate-x-1/2 !opacity-0"
      />

      {/* Selected / current-user check badge */}
      {isCurrentUser && (
        <span className="absolute -right-2 -top-2 grid size-5 place-items-center rounded-full bg-accent text-accent-foreground shadow-sm">
          <Check className="size-3" strokeWidth={3} />
        </span>
      )}

      {/* Audio badge */}
      {hasAudio && (
        <span className="absolute right-2 bottom-2 flex size-4 items-center justify-center rounded-full bg-accent text-accent-foreground">
          <Volume2 className="size-2.5" />
        </span>
      )}

      {/* Photo */}
      <div
        className={cn(
          "relative size-14 shrink-0 overflow-hidden rounded-lg",
          "ring-1 ring-border-subtle shadow-sm",
          deceased && "grayscale"
        )}
      >
        {photo ? (
          <Image
            src={photo.url}
            alt={`${person.firstName} ${person.lastName}`}
            fill
            className="object-cover"
            sizes="56px"
          />
        ) : (
          <div
            className={cn(
              "flex h-full w-full items-center justify-center text-base font-semibold",
              deceased
                ? "bg-muted text-muted-foreground"
                : "bg-secondary text-primary"
            )}
          >
            {getInitials(person)}
          </div>
        )}
      </div>

      {/* Info */}
      <div className="min-w-0 flex-1">
        <p className="truncate font-serif text-[17px] leading-tight text-card-foreground">
          {person.firstName}{" "}
          <span className={cn(deceased ? "text-muted-foreground" : "")}>
            {person.lastName}
          </span>
        </p>
        {person.nicknames && person.nicknames.length > 0 && (
          <p className="truncate text-[11px] italic text-muted-foreground">
            « {person.nicknames[0]} »
          </p>
        )}
        <p className="mt-0.5 truncate text-[11px] text-muted-foreground">
          {lifespan || (person.cityOfOrigin ?? "")}
        </p>
      </div>

      <Handle
        type="source"
        position={Position.Bottom}
        className="!-bottom-px !left-1/2 !-translate-x-1/2 !opacity-0"
      />
    </div>
  );
}

export const PersonNode = memo(PersonNodeComponent);
