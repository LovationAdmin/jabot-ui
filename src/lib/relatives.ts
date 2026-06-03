import { FamilyTree, Person, Relationship } from "./types";

export interface RelativeRef {
  id: string;
  name: string;
}

export interface PersonContext {
  // Numero de generation normalise (1 = la plus ancienne presente dans l'arbre).
  generation?: number;
  parents: RelativeRef[];
  siblings: RelativeRef[];
  children: RelativeRef[];
  spouses: RelativeRef[];
}

const SIBLING_TYPES = new Set(["sibling", "half_sibling", "step_sibling"]);
const PARENT_TYPES = new Set(["parent", "step_parent"]);

function refName(p: Person): string {
  return `${p.firstName} ${p.lastName ?? ""}`.trim();
}

/**
 * Derive le contexte familial d'une personne (parents, fratrie, enfants,
 * conjoints, generation) a partir de l'arbre deja charge dans le store.
 * Aucun appel reseau : tout est calcule cote client.
 */
export function buildPersonContext(personId: string, tree: FamilyTree): PersonContext {
  const byId = new Map(tree.persons.map((p) => [p.id, p]));
  const self = byId.get(personId);

  const parents: RelativeRef[] = [];
  const siblings: RelativeRef[] = [];
  const children: RelativeRef[] = [];
  const spouses: RelativeRef[] = [];
  const seen = { parents: new Set<string>(), siblings: new Set<string>(), children: new Set<string>(), spouses: new Set<string>() };

  const push = (bucket: RelativeRef[], seenSet: Set<string>, otherId: string) => {
    if (seenSet.has(otherId)) return;
    const p = byId.get(otherId);
    if (!p) return;
    seenSet.add(otherId);
    bucket.push({ id: otherId, name: refName(p) });
  };

  for (const r of tree.relationships as Relationship[]) {
    const involvesSelf = r.personAId === personId || r.personBId === personId;
    if (!involvesSelf) continue;
    const otherId = r.personAId === personId ? r.personBId : r.personAId;

    if (PARENT_TYPES.has(r.type)) {
      // type "parent" : personA est le parent de personB.
      if (r.personBId === personId) push(parents, seen.parents, otherId);
      else push(children, seen.children, otherId);
    } else if (r.type === "child") {
      // direction inverse explicite.
      if (r.personBId === personId) push(children, seen.children, otherId);
      else push(parents, seen.parents, otherId);
    } else if (SIBLING_TYPES.has(r.type)) {
      push(siblings, seen.siblings, otherId);
    } else if (r.type === "spouse") {
      push(spouses, seen.spouses, otherId);
    }
  }

  // Generation normalisee : 1 = la generation la plus ancienne presente.
  let generation: number | undefined;
  if (self?.generation !== undefined) {
    const gens = tree.persons.map((p) => p.generation).filter((g): g is number => g !== undefined);
    const min = gens.length ? Math.min(...gens) : self.generation;
    generation = self.generation - min + 1;
  }

  return { generation, parents, siblings, children, spouses };
}
