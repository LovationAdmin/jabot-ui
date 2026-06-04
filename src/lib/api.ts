import axios from "axios";
import { FamilyTree, MediaFile, Person, Relationship, SearchResult, TreeAccess, OnboardMatch, CrossTreeMatchPair, CrossTreeMatch } from "./types";
import { apiBaseUrl } from "./config";
import { uploadToCloudinary, compressImage, CloudinarySignature } from "./cloudinaryUpload";

const apiClient = axios.create({
  baseURL: apiBaseUrl(),
  headers: { "Content-Type": "application/json" },
  // Sans timeout, une requête qui n'aboutit jamais (backend dont l'event loop
  // est bloqué) laisse le spinner tourner indéfiniment. Avec un timeout, l'appel
  // échoue proprement et la logique de retry/erreur peut s'enclencher.
  timeout: 20000,
});

apiClient.interceptors.request.use((config) => {
  if (typeof window !== "undefined") {
    const token = localStorage.getItem("jabot_token");
    if (token) config.headers.Authorization = `Bearer ${token}`;
    // Arbre actif (multi-tenant) : le backend scope les requêtes dessus.
    const activeTree = localStorage.getItem("jabot_active_tree");
    if (activeTree) config.headers["X-Tree-ID"] = activeTree;
  }
  return config;
});

/** Mémorise l'arbre actif pour l'intercepteur (et le WebSocket). */
export function setActiveTreeId(treeId: string | null | undefined): void {
  if (typeof window === "undefined") return;
  if (treeId) localStorage.setItem("jabot_active_tree", treeId);
  else localStorage.removeItem("jabot_active_tree");
}

export function getActiveTreeId(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("jabot_active_tree");
}

// ─── Backend shapes ─────────────────────────────────────────────────────

interface BackendMedia {
  id: string;
  type: "photo" | "audio";
  url: string;
  duration_seconds?: number | null;
  order_index?: number;
  uploader_name?: string | null;
}

interface PersonResponse {
  id: string;
  family_tree_id?: string | null;
  first_name: string;
  last_name?: string | null;
  nicknames?: string[] | null;
  gender?: "male" | "female" | "unknown" | null;
  birth_date?: string | null;
  death_date?: string | null;
  city_of_origin?: string | null;
  canvas_position?: { x: number; y: number; generation?: number } | null;
  media?: BackendMedia[] | null;
}

interface SearchMatchResponse {
  person: PersonResponse;
  confidence: number;
  match_reasons: string[];
}

interface TreeNode {
  id: string;
  position: { x: number; y: number };
  data: {
    id: string;
    first_name: string;
    last_name?: string | null;
    gender?: "male" | "female" | "unknown" | null;
    birth_date?: string | null;
    death_date?: string | null;
    generation?: number;
    media?: Array<{ id: string; type: "photo" | "audio"; url: string }>;
  };
}

interface TreeEdge {
  id: string;
  source: string;
  target: string;
  data: { relationship_type: "parent" | "child" | "sibling" | "spouse" };
}

// ─── Mappers ────────────────────────────────────────────────────────

function mapGender(g?: string | null): Person["gender"] {
  if (g === "male") return "male";
  if (g === "female") return "female";
  return "other";
}

function mapMedia(m: BackendMedia): MediaFile {
  return { id: m.id, url: m.url, type: m.type, duration: m.duration_seconds ?? undefined, order: m.order_index ?? 0, uploaderName: m.uploader_name ?? undefined };
}

export function mapPersonResponseToPerson(p: PersonResponse): Person {
  const media = p.media ?? [];
  return {
    id: p.id,
    familyTreeId: p.family_tree_id ?? undefined,
    firstName: p.first_name,
    lastName: p.last_name ?? "",
    nicknames: p.nicknames ?? [],
    gender: mapGender(p.gender),
    birthDate: p.birth_date ?? undefined,
    deathDate: p.death_date ?? undefined,
    cityOfOrigin: p.city_of_origin ?? undefined,
    photos: media.filter((m) => m.type === "photo").map(mapMedia),
    audios: media.filter((m) => m.type === "audio").map(mapMedia),
    generation: p.canvas_position?.generation,
    position: p.canvas_position ? { x: p.canvas_position.x, y: p.canvas_position.y } : undefined,
  };
}

