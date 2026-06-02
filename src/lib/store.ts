import { create } from "zustand";
import { persist } from "zustand/middleware";
import { Person, Relationship, AuthState, FamilyTree, TreeAccess } from "./types";
import { treeApi, setActiveTreeId } from "./api";

// ─── Auth Store ────────────────────────────────────────────────────

interface AuthStore extends AuthState {
  personId?: string;
  firstName?: string;
  onboarded: boolean;
  // Multi-arbre : arbres accessibles + arbre actif courant.
  treeAccesses: TreeAccess[];
  activeTreeId?: string;
  login: (token: string, userId: string, phone: string, opts?: { personId?: string | null; onboarded?: boolean; firstName?: string }) => void;
  setOnboarded: (personId: string, firstName?: string) => void;
  setTreeAccesses: (accesses: TreeAccess[], activeTreeId?: string | null) => void;
  setActiveTree: (treeId: string) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthStore>()(
  persist(
    (set, get) => ({
      isAuthenticated: false,
      userId: undefined,
      phone: undefined,
      token: undefined,
      personId: undefined,
      firstName: undefined,
      onboarded: false,
      treeAccesses: [],
      activeTreeId: undefined,

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

      setTreeAccesses: (accesses, activeTreeId) => {
        // Conserve l'arbre actif courant s'il fait toujours partie des accès ;
        // sinon retombe sur celui fourni par le backend, sinon le premier.
        const current = get().activeTreeId;
        const ids = new Set(accesses.map((a) => a.treeId));
        const next =
          (current && ids.has(current) && current) ||
          (activeTreeId && ids.has(activeTreeId) && activeTreeId) ||
          accesses[0]?.treeId ||
          undefined;
        setActiveTreeId(next ?? null);
        set({ treeAccesses: accesses, activeTreeId: next });
      },

      setActiveTree: (treeId) => {
        setActiveTreeId(treeId);
        set({ activeTreeId: treeId });
      },

      logout: () => {
        if (typeof window !== "undefined") localStorage.removeItem("jabot_token");
        setActiveTreeId(null);
        set({ isAuthenticated: false, token: undefined, userId: undefined, phone: undefined, personId: undefined, firstName: undefined, onboarded: false, treeAccesses: [], activeTreeId: undefined });
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
        treeAccesses: state.treeAccesses,
        activeTreeId: state.activeTreeId,
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
  fitPending: boolean;

  loadTree: () => Promise<void>;
  addPerson: (person: Person) => void;
  updatePerson: (id: string, updates: Partial<Person>) => void;
  deletePerson: (id: string) => void;
  addRelationship: (rel: Relationship) => void;
  deleteRelationship: (id: string) => void;
  setSelectedPerson: (id: string | null) => void;
  getPersonById: (id: string) => Person | undefined;
  requestFitTree: () => void;
  clearFitPending: () => void;
}

export const useFamilyTreeStore = create<FamilyTreeStore>((set, get) => ({
  tree: { persons: [], relationships: [] },
  isLoading: false,
  isWakingServer: false,
  error: null,
  selectedPersonId: null,
  fitPending: false,

  // Charge l'arbre avec plusieurs tentatives + backoff. Le plan gratuit Render
  // met le serveur en veille après inactivité : un cold start prend 30-60s.
  // On réessaie donc au lieu d'afficher tout de suite une erreur.
  loadTree: async () => {
    // Délais courts : plan Standard Render, pas de cold start. Les retries
    // couvrent les erreurs transitoires réseau (déploiement en cours, etc.).
    const delays = [0, 1000, 3000, 8000, 15000]; // ~27s cumulés
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

  requestFitTree: () => set({ fitPending: true }),
  clearFitPending: () => set({ fitPending: false }),
}));
