"use client";

import { useState, useMemo } from "react";
import { useFamilyTreeStore } from "@/lib/store";
import { Person } from "@/lib/types";
import { getInitials, isDeceased, formatDateShort } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import {
  Search,
  ChevronLeft,
  ChevronRight,
  Users,
  Baby,
  Heart,
  TreePine,
  User,
} from "lucide-react";
import { cn } from "@/lib/utils";
import Image from "next/image";

type TabKey =
  | "tous"
  | "grands-parents"
  | "arriere-grands-parents"
  | "parents"
  | "freres-soeurs"
  | "cousins"
  | "neveux-nieces";

const TABS: { key: TabKey; label: string; short: string; icon: React.ReactNode }[] = [
  { key: "tous", label: "Tous", short: "Tous", icon: <Users className="w-4 h-4" /> },
  {
    key: "arriere-grands-parents",
    label: "Arrière-grands-parents",
    short: "Arr.-grd-parents",
    icon: <TreePine className="w-4 h-4" />,
  },
  {
    key: "grands-parents",
    label: "Grands-parents",
    short: "Grd-parents",
    icon: <TreePine className="w-4 h-4" />,
  },
  {
    key: "parents",
    label: "Parents",
    short: "Parents",
    icon: <User className="w-4 h-4" />,
  },
  {
    key: "freres-soeurs",
    label: "Frères & Sœurs",
    short: "Frères/Sœurs",
    icon: <Heart className="w-4 h-4" />,
  },
  {
    key: "cousins",
    label: "Cousins",
    short: "Cousins",
    icon: <Users className="w-4 h-4" />,
  },
  {
    key: "neveux-nieces",
    label: "Neveux / Nièces",
    short: "Nev./Nièces",
    icon: <Baby className="w-4 h-4" />,
  },
];

// Generation mapping (relative to root person)
const GENERATION_TAB_MAP: Record<string, number[]> = {
  "arriere-grands-parents": [-3],
  "grands-parents": [-2],
  parents: [-1],
  "freres-soeurs": [0],
  cousins: [0], // same gen but different lineage
  "neveux-nieces": [1],
};

function PersonListItem({
  person,
  onClick,
}: {
  person: Person;
  onClick: () => void;
}) {
  const deceased = isDeceased(person);

  return (
    <button
      onClick={onClick}
      className="w-full flex items-center gap-3 p-2.5 rounded-lg hover:bg-accent transition-colors text-left group"
    >
      {/* Avatar */}
      <div
        className={cn(
          "w-10 h-10 rounded-full flex-shrink-0 overflow-hidden flex items-center justify-center text-sm font-bold",
          deceased
            ? "bg-gray-100 text-gray-400"
            : "bg-gradient-to-br from-amber-100 to-orange-200 text-primary"
        )}
      >
        {person.photos.length > 0 ? (
          <Image
            src={person.photos[0].url}
            alt={getInitials(person)}
            width={40}
            height={40}
            className="object-cover w-full h-full"
          />
        ) : (
          <span>{getInitials(person)}</span>
        )}
      </div>

      {/* Info */}
      <div className="min-w-0 flex-1">
        <p
          className={cn(
            "text-sm font-semibold truncate",
            deceased ? "text-gray-500" : "text-foreground"
          )}
        >
          {person.firstName}{" "}
          <span className={deceased ? "text-gray-500" : "text-primary"}>
            {person.lastName}
          </span>
        </p>
        {person.birthDate && (
          <p className="text-xs text-muted-foreground truncate">
            {formatDateShort(person.birthDate)}
            {person.deathDate && ` — ${formatDateShort(person.deathDate)}`}
          </p>
        )}
        {person.cityOfOrigin && (
          <p className="text-xs text-muted-foreground/70 truncate">
            {person.cityOfOrigin}
          </p>
        )}
      </div>

      {/* Audio indicator */}
      {person.audios.length > 0 && (
        <div className="w-2 h-2 rounded-full bg-primary flex-shrink-0" />
      )}
    </button>
  );
}