export function mapPersonToCreateBody(person: Partial<Person>) {
  const body: Record<string, unknown> = { first_name: person.firstName ?? "" };
  if (person.lastName !== undefined) body.last_name = person.lastName;
  if (person.nicknames !== undefined) body.nicknames = person.nicknames;
  if (person.gender !== undefined) body.gender = person.gender === "other" ? "unknown" : person.gender;
  if (person.birthDate !== undefined) body.birth_date = person.birthDate;
  if (person.deathDate !== undefined) body.death_date = person.deathDate;
  if (person.cityOfOrigin !== undefined) body.city_of_origin = person.cityOfOrigin;
  return body;
}

// ─── Auth & Onboarding ─────────────────────────────────────────────

interface BackendTreeAccess {
  tree_id: string;
  tree_name: string;
  role: "owner" | "member" | "visitor";
  created_at?: string | null;
}

function mapTreeAccess(t: BackendTreeAccess): TreeAccess {
  return { treeId: t.tree_id, treeName: t.tree_name, role: t.role, createdAt: t.created_at ?? undefined };
}

export interface MeState {
  userId: string;
  phone: string;
  personId: string | null;
  onboarded: boolean;
  // Token réémis (session glissante) — à restocker pour repousser l'expiration.
  accessToken?: string;
  treeAccesses: TreeAccess[];
  activeTreeId: string | null;
}

export const authApi = {
  requestOtp: async (phone: string): Promise<{ message: string; devCode?: string }> => {
    const { data } = await apiClient.post<{ message: string; phone: string; dev_code?: string }>("/auth/request-otp", { phone });
    return { message: data.message, devCode: data.dev_code };
  },

  verifyOtp: async (
    phone: string,
    code: string,
  ): Promise<{ token: string; userId: string; phone: string; personId: string | null; onboarded: boolean; treeAccesses: TreeAccess[]; activeTreeId: string | null }> => {
    const { data } = await apiClient.post<{
      access_token: string;
      token_type: string;
      user_id: string;
      phone: string;
      person_id?: string | null;
      onboarded?: boolean;
      tree_accesses?: BackendTreeAccess[];
      active_tree_id?: string | null;
    }>("/auth/verify-otp", { phone, code });
    return {
      token: data.access_token,
      userId: data.user_id,
      phone: data.phone,
      personId: data.person_id ?? null,
      onboarded: data.onboarded ?? false,
      treeAccesses: (data.tree_accesses ?? []).map(mapTreeAccess),
      activeTreeId: data.active_tree_id ?? null,
    };
  },

  me: async (): Promise<MeState> => {
    const { data } = await apiClient.get<{ user_id: string; phone: string; person_id?: string | null; onboarded?: boolean; access_token?: string; tree_accesses?: BackendTreeAccess[]; active_tree_id?: string | null }>("/auth/me");
    return {
      userId: data.user_id, phone: data.phone, personId: data.person_id ?? null,
      onboarded: data.onboarded ?? false, accessToken: data.access_token,
      treeAccesses: (data.tree_accesses ?? []).map(mapTreeAccess),
      activeTreeId: data.active_tree_id ?? null,
    };
  },

  // « C'est moi » : rattache le compte a une fiche existante du canvas.
  linkPerson: async (personId: string, treeId?: string): Promise<MeState> => {
    const { data } = await apiClient.post<{ user_id: string; phone: string; person_id?: string | null; onboarded?: boolean; tree_accesses?: BackendTreeAccess[]; active_tree_id?: string | null }>("/auth/link-person", { person_id: personId, tree_id: treeId });
    return {
      userId: data.user_id, phone: data.phone, personId: data.person_id ?? null,
      onboarded: data.onboarded ?? false,
      treeAccesses: (data.tree_accesses ?? []).map(mapTreeAccess),
      activeTreeId: data.active_tree_id ?? null,
    };
  },

  // « Creer ma fiche » : cree la premiere fiche de l'utilisateur et la rattache.
  // treeId optionnel : si fourni, rejoint cet arbre ; sinon démarre un nouvel arbre.
  onboard: async (person: Partial<Person>, treeId?: string): Promise<Person> => {
    const url = treeId ? `/auth/onboard?tree_id=${encodeURIComponent(treeId)}` : "/auth/onboard";
    const { data } = await apiClient.post<PersonResponse>(url, mapPersonToCreateBody(person));
    return mapPersonResponseToPerson(data);
  },

  // Supprime le compte ; la fiche person reste intacte dans l'arbre.
  deleteAccount: async (): Promise<void> => {
    await apiClient.delete("/auth/me");
  },

  onboardSearch: async (params: {
    name?: string;
    nickname?: string;
    birth_date?: string;
    parent_names?: string[];
    sibling_names?: string[];
    city_of_origin?: string;
  }): Promise<OnboardMatch[]> => {
    const { data } = await apiClient.post<{ matches: OnboardMatch[] }>("/auth/onboard-search", params);
    return data.matches ?? [];
  },
};

