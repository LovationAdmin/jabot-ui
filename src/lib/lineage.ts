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

function buildChildrenOf(relationships: Relationship[]): Map<string, Set<string>> {
  const childrenOf = new Map<string, Set<string>>();
  const add = (parentId: string, childId: string) => {
    if (!childrenOf.has(parentId)) childrenOf.set(parentId, new Set());
    childrenOf.get(parentId)!.add(childId);
  };
  for (const r of relationships) {
    if (r.type === "parent" || r.type === "step_parent") {
      add(r.personAId, r.personBId);
    } else if (r.type === "child" || r.type === "step_child") {
      add(r.personBId, r.personAId);
    }
  }
  return childrenOf;
}

/**
 * Tous les descendants d'une personne (enfants, petits-enfants, …) en
 * descendant la chaîne parent→enfant. N'inclut PAS la personne elle-même.
 * Robuste aux cycles éventuels.
 */
export function descendantsOf(personId: string, relationships: Relationship[]): Set<string> {
  const childrenOf = buildChildrenOf(relationships);
  const result = new Set<string>();
  const stack = [...(childrenOf.get(personId) ?? [])];
  while (stack.length) {
    const cur = stack.pop()!;
    if (result.has(cur)) continue;
    result.add(cur);
    for (const c of childrenOf.get(cur) ?? []) {
      if (!result.has(c)) stack.push(c);
    }
  }
  return result;
}
