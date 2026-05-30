import { create } from "zustand";
import { persist } from "zustand/middleware";
import { Person, Relationship, AuthState, FamilyTree } from "./types";

// ─── Auth Store ──────────────────────────────────────────────────────────────

interface AuthStore extends AuthState {
  login: (token: string, userId: string, phone: string) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthStore>()(
  persist(
    (set) => ({
      isAuthenticated: false,
      userId: undefined,
      phone: undefined,
      token: undefined,

      login: (token, userId, phone) => {
        if (typeof window !== "undefined") {
          localStorage.setItem("jabot_token", token);
        }
        set({ isAuthenticated: true, token, userId, phone });
      },

      logout: () => {
        if (typeof window !== "undefined") {
          localStorage.removeItem("jabot_token");
        }
        set({ isAuthenticated: false, token: undefined, userId: undefined, phone: undefined });
      },
    }),
    {
      name: "jabot-auth",
      partialize: (state) => ({
        isAuthenticated: state.isAuthenticated,
        userId: state.userId,
        phone: state.phone,
        token: state.token,
      }),
    }
  )
);

// ─── Family Tree Store ────────────────────────────────────────────────────────

interface FamilyTreeStore {
  tree: FamilyTree;
  isLoading: boolean;
  error: string | null;
  selectedPersonId: string | null;
  editingPersonId: string | null;
  searchQuery: string;
  activeGenerationTab: string;