// ─── Trees (multi-tenant) ──────────────────────────────────────────

export const treesApi = {
  list: async (): Promise<TreeAccess[]> => {
    const { data } = await apiClient.get<{ trees: BackendTreeAccess[] }>("/trees");
    return (data.trees ?? []).map(mapTreeAccess);
  },
  create: async (name?: string): Promise<TreeAccess> => {
    const { data } = await apiClient.post<BackendTreeAccess>("/trees", { name });
    return mapTreeAccess(data);
  },
  rename: async (treeId: string, name: string): Promise<TreeAccess> => {
    const { data } = await apiClient.patch<BackendTreeAccess>(`/trees/${treeId}`, { name });
    return mapTreeAccess(data);
  },
  remove: async (treeId: string): Promise<void> => {
    await apiClient.delete(`/trees/${treeId}`);
  },
  // Scan pré-convergence : détecte les fiches communes entre les deux arbres.
  preScan: async (
    targetTreeId: string,
    sourceTreeId: string,
  ): Promise<{ proposedPairs: CrossTreeMatchPair[]; unmatchedSourceCount: number }> => {
    const { data } = await apiClient.post<{
      proposed_pairs: Array<{
        source_person_id: string; source_first_name: string; source_last_name?: string;
        target_person_id: string; target_first_name: string; target_last_name?: string;
        confidence: number; match_reasons: string[]; match_stage: string;
      }>;
      unmatched_source_count: number;
    }>(`/trees/${targetTreeId}/pre-converge-scan`, { source_tree_id: sourceTreeId });
    return {
      proposedPairs: (data.proposed_pairs ?? []).map((p) => ({
        sourcePersonId: p.source_person_id,
        sourceFirstName: p.source_first_name,
        sourceLastName: p.source_last_name,
        targetPersonId: p.target_person_id,
        targetFirstName: p.target_first_name,
        targetLastName: p.target_last_name,
        confidence: p.confidence,
        matchReasons: p.match_reasons,
        matchStage: p.match_stage,
      })),
      unmatchedSourceCount: data.unmatched_source_count ?? 0,
    };
  },

  // Convergence : rapatrie l'arbre source (dont on est propriétaire) dans
  // l'arbre cible (où l'on a été invité), en fusionnant la fiche d'identité
  // et les paires supplémentaires confirmées par l'utilisateur.
  converge: async (
    targetTreeId: string,
    params: {
      sourceTreeId: string;
      sourcePersonId?: string;
      targetPersonId?: string;
      additionalMergePairs?: Array<{ sourcePersonId: string; targetPersonId: string }>;
    },
  ): Promise<{ personsMoved: number; identityMerged: boolean; additionalMerges: number }> => {
    const { data } = await apiClient.post<{
      persons_moved: number;
      identity_merged: boolean;
      additional_merges?: number;
    }>(
      `/trees/${targetTreeId}/converge`,
      {
        source_tree_id: params.sourceTreeId,
        source_person_id: params.sourcePersonId,
        target_person_id: params.targetPersonId,
        additional_merge_pairs: (params.additionalMergePairs ?? []).map((p) => ({
          source_person_id: p.sourcePersonId,
          target_person_id: p.targetPersonId,
        })),
      },
    );
    return {
      personsMoved: data.persons_moved,
      identityMerged: data.identity_merged,
      additionalMerges: data.additional_merges ?? 0,
    };
  },
};