export function CanvasSidebar() {
  const { tree, setSelectedPerson, setActiveGenerationTab, activeGenerationTab } =
    useFamilyTreeStore();
  const [collapsed, setCollapsed] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState<TabKey>("tous");

  const filteredPersons = useMemo(() => {
    let persons = tree.persons;

    // Filter by tab (generation)
    if (activeTab !== "tous") {
      const gens = GENERATION_TAB_MAP[activeTab];
      if (gens) {
        persons = persons.filter((p) => {
          const gen = p.generation ?? 0;
          return gens.includes(gen);
        });
      }
    }

    // Filter by search
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      persons = persons.filter(
        (p) =>
          p.firstName.toLowerCase().includes(q) ||
          p.lastName.toLowerCase().includes(q) ||
          p.nicknames?.some((n) => n.toLowerCase().includes(q)) ||
          p.cityOfOrigin?.toLowerCase().includes(q)
      );
    }

    // Sort by generation then birth date
    return persons.sort((a, b) => {
      const genA = a.generation ?? 0;
      const genB = b.generation ?? 0;
      if (genA !== genB) return genA - genB;
      if (!a.birthDate) return 1;
      if (!b.birthDate) return -1;
      return new Date(a.birthDate).getTime() - new Date(b.birthDate).getTime();
    });
  }, [tree.persons, activeTab, searchQuery]);

  const handlePersonClick = (person: Person) => {
    setSelectedPerson(person.id);
  };

  const handleTabChange = (tab: TabKey) => {
    setActiveTab(tab);
    setActiveGenerationTab(tab);
  };

  if (collapsed) {
    return (
      <div className="h-full w-10 border-r bg-white flex flex-col items-center py-4 flex-shrink-0">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setCollapsed(false)}
          className="h-8 w-8"
        >
          <ChevronRight className="w-4 h-4" />
        </Button>
        <div className="mt-4 space-y-3">
          {TABS.slice(0, 5).map((tab) => (
            <div
              key={tab.key}
              title={tab.label}
              className={cn(
                "w-8 h-8 rounded-lg flex items-center justify-center cursor-pointer transition-colors",
                activeTab === tab.key
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-accent hover:text-foreground"
              )}
              onClick={() => {
                handleTabChange(tab.key);
                setCollapsed(false);
              }}
            >
              {tab.icon}
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="h-full w-[280px] border-r bg-white flex flex-col flex-shrink-0">
      {/* Header */}
      <div className="p-4 border-b flex items-center justify-between flex-shrink-0">
        <h2 className="font-semibold text-sm text-foreground">
          Membres ({tree.persons.length})
        </h2>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setCollapsed(true)}
          className="h-7 w-7"
        >
          <ChevronLeft className="w-4 h-4" />
        </Button>
      </div>

      {/* Search */}
      <div className="p-3 border-b flex-shrink-0">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Rechercher..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-8 h-8 text-sm"
          />
        </div>
      </div>

      {/* Generation tabs */}
      <div className="border-b flex-shrink-0">
        <ScrollArea className="w-full">
          <div className="flex p-2 gap-1">
            {TABS.map((tab) => (
              <button
                key={tab.key}
                onClick={() => handleTabChange(tab.key)}
                className={cn(
                  "flex-shrink-0 flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium transition-colors",
                  activeTab === tab.key
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-accent hover:text-foreground"
                )}
              >
                {tab.icon}
                <span className="hidden lg:block">{tab.short}</span>
              </button>
            ))}
          </div>
        </ScrollArea>
      </div>

      {/* Person list */}
      <ScrollArea className="flex-1">
        <div className="p-2 space-y-0.5">
          {filteredPersons.length > 0 ? (
            filteredPersons.map((person) => (
              <PersonListItem
                key={person.id}
                person={person}
                onClick={() => handlePersonClick(person)}
              />
            ))
          ) : (
            <div className="text-center py-8 text-muted-foreground text-sm">
              <Users className="w-8 h-8 mx-auto mb-2 opacity-40" />
              {searchQuery
                ? "Aucun résultat pour cette recherche"
                : "Aucun membre dans cette catégorie"}
            </div>
          )}
        </div>
      </ScrollArea>

      {/* Footer */}
      <div className="p-3 border-t flex-shrink-0">
        <p className="text-xs text-muted-foreground text-center">
          {filteredPersons.length} / {tree.persons.length} membres affichés
        </p>
      </div>
    </div>
  );
}