  setTree: (tree: FamilyTree) => void;
  addPerson: (person: Person) => void;
  updatePerson: (id: string, updates: Partial<Person>) => void;
  deletePerson: (id: string) => void;
  addRelationship: (rel: Relationship) => void;
  deleteRelationship: (id: string) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  setSelectedPerson: (id: string | null) => void;
  setEditingPerson: (id: string | null) => void;
  setSearchQuery: (q: string) => void;
  setActiveGenerationTab: (tab: string) => void;
  getPersonById: (id: string) => Person | undefined;
  getChildren: (personId: string) => Person[];
  getParents: (personId: string) => Person[];
  getSiblings: (personId: string) => Person[];
  getSpouse: (personId: string) => Person | undefined;
}

// Seed data for demo
const DEMO_PERSONS: Person[] = [
  {
    id: "p1",
    firstName: "Kofi",
    lastName: "Mensah",
    gender: "male",
    birthDate: "1940-03-15",
    deathDate: "2010-08-22",
    cityOfOrigin: "Accra",
    photos: [],
    audios: [],
    generation: -2,
    nicknames: ["Grand-papa"],
  },
  {
    id: "p2",
    firstName: "Ama",
    lastName: "Mensah",
    gender: "female",
    birthDate: "1943-07-01",
    cityOfOrigin: "Kumasi",
    photos: [],
    audios: [],
    generation: -2,
    nicknames: ["Grand-maman"],
  },
  {
    id: "p3",
    firstName: "Kwame",
    lastName: "Mensah",
    gender: "male",
    birthDate: "1968-11-10",
    cityOfOrigin: "Accra",
    photos: [],
    audios: [],
    generation: -1,
  },
  {
    id: "p4",
    firstName: "Abena",
    lastName: "Asante",
    gender: "female",
    birthDate: "1972-04-25",
    cityOfOrigin: "Abidjan",
    photos: [],
    audios: [],
    generation: -1,
  },
  {
    id: "p5",
    firstName: "Yaw",
    lastName: "Mensah",
    gender: "male",
    birthDate: "1995-06-12",
    cityOfOrigin: "Accra",
    photos: [],
    audios: [],
    generation: 0,
  },
  {
    id: "p6",
    firstName: "Akosua",
    lastName: "Mensah",
    gender: "female",
    birthDate: "1997-09-03",
    cityOfOrigin: "Accra",
    photos: [],
    audios: [],
    generation: 0,
  },
  {
    id: "p7",
    firstName: "Kojo",
    lastName: "Mensah",
    gender: "male",
    birthDate: "2000-01-17",
    cityOfOrigin: "Accra",
    photos: [],
    audios: [],
    generation: 0,
  },
];

const DEMO_RELATIONSHIPS: Relationship[] = [
  { id: "r1", personAId: "p1", personBId: "p3", type: "parent" },
  { id: "r2", personAId: "p2", personBId: "p3", type: "parent" },
  { id: "r3", personAId: "p1", personBId: "p2", type: "spouse" },
  { id: "r4", personAId: "p3", personBId: "p4", type: "spouse" },
  { id: "r5", personAId: "p3", personBId: "p5", type: "parent" },
  { id: "r6", personAId: "p3", personBId: "p6", type: "parent" },
  { id: "r7", personAId: "p3", personBId: "p7", type: "parent" },
  { id: "r8", personAId: "p4", personBId: "p5", type: "parent" },
  { id: "r9", personAId: "p4", personBId: "p6", type: "parent" },
  { id: "r10", personAId: "p4", personBId: "p7", type: "parent" },
  { id: "r11", personAId: "p5", personBId: "p6", type: "sibling" },
  { id: "r12", personAId: "p5", personBId: "p7", type: "sibling" },
  { id: "r13", personAId: "p6", personBId: "p7", type: "sibling" },
];

export const useFamilyTreeStore = create<FamilyTreeStore>((set, get) => ({
  tree: {
    persons: DEMO_PERSONS,
    relationships: DEMO_RELATIONSHIPS,
  },
  isLoading: false,
  error: null,
  selectedPersonId: null,
  editingPersonId: null,
  searchQuery: "",
  activeGenerationTab: "parents",

  setTree: (tree) => set({ tree }),

  addPerson: (person) =>
    set((state) => ({
      tree: {
        ...state.tree,
        persons: [...state.tree.persons, person],
      },
    })),

  updatePerson: (id, updates) =>
    set((state) => ({
      tree: {
        ...state.tree,
        persons: state.tree.persons.map((p) =>
          p.id === id ? { ...p, ...updates } : p
        ),
      },
    })),

  deletePerson: (id) =>
    set((state) => ({
      tree: {
        ...state.tree,
        persons: state.tree.persons.filter((p) => p.id !== id),
        relationships: state.tree.relationships.filter(
          (r) => r.personAId !== id && r.personBId !== id
        ),
      },
    })),

  addRelationship: (rel) =>
    set((state) => ({
      tree: {
        ...state.tree,
        relationships: [...state.tree.relationships, rel],
      },
    })),

  deleteRelationship: (id) =>
    set((state) => ({
      tree: {
        ...state.tree,
        relationships: state.tree.relationships.filter((r) => r.id !== id),
      },
    })),

  setLoading: (isLoading) => set({ isLoading }),
  setError: (error) => set({ error }),
  setSelectedPerson: (id) => set({ selectedPersonId: id }),
  setEditingPerson: (id) => set({ editingPersonId: id }),
  setSearchQuery: (q) => set({ searchQuery: q }),
  setActiveGenerationTab: (tab) => set({ activeGenerationTab: tab }),

  getPersonById: (id) => get().tree.persons.find((p) => p.id === id),

  getChildren: (personId) => {
    const { tree } = get();
    const childIds = tree.relationships
      .filter((r) => r.type === "parent" && r.personAId === personId)
      .map((r) => r.personBId);
    return tree.persons.filter((p) => childIds.includes(p.id));
  },

  getParents: (personId) => {
    const { tree } = get();
    const parentIds = tree.relationships
      .filter((r) => r.type === "parent" && r.personBId === personId)
      .map((r) => r.personAId);
    return tree.persons.filter((p) => parentIds.includes(p.id));
  },

  getSiblings: (personId) => {
    const { tree } = get();
    const siblingIds = tree.relationships
      .filter(
        (r) =>
          r.type === "sibling" &&
          (r.personAId === personId || r.personBId === personId)
      )
      .map((r) => (r.personAId === personId ? r.personBId : r.personAId));
    return tree.persons.filter((p) => siblingIds.includes(p.id));
  },

  getSpouse: (personId) => {
    const { tree } = get();
    const spouseRel = tree.relationships.find(
      (r) =>
        r.type === "spouse" &&
        (r.personAId === personId || r.personBId === personId)
    );
    if (!spouseRel) return undefined;
    const spouseId =
      spouseRel.personAId === personId
        ? spouseRel.personBId
        : spouseRel.personAId;
    return tree.persons.find((p) => p.id === spouseId);
  },
}));