// ─── Tree ────────────────────────────────────────────────────────

export const treeApi = {
  // Endpoint public — fonctionne avec ou sans token.
  getTree: async (): Promise<FamilyTree> => {
    const { data } = await apiClient.get<{ nodes: TreeNode[]; edges: TreeEdge[] }>("/tree");

    const persons: Person[] = data.nodes.map((n) => ({
      id: n.id,
      firstName: n.data.first_name,
      lastName: n.data.last_name ?? "",
      nicknames: [],
      gender: mapGender(n.data.gender),
      birthDate: n.data.birth_date ?? undefined,
      deathDate: n.data.death_date ?? undefined,
      cityOfOrigin: undefined,
      photos: (n.data.media ?? []).filter((m) => m.type === "photo").map((m) => ({ id: m.id, url: m.url, type: "photo" as const, order: 0 })),
      audios: [],
      generation: n.data.generation,
      position: n.position,
    }));

    const relationships: Relationship[] = data.edges.map((e) => ({
      id: e.id,
      personAId: e.source,
      personBId: e.target,
      type: e.data.relationship_type,
    }));

    return { persons, relationships };
  },
};

// ─── Persons ───────────────────────────────────────────────────

export interface PersonSearchRequest {
  name?: string;
  nickname?: string;
  birth_date?: string;
  parent_names?: string[];
  sibling_names?: string[];
  city_of_origin?: string;
}

export const personsApi = {
  getAll: async (): Promise<Person[]> => {
    const { data } = await apiClient.get<{ total: number; persons: PersonResponse[] }>("/persons", { params: { skip: 0, limit: 200 } });
    return data.persons.map(mapPersonResponseToPerson);
  },

  getOne: async (id: string): Promise<Person> => {
    const { data } = await apiClient.get<PersonResponse>(`/persons/${id}`);
    return mapPersonResponseToPerson(data);
  },

  create: async (person: Partial<Person>): Promise<Person> => {
    const { data } = await apiClient.post<PersonResponse>("/persons", mapPersonToCreateBody(person));
    return mapPersonResponseToPerson(data);
  },

  update: async (id: string, person: Partial<Person>): Promise<Person> => {
    const { data } = await apiClient.put<PersonResponse>(`/persons/${id}`, mapPersonToCreateBody(person));
    return mapPersonResponseToPerson(data);
  },

  delete: async (id: string): Promise<void> => {
    await apiClient.delete(`/persons/${id}`);
  },

  search: async (req: PersonSearchRequest): Promise<SearchResult[]> => {
    const { data } = await apiClient.post<SearchMatchResponse[]>("/persons/search", req);
    return data.map((m) => ({ person: mapPersonResponseToPerson(m.person), confidence: m.confidence, matchReasons: m.match_reasons }));
  },

  // Cherche dans tous les autres arbres des fiches similaires à cette personne.
  // À appeler après create ou update pour détecter les doublons cross-arbre.
  getCrossTreeSuggestions: async (personId: string): Promise<CrossTreeMatch[]> => {
    const { data } = await apiClient.get<{
      matches: Array<{
        tree_id: string; tree_name: string; person_id: string;
        first_name: string; last_name?: string | null;
        birth_date?: string | null; confidence: number; match_reasons: string[];
      }>;
    }>(`/persons/${personId}/cross-tree-suggestions`);
    return (data.matches ?? []).map((m) => ({
      treeId: m.tree_id,
      treeName: m.tree_name,
      personId: m.person_id,
      firstName: m.first_name,
      lastName: m.last_name ?? undefined,
      birthDate: m.birth_date ?? undefined,
      confidence: m.confidence,
      matchReasons: m.match_reasons,
    }));
  },
};

