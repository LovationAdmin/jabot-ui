import { create } from "zustand";
import { persist } from "zustand/middleware";
import { Person, Relationship, AuthState, FamilyTree } from "./types";
import { treeApi } from "./api";

// ─── Auth Store ────────────────────────────────────────────────────

interface AuthStore extends AuthState {
  personId?: string;
  firstName?: string;
  onboarded: boolean;
  login: (token: string, userId: string, phone: string, opts?: { personId?: string | null; onboarded?: boolean; firstName?: string }) => void;
  setOnboarded: (personId: string, firstName?: string) => void;
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
      firstName: undefined,
      onboarded: false,

      login: (token, userId, phone, opts) => {
        if (typeof window !== "undefined") localStorage.setItem("jabot_token", token);
        set({
          isAuthenticated: true,
          token,
          userId,
          phone,
          personId: opts?.personId ?? undefined,
          firstName: opts?.firstName ?? undefined,
          onboarded: opts?.onboarded ?? false,
        });
      },

      setOnboarded: (personId, firstName) => set({ personId, firstName, onboarded: true }),

      logout: () => {
        if (typeof window !== "undefined") localStorage.removeItem("jabot_token");
        set({ isAuthenticated: false, token: undefined, userId: undefined, phone: undefined, personId: undefined, firstName: undefined, onboarded: false });
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
        firstName: state.firstName,
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
  // true pendant les nouvelles tentatives : le serveur (plan gratuit) se réveille.
  isWakingServer: boolean;
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
  isWakingServer: false,
  error: null,
  selectedPersonId: null,

  // Charge l'arbre avec plusieurs tentatives + backoff. Le plan gratuit Render
  // met le serveur en veille après inactivité : un cold start prend 30-60s.
  // On réessaie donc au lieu d'afficher tout de suite une erreur.
  loadTree: async () => {
    // Délais allongés : Render free tier peut prendre jusqu'à 90s pour un cold start.
    const delays = [0, 5000, 10000, 20000, 40000]; // ~75s cumulés
    set({ isLoading: true, isWakingServer: false });

    for (let attempt = 0; attempt < delays.length; attempt++) {
      if (delays[attempt] > 0) {
        set({ isWakingServer: true });
        await new Promise((r) => setTimeout(r, delays[attempt]));
      }
      try {
        const result = await treeApi.getTree();
        set({ tree: result, error: null, isLoading: false, isWakingServer: false });
        return;
      } catch {
        // On continue d'essayer tant qu'il reste des tentatives.
      }
    }

    // Toutes les tentatives ont échoué : on conserve l'arbre déjà chargé s'il existe.
    set((s) => ({
      tree: s.tree.persons.length > 0 ? s.tree : { persons: [], relationships: [] },
      error: "unreachable",
      isLoading: false,
      isWakingServer: false,
    }));
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
