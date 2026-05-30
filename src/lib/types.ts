export interface MediaFile {
  id: string;
  url: string;
  type: "photo" | "audio";
  duration?: number;
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
  generation?: number;
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

export interface SearchResult {
  person: Person;
  confidence: number;
  matchReasons: string[];
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