// ─── Relationships ───────────────────────────────────────────────

export const relationshipsApi = {
  create: async (rel: Omit<Relationship, "id">): Promise<Relationship> => {
    const { data } = await apiClient.post<{ id: string; person_a_id: string; person_b_id: string; type: Relationship["type"] }>("/tree/relationships", { person_a_id: rel.personAId, person_b_id: rel.personBId, type: rel.type });
    return { id: data.id, personAId: data.person_a_id, personBId: data.person_b_id, type: data.type };
  },

  delete: async (id: string): Promise<void> => {
    await apiClient.delete(`/tree/relationships/${id}`);
  },
};

// ─── Merge ───────────────────────────────────────────────────────

export const mergeApi = {
  // Fusionne source → target (target gagne sur les conflits, source supprimee).
  merge: async (sourcePersonId: string, targetPersonId: string): Promise<void> => {
    await apiClient.post("/tree/merge", { source_person_id: sourcePersonId, target_person_id: targetPersonId });
  },
};

// ─── Audit / Journal d'activité ──────────────────────────────────

export type AuditAction =
  | "create_person" | "update_person" | "delete_person"
  | "create_relationship" | "delete_relationship" | "merge_persons";

export interface AuditEntry {
  id: number;
  action: AuditAction | string;
  entityType: "person" | "relationship" | string;
  entityId: string;
  actorName: string | null;
  details: Record<string, unknown> | null;
  createdAt: string;
}

interface AuditEntryResponse {
  id: number;
  action: string;
  entity_type: string;
  entity_id: string;
  actor_name?: string | null;
  details?: Record<string, unknown> | null;
  created_at: string;
}

export const auditApi = {
  // Journal des créations / modifications / suppressions concernant l'arbre du user.
  myTree: async (): Promise<AuditEntry[]> => {
    const { data } = await apiClient.get<{ entries: AuditEntryResponse[] }>("/audit/my-tree");
    return (data.entries ?? []).map((e) => ({
      id: e.id,
      action: e.action,
      entityType: e.entity_type,
      entityId: e.entity_id,
      actorName: e.actor_name ?? null,
      details: e.details ?? null,
      createdAt: e.created_at,
    }));
  },
};

// ─── Media ───────────────────────────────────────────────────────

