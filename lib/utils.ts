import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";
import { Person, Relationship } from "./types";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDate(dateStr?: string): string {
  if (!dateStr) return "";
  try {
    const date = new Date(dateStr);
    return date.toLocaleDateString("fr-FR", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  } catch {
    return dateStr;
  }
}

export function formatDateShort(dateStr?: string): string {
  if (!dateStr) return "";
  try {
    const date = new Date(dateStr);
    return date.toLocaleDateString("fr-FR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  } catch {
    return dateStr;
  }
}

export function getAge(birthDate?: string, deathDate?: string): number | null {
  if (!birthDate) return null;
  const birth = new Date(birthDate);
  const end = deathDate ? new Date(deathDate) : new Date();
  const diff = end.getTime() - birth.getTime();
  return Math.floor(diff / (1000 * 60 * 60 * 24 * 365.25));
}

export function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export function getPersonFullName(person: Person): string {
  return `${person.firstName} ${person.lastName}`;
}

export function getPersonDisplayName(person: Person): string {
  const full = getPersonFullName(person);
  if (person.nicknames && person.nicknames.length > 0) {
    return `${full} "${person.nicknames[0]}"`;
  }
  return full;
}

export function getInitials(person: Person): string {
  return `${person.firstName.charAt(0)}${person.lastName.charAt(0)}`.toUpperCase();
}

export function isDeceased(person: Person): boolean {
  return !!person.deathDate;
}

export function buildGenerationMap(
  persons: Person[],
  relationships: Relationship[],
  rootPersonId: string
): Map<string, number> {
  const generationMap = new Map<string, number>();
  generationMap.set(rootPersonId, 0);

  const visited = new Set<string>();
  const queue: string[] = [rootPersonId];

  while (queue.length > 0) {
    const currentId = queue.shift()!;
    if (visited.has(currentId)) continue;
    visited.add(currentId);

    const currentGen = generationMap.get(currentId) ?? 0;

    // Find all relationships for this person
    const rels = relationships.filter(
      (r) => r.personAId === currentId || r.personBId === currentId
    );

    for (const rel of rels) {
      const otherId =
        rel.personAId === currentId ? rel.personBId : rel.personAId;
      if (generationMap.has(otherId)) continue;

      if (rel.type === "parent") {
        // If personA is parent of personB
        if (rel.personAId === currentId) {
          generationMap.set(otherId, currentGen + 1); // child is one generation below
        } else {
          generationMap.set(otherId, currentGen - 1); // parent is one generation above
        }
      } else if (rel.type === "child") {
        if (rel.personAId === currentId) {
          generationMap.set(otherId, currentGen - 1);
        } else {
          generationMap.set(otherId, currentGen + 1);
        }
      } else if (rel.type === "sibling") {
        generationMap.set(otherId, currentGen);
      } else if (rel.type === "spouse") {
        generationMap.set(otherId, currentGen);
      }

      queue.push(otherId);
    }
  }

  return generationMap;
}

export function computeTreeLayout(
  persons: Person[],
  relationships: Relationship[]
): Person[] {
  if (persons.length === 0) return persons;

  const NODE_WIDTH = 220;
  const NODE_HEIGHT = 280;
  const H_GAP = 40;
  const V_GAP = 80;

  // Group by generation
  const generationGroups = new Map<number, Person[]>();

  persons.forEach((p) => {
    const gen = p.generation ?? 0;
    if (!generationGroups.has(gen)) generationGroups.set(gen, []);
    generationGroups.get(gen)!.push(p);
  });

  // Sort generations
  const sortedGens = Array.from(generationGroups.keys()).sort((a, b) => a - b);
  const minGen = sortedGens[0] ?? 0;
  const maxGen = sortedGens[sortedGens.length - 1] ?? 0;

  const totalGenerations = maxGen - minGen + 1;
  const totalHeight = totalGenerations * (NODE_HEIGHT + V_GAP);

  return persons.map((person) => {
    const gen = person.generation ?? 0;
    const groupPersons = generationGroups.get(gen) ?? [];

    // Sort siblings by birth date within same generation
    groupPersons.sort((a, b) => {
      if (!a.birthDate && !b.birthDate) return 0;
      if (!a.birthDate) return 1;
      if (!b.birthDate) return -1;
      return new Date(a.birthDate).getTime() - new Date(b.birthDate).getTime();
    });

    const idx = groupPersons.findIndex((p) => p.id === person.id);
    const totalWidth = groupPersons.length * (NODE_WIDTH + H_GAP) - H_GAP;
    const startX = -totalWidth / 2;

    const genIndex = gen - minGen;
    const y = genIndex * (NODE_HEIGHT + V_GAP) - totalHeight / 2;
    const x = startX + idx * (NODE_WIDTH + H_GAP);

    return {
      ...person,
      position: person.position ?? { x, y },
    };
  });
}

export function phoneToInternational(phone: string, defaultCountry = "+225"): string {
  const cleaned = phone.replace(/\s+/g, "").replace(/-/g, "");
  if (cleaned.startsWith("+")) return cleaned;
  if (cleaned.startsWith("00")) return "+" + cleaned.slice(2);
  return defaultCountry + cleaned;
}
