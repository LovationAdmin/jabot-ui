import { Relationship } from "./types";

// Convention : type "parent" => personA EST PARENT DE personB.
//              type "child"  => personA EST ENFANT DE personB.
// On en déduit, pour chaque personne, l'ensemble de ses parents directs.

function buildParentsOf(relationships: Relationship[]): Map<string, Set<string>> {
  const parentsOf = new Map<string, Set<string>>();
  const add = (childId: string, parentId: string) => {
    if (!parentsOf.has(childId)) parentsOf.set(childId, new Set());
    parentsOf.get(childId)!.add(parentId);
  };
  for (const r of relationships) {
    if (r.type === "parent" || r.type === "step_parent") {
      add(r.personBId, r.personAId);
    } else if (r.type === "child" || r.type === "step_child") {
      add(r.personAId, r.personBId);
    }
  }
  return parentsOf;
}

/**
 * Tous les ascendants d'une personne (parents, grands-parents, …) en
 * remontant la chaîne parent→enfant. N'inclut PAS la personne elle-même.
 * Robuste aux cycles éventuels.
 */
export function ancestorsOf(personId: string, relationships: Relationship[]): Set<string> {
  const parentsOf = buildParentsOf(relationships);
  const result = new Set<string>();
  const stack = [...(parentsOf.get(personId) ?? [])];
  while (stack.length) {
    const cur = stack.pop()!;
    if (result.has(cur)) continue;
    result.add(cur);
    for (const p of parentsOf.get(cur) ?? []) {
      if (!result.has(p)) stack.push(p);
    }
  }
  return result;
}
