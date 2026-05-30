import { create } from "zustand";
import { persist } from "zustand/middleware";
import { Person, Relationship, AuthState, FamilyTree } from "./types";
import { treeApi } from "./api";

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
  loadTree: () => Promise<void>;
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

export const useFamilyTreeStore = create<FamilyTreeStore>((set, get) => ({
  tree: {
    persons: [],
    relationships: [],
  },
  isLoading: false,
  error: null,
  selectedPersonId: null,
  editingPersonId: null,
  searchQuery: "",
  activeGenerationTab: "parents",

  setTree: (tree) => set({ tree }),

  loadTree: async () => {
    set({ isLoading: true });
    try {
      // Always reflect the real database — even when it is empty.
      const result = await treeApi.getTree();
      set({ tree: result, error: null });
    } catch {
      // API unreachable: show an empty canvas (no fictitious data).
      set({ tree: { persons: [], relationships: [] }, error: "unreachable" });
    } finally {
      set({ isLoading: false });
    }
  },

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
