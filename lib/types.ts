export interface MediaFile {
  id: string;
  url: string;
  type: "photo" | "audio";
  duration?: number; // for audio in seconds
  order: number;
  name?: string;
}

export interface Person {
  id: string;
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
  generation?: number; // 0 = current, -1 = parents, -2 = grandparents, 1 = children
}

export interface Relationship {
  id: string;
  personAId: string;
  personBId: string;
  type: "parent" | "child" | "sibling" | "spouse";
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

export interface OnboardingData {
  step: number;
  self?: {
    firstName: string;
    lastName: string;
    nickname?: string;
    gender: "male" | "female" | "other";
    birthDate?: string;
  };
  father?: {
    firstName: string;
    lastName: string;
    nickname?: string;
  };
  mother?: {
    firstName: string;
    lastName: string;
    nickname?: string;
  };
  isOnlyChild?: boolean;
  siblings?: Array<{
    firstName: string;
    lastName: string;
    nickname?: string;
  }>;
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

export interface SearchResult {
  person: Person;
  confidence: number;
  matchReasons: string[];
}

// React Flow types
export interface PersonNodeData {
  person: Person;
  isCurrentUser?: boolean;
  isDeceased?: boolean;
  onOpenDetail?: (person: Person) => void;
  onEdit?: (person: Person) => void;
  isAuthenticated?: boolean;
}

export type GenerationLabel =
  | "grands-parents"
  | "arriere-grands-parents"
  | "parents"
  | "freres-soeurs"
  | "cousins"
  | "neveux-nieces";
