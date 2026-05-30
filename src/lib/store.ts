import { create } from "zustand";
import { persist } from "zustand/middleware";
import { Person, Relationship, AuthState, FamilyTree } from "./types";
import { treeApi } from "./api";

// ─── Auth Store ────────────────────────────────────────────────────

interface AuthStore extends AuthState {
  personId?: string;
  onboarded: boolean;
  login: (token: string, userId: string, phone: string, opts?: { personId?: string | null; onboarded?: boolean }) => void;
  setOnboarded: (personId: string) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthStore>()(
  persist(
    (set) => ({
      isAuthenticated: false,
      userId: undefined,
      phone: undefined,
      token: undefined,
      personId: undefined,
      onboarded: false,

      login: (token, userId, phone, opts) => {
        if (typeof window !== "undefined") localStorage.setItem("jabot_token", token);
        set({
          isAuthenticated: true,
          token,
          userId,
          phone,
          personId: opts?.personId ?? undefined,
          onboarded: opts?.onboarded ?? false,
        });
      },

      setOnboarded: (personId) => set({ personId, onboarded: true }),

      logout: () => {
        if (typeof window !== "undefined") localStorage.removeItem("jabot_token");
        set({ isAuthenticated: false, token: undefined, userId: undefined, phone: undefined, personId: undefined, onboarded: false });
      },
    }),
    {
      name: "jabot-auth",
      partialize: (state) => ({
        isAuthenticated: state.isAuthenticated,
        userId: state.userId,
        phone: state.phone,
        token: state.token,
        personId: state.personId,
        onboarded: state.onboarded,
      }),
      skipHydration: true,
    },
  ),
);

// ─── Family Tree Store ─────────────────────────────────────────────

interface FamilyTreeStore {
  tree: FamilyTree;
  isLoading: boolean;
  error: string | null;
  selectedPersonId: string | null;

  loadTree: () => Promise<void>;
  addPerson: (person: Person) => void;
  updatePerson: (id: string, updates: Partial<Person>) => void;
  deletePerson: (id: string) => void;
  addRelationship: (rel: Relationship) => void;
  deleteRelationship: (id: string) => void;
  setSelectedPerson: (id: string | null) => void;
  getPersonById: (id: string) => Person | undefined;
}

export const useFamilyTreeStore = create<FamilyTreeStore>((set, get) => ({
  tree: { persons: [], relationships: [] },
  isLoading: false,
  error: null,
  selectedPersonId: null,

  loadTree: async () => {
    set({ isLoading: true });
    try {
      const result = await treeApi.getTree();
      set({ tree: result, error: null });
    } catch {
      set({ tree: { persons: [], relationships: [] }, error: "unreachable" });
    } finally {
      set({ isLoading: false });
    }
  },

  addPerson: (person) => set((s) => ({ tree: { ...s.tree, persons: [...s.tree.persons, person] } })),

  updatePerson: (id, updates) =>
    set((s) => ({ tree: { ...s.tree, persons: s.tree.persons.map((p) => (p.id === id ? { ...p, ...updates } : p)) } })),

  deletePerson: (id) =>
    set((s) => ({
      tree: {
        ...s.tree,
        persons: s.tree.persons.filter((p) => p.id !== id),
        relationships: s.tree.relationships.filter((r) => r.personAId !== id && r.personBId !== id),
      },
    })),

  addRelationship: (rel) => set((s) => ({ tree: { ...s.tree, relationships: [...s.tree.relationships, rel] } })),

  deleteRelationship: (id) => set((s) => ({ tree: { ...s.tree, relationships: s.tree.relationships.filter((r) => r.id !== id) } })),

  setSelectedPerson: (id) => set({ selectedPersonId: id }),

  getPersonById: (id) => get().tree.persons.find((p) => p.id === id),
}));