export const mediaApi = {
  upload: async (personId: string, mediaType: "photo" | "audio", file: File): Promise<MediaFile> => {
    const formData = new FormData();
    formData.append("person_id", personId);
    formData.append("media_type", mediaType);
    formData.append("file", file);
    // Upload (surtout audio jusqu'à 50 Mo sur mobile) : timeout généreux, le
    // défaut de 20s couperait les gros fichiers sur connexion lente.
    const { data } = await apiClient.post<BackendMedia>("/media/upload", formData, {
      headers: { "Content-Type": "multipart/form-data" },
      timeout: 120000,
    });
    return mapMedia(data);
  },

  /**
   * Upload DIRECT navigateur → Cloudinary (recommandé, surtout pour l'audio).
   * 1. demande une signature au backend (autorisation + quota),
   * 2. envoie le fichier directement à Cloudinary (chunké si volumineux),
   * 3. confirme au backend qui vérifie l'asset et enregistre les métadonnées.
   * `onProgress` reçoit une fraction 0–1.
   */
  uploadDirect: async (
    personId: string,
    mediaType: "photo" | "audio",
    file: File | Blob,
    onProgress?: (fraction: number) => void,
  ): Promise<MediaFile> => {
    const { data: sign } = await apiClient.post<CloudinarySignature>("/media/sign", {
      person_id: personId,
      media_type: mediaType,
    });
    // Compress photos before upload (reduces size by 70–90% on mobile shots)
    const payload = mediaType === "photo" && file instanceof File
      ? await compressImage(file)
      : file;
    const result = await uploadToCloudinary(payload, sign, onProgress);
    const { data } = await apiClient.post<BackendMedia>("/media", {
      person_id: personId,
      media_type: mediaType,
      public_id: result.public_id,
    });
    return mapMedia(data);
  },

  delete: async (mediaId: string): Promise<void> => {
    await apiClient.delete(`/media/${mediaId}`);
  },
};

// ─── Duplicates ───────────────────────────────────────────────────

export interface DuplicatePerson {
  id: string;
  first_name: string;
  last_name?: string | null;
  birth_date?: string | null;
  gender?: string | null;
}

export interface DuplicatePair {
  person_a: DuplicatePerson;
  person_b: DuplicatePerson;
  score: number;
  confidence: "high" | "medium";
}

export const duplicatesApi = {
  detect: async (): Promise<DuplicatePair[]> => {
    const { data } = await apiClient.get<{ duplicates: DuplicatePair[] }>("/tree/duplicates");
    return data.duplicates ?? [];
  },

  merge: async (sourceId: string, targetId: string): Promise<void> => {
    await apiClient.post("/tree/merge", { source_person_id: sourceId, target_person_id: targetId });
  },

  autoMerge: async (): Promise<{ count: number }> => {
    const { data } = await apiClient.post<{ count: number }>("/tree/auto-merge-duplicates");
    return data;
  },

  // Declare une paire comme "pas un doublon" — partage par tout l'arbre.
  ignore: async (personAId: string, personBId: string): Promise<void> => {
    await apiClient.post("/tree/duplicates/ignore", { person_a_id: personAId, person_b_id: personBId });
  },

  unignore: async (personAId: string, personBId: string): Promise<void> => {
    await apiClient.delete("/tree/duplicates/ignore", { data: { person_a_id: personAId, person_b_id: personBId } });
  },
};

// ─── Invitations ──────────────────────────────────────────────────

export const invitationsApi = {
  create: async (phone: string): Promise<{ invitation_id: string; token: string; dev_code?: string }> => {
    const { data } = await apiClient.post("/invitations/", { phone });
    return data;
  },
  validate: async (token: string, code: string): Promise<{ success: boolean; message: string; tree_id?: string }> => {
    const { data } = await apiClient.post("/invitations/validate", { token, code }, { withCredentials: true });
    return data;
  },
  check: async (): Promise<{ valid: boolean; reason: string; tree_id?: string }> => {
    const { data } = await apiClient.get("/invitations/check", { withCredentials: true });
    return data;
  },
  list: async (): Promise<{ id: string; status: string; sms_sent: boolean; expires_at: string; created_at: string; validated_at: string | null }[]> => {
    const { data } = await apiClient.get("/invitations/list");
    return data;
  },
};

// ─── Admin ────────────────────────────────────────────────────────

export const adminApi = {
  resetDb: async (secret: string): Promise<{ message: string }> => {
    const { data } = await apiClient.post<{ message: string }>(
      "/admin/reset-db",
      {},
      { headers: { "X-Reset-Secret": secret } },
    );
    return data;
  },
};

export default apiClient;
