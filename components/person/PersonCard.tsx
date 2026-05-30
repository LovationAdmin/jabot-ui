"use client";

import { Person } from "@/lib/types";
import { getInitials, isDeceased, formatDateShort } from "@/lib/utils";
import { Volume2, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import Image from "next/image";
import Link from "next/link";

interface PersonCardProps {
  person: Person;
  compact?: boolean;
  isCurrentUser?: boolean;
  onClick?: () => void;
}

export function PersonCard({
  person,
  compact = false,
  isCurrentUser = false,
  onClick,
}: PersonCardProps) {
  const deceased = isDeceased(person);
  const hasAudio = person.audios.length > 0;

  const content = (
    <div
      className={cn(
        "flex items-center gap-3 p-3 rounded-xl border transition-all cursor-pointer",
        "hover:shadow-sm hover:border-primary/40",
        isCurrentUser && "border-primary/60 bg-primary/5",
        deceased ? "bg-gray-50" : "bg-white",
        compact ? "p-2 rounded-lg" : ""
      )}
      onClick={onClick}
    >
      {/* Avatar */}
      <div
        className={cn(
          "rounded-full overflow-hidden flex-shrink-0 flex items-center justify-center font-bold",
          compact ? "w-9 h-9 text-xs" : "w-12 h-12 text-sm",
          deceased
            ? "bg-gray-100 text-gray-400"
            : "bg-secondary text-primary"
        )}
      >
        {person.photos.length > 0 ? (
          <Image
            src={person.photos[0].url}
            alt={`${person.firstName} ${person.lastName}`}
            width={compact ? 36 : 48}
            height={compact ? 36 : 48}
            className="w-full h-full object-cover"
          />
        ) : (
          <span>{getInitials(person)}</span>
        )}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <p
            className={cn(
              "font-semibold truncate",
              compact ? "text-sm" : "text-base",
              deceased ? "text-gray-600" : "text-foreground"
            )}
          >
            {person.firstName}{" "}
            <span className={deceased ? "text-gray-500" : "text-primary"}>
              {person.lastName}
            </span>
          </p>
          {hasAudio && (
            <Volume2 className="w-3 h-3 text-primary flex-shrink-0" />
          )}
          {isCurrentUser && (
            <span className="text-xs bg-primary text-primary-foreground px-1.5 py-0.5 rounded-full flex-shrink-0">
              Vous
            </span>
          )}
        </div>

        {person.nicknames && person.nicknames.length > 0 && !compact && (
          <p className="text-xs text-muted-foreground italic truncate">
            &ldquo;{person.nicknames.join(", ")}&rdquo;
          </p>
        )}

        <div className="flex items-center gap-2 mt-0.5">
          {person.birthDate && (
            <p className="text-xs text-muted-foreground">
              {formatDateShort(person.birthDate)}
              {person.deathDate && ` — ${formatDateShort(person.deathDate)}`}
            </p>
          )}
          {person.cityOfOrigin && (
            <p className="text-xs text-muted-foreground/60 truncate">
              · {person.cityOfOrigin}
            </p>
          )}
        </div>
      </div>

      <ChevronRight className="w-4 h-4 text-muted-foreground/50 flex-shrink-0" />
    </div>
  );

  if (onClick) {
    return content;
  }

  return <Link href={`/person/${person.id}`}>{content}</Link>;
}
