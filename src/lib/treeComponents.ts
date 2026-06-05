import { Person, Relationship } from "./types";

export interface TreeComponent {
  /** ID stable = plus petit person.id (lexicographique) de la composante. */
  id: string;
  /** IDs de toutes les personnes de cette composante. */
  personIds: Set<string>;
  /** Nom par défaut = nom de famille de la personne avec la date de naissance
   *  la plus ancienne. Si aucune date connue : nom de famille le plus fréquent. */
  defaultName: string;
}

// ── Union-Find ────────────────────────────────────────────────────

function makeUF(ids: string[]): { find: (x: string) => string; union: (a: string, b: string) => void } {
  const parent = new Map<string, string>(ids.map((id) => [id, id]));
  const rank   = new Map<string, number>(ids.map((id) => [id, 0]));

  function find(x: string): string {
    if (parent.get(x) !== x) {
      parent.set(x, find(parent.get(x)!));
    }
    return parent.get(x)!;
  }

  function union(a: string, b: string) {
    const ra = find(a), rb = find(b);
    if (ra === rb) return;
    if ((rank.get(ra) ?? 0) < (rank.get(rb) ?? 0)) { parent.set(ra, rb); }
    else if ((rank.get(ra) ?? 0) > (rank.get(rb) ?? 0)) { parent.set(rb, ra); }
    else { parent.set(rb, ra); rank.set(ra, (rank.get(ra) ?? 0) + 1); }
  }

  return { find, union };
}

/** Calcule les composantes connexes de l'arbre. */
export function computeComponents(
  persons: Person[],
  relationships: Relationship[],
): TreeComponent[] {
  if (persons.length === 0) return [];

  const ids = persons.map((p) => p.id);
  const uf  = makeUF(ids);
  const idSet = new Set(ids);

  for (const r of relationships) {
    if (idSet.has(r.personAId) && idSet.has(r.personBId)) {
      uf.union(r.personAId, r.personBId);
    }
  }

  // Groupe par racine
  const byRoot = new Map<string, Person[]>();
  for (const p of persons) {
    const root = uf.find(p.id);
    if (!byRoot.has(root)) byRoot.set(root, []);
    byRoot.get(root)!.push(p);
  }

  const components: TreeComponent[] = [];
  for (const [, members] of byRoot) {
    // ID stable = plus petit id lexicographique
    const stableId = members.map((p) => p.id).sort()[0];

    const defaultName = _defaultName(members);
    components.push({
      id: stableId,
      personIds: new Set(members.map((p) => p.id)),
      defaultName,
    });
  }

  // Trie par taille décroissante (la plus grande composante en premier)
  components.sort((a, b) => b.personIds.size - a.personIds.size);
  return components;
}

/**
 * Returns the Set of personIds in the connected component containing personId.
 * Falls back to all persons if personId not found.
 */
export function computeDirectComponent(
  persons: Person[],
  relationships: Relationship[],
  personId: string,
): Set<string> {
  const comps = computeComponents(persons, relationships);
  const found = comps.find((c) => c.personIds.has(personId));
  return found?.personIds ?? new Set(persons.map((p) => p.id));
}

/**
 * Computes the tab label for a tree: two most common last names among
 * the oldest (root) generation — persons with no parent linked in this tree.
 */
export function computeTreeTabName(persons: Person[], relationships: Relationship[]): string {
  const hasParent = new Set(
    relationships.filter((r) => r.type === "parent").map((r) => r.personBId),
  );
  const rootGen = persons.filter((p) => !hasParent.has(p.id));
  const candidates = rootGen.length > 0 ? rootGen : persons;

  const freq = new Map<string, number>();
  for (const p of candidates) {
    const n = (p.lastName ?? "").trim();
    if (!n) continue;
    freq.set(n, (freq.get(n) ?? 0) + 1);
  }
  const sorted = [...freq.entries()].sort((a, b) => b[1] - a[1]);
  const top = [...new Set(sorted.map(([name]) => name))].slice(0, 3);
  return top.length === 0 ? "Arbre" : top.join("-");
}

// ── Nom par défaut ────────────────────────────────────────────────

function _defaultName(members: Person[]): string {
  // 1. Personne avec la date de naissance la plus ancienne
  let oldest: Person | null = null;
  for (const p of members) {
    if (!p.birthDate) continue;
    if (!oldest || p.birthDate < oldest.birthDate!) oldest = p;
  }
  if (oldest?.lastName?.trim()) return oldest.lastName.trim();
  if (oldest?.firstName?.trim()) return oldest.firstName.trim();

  // 2. Nom de famille le plus fréquent
  const freq = new Map<string, number>();
  for (const p of members) {
    const n = (p.lastName ?? "").trim();
    if (!n) continue;
    freq.set(n, (freq.get(n) ?? 0) + 1);
  }
  if (freq.size > 0) {
    return [...freq.entries()].sort((a, b) => b[1] - a[1])[0][0];
  }

  // 3. Fallback
  const first = members[0];
  return (first.firstName ?? first.id.slice(0, 6)).trim() || "Arbre";
}
