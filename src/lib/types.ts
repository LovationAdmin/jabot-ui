export interface MediaFile {
  id: string;
  url: string;
  type: "photo" | "audio";
  duration?: number;
  order: number;
  name?: string;
  uploaderName?: string;
}

export interface Person {
  id: string;
  familyTreeId?: string;
  firstName: string;
  lastName: string;
  nicknames?: string[];
  gender: "male" | "female" | "other";
  birthDate?: string;
  deathDate?: string;
  cityOfOrigin?: string;
  photos: MediaFile[];
  audios: MediaFile[];
  position?: { x: number; y: number };
  generation?: number;
}

export interface Relationship {
  id: string;
  personAId: string;
  personBId: string;
  type: "parent" | "child" | "sibling" | "spouse"
      | "half_sibling" | "step_sibling" | "step_parent" | "step_child"
      | "grandparent" | "grandchild" | "uncle_aunt" | "nephew_niece" | "cousin"
      | "homonym";
}

export interface FamilyTree {
  persons: Person[];
  relationships: Relationship[];
}

export interface AuthState {
  isAuthenticated: boolean;
  userId?: string;
  phone?: string;
  token?: string;
}

export interface TreeAccess {
  treeId: string;
  treeName: string;
  role: "owner" | "member" | "visitor";
  createdAt?: string;
}

export interface SearchResult {
  person: Person;
  confidence: number;
  matchReasons: string[];
}

export interface MatchRelative {
  first_name: string;
  last_name?: string;
}

export interface OnboardMatch {
  tree_id: string;
  tree_name: string;
  person_id: string;
  first_name: string;
  last_name?: string;
  birth_date?: string;
  confidence: number;
  parents: MatchRelative[];
  siblings: MatchRelative[];
}

export interface CrossTreeMatchPair {
  sourcePersonId: string;
  sourceFirstName: string;
  sourceLastName?: string;
  targetPersonId: string;
  targetFirstName: string;
  targetLastName?: string;
  confidence: number;
  matchReasons: string[];
  matchStage: string;
}

export interface PersonFormData {
  firstName: string;
  lastName: string;
  nicknames?: string;
  gender: "male" | "female" | "other";
  birthDate?: string;
  deathDate?: string;
  cityOfOrigin?: string;
  relationshipType?: "parent" | "child" | "sibling" | "spouse";
  relatedPersonId?: string;
}
