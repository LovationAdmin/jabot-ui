import axios from "axios";
import { FamilyTree, MediaFile, Person, Relationship, SearchResult } from "./types";

const apiClient = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api",
  headers: {
    "Content-Type": "application/json",
  },
});

// Attach auth token if present
apiClient.interceptors.request.use((config) => {
  if (typeof window !== "undefined") {
    const token = localStorage.getItem("jabot_token");
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
  }
  return config;
});

// ─── Backend (snake_case) shapes ────────────────────────────────────────────

interface BackendMedia {
  id: string;
  type: "photo" | "audio";
  url: string;
  duration_seconds?: number | null;
  order_index?: number;
}

interface PersonResponse {
  id: string;
  first_name: string;
  last_name?: string | null;
  nicknames?: string[] | null;
  gender?: "male" | "female" | "unknown" | null;
  birth_date?: string | null;
  death_date?: string | null;
  city_of_origin?: string | null;
  created_at?: string;
  updated_at?: string;
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

// ─── Mapping helpers ─────────────────────────────────────────────────────────

function mapGender(g?: string | null): Person["gender"] {
  if (g === "male") return "male";
  if (g === "female") return "female";
  return "other";
}

function mapMedia(m: BackendMedia): MediaFile {
  return {
    id: m.id,
    url: m.url,
    type: m.type,
    duration: m.duration_seconds ?? undefined,
    order: m.order_index ?? 0,
  };
}

export function mapPersonResponseToPerson(p: PersonResponse): Person {
  const media = p.media ?? [];
  return {
    id: p.id,
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
    position: p.canvas_position
      ? { x: p.canvas_position.x, y: p.canvas_position.y }
      : undefined,
  };
}

interface PersonCreateBody {
  first_name: string;
  last_name?: string;
  nicknames?: string[];
  gender?: "male" | "female" | "unknown";
  birth_date?: string;
  death_date?: string;
  city_of_origin?: string;
}

export function mapPersonToCreateBody(
  person: Partial<Person>
): PersonCreateBody {
  const body: PersonCreateBody = {
    first_name: person.firstName ?? "",
  };
  if (person.lastName !== undefined) body.last_name = person.lastName;
  if (person.nicknames !== undefined) body.nicknames = person.nicknames;
  if (person.gender !== undefined) {
    body.gender = person.gender === "other" ? "unknown" : person.gender;
  }
  if (person.birthDate !== undefined) body.birth_date = person.birthDate;
  if (person.deathDate !== undefined) body.death_date = person.deathDate;
  if (person.cityOfOrigin !== undefined)
    body.city_of_origin = person.cityOfOrigin;
  return body;
}

// ─── Auth ────────────────────────────────────────────────────────────────────

export const authApi = {
  requestOtp: async (
    phone: string
  ): Promise<{ message: string; devCode?: string }> => {
    const { data } = await apiClient.post<{
      message: string;
      phone: string;
      dev_code?: string;
    }>("/auth/request-otp", { phone });
    return { message: data.message, devCode: data.dev_code };
  },

  verifyOtp: async (
    phone: string,
    code: string
  ): Promise<{ token: string; userId: string; phone: string }> => {
    const { data } = await apiClient.post<{
      access_token: string;
      token_type: string;
      user_id: string;
      phone: string;
    }>("/auth/verify-otp", { phone, code });
    return { token: data.access_token, userId: data.user_id, phone: data.phone };
  },
};

// ─── Tree (public) ─────────────────────────────────────────────────────────────

export const treeApi = {
  getTree: async (): Promise<FamilyTree> => {
    const { data } = await apiClient.get<{
      nodes: TreeNode[];
      edges: TreeEdge[];
    }>("/tree");

    const persons: Person[] = data.nodes.map((n) => ({
      id: n.id,
      firstName: n.data.first_name,
      lastName: n.data.last_name ?? "",
      nicknames: [],
      gender: mapGender(n.data.gender),
      birthDate: n.data.birth_date ?? undefined,
      deathDate: n.data.death_date ?? undefined,
      cityOfOrigin: undefined,
      photos: (n.data.media ?? [])
        .filter((m) => m.type === "photo")
        .map((m) => ({ id: m.id, url: m.url, type: "photo" as const, order: 0 })),
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

// ─── Persons ───────────────────────────────────────────────────────────────────

export interface PersonSearchRequest {
  name?: string;
  nickname?: string;
  parent_names?: string[];
  sibling_names?: string[];
  city_of_origin?: string;
}

export const personsApi = {
  getAll: async (): Promise<Person[]> => {
    const { data } = await apiClient.get<{
      total: number;
      persons: PersonResponse[];
    }>("/persons", { params: { skip: 0, limit: 200 } });
    return data.persons.map(mapPersonResponseToPerson);
  },

  getById: async (id: string): Promise<Person> => {
    const { data } = await apiClient.get<PersonResponse>(`/persons/${id}`);
    return mapPersonResponseToPerson(data);
  },

  create: async (person: Partial<Person>): Promise<Person> => {
    const { data } = await apiClient.post<PersonResponse>(
      "/persons",
      mapPersonToCreateBody(person)
    );
    return mapPersonResponseToPerson(data);
  },

  update: async (id: string, person: Partial<Person>): Promise<Person> => {
    const { data } = await apiClient.put<PersonResponse>(
      `/persons/${id}`,
      mapPersonToCreateBody(person)
    );
    return mapPersonResponseToPerson(data);
  },

  delete: async (id: string): Promise<void> => {
    await apiClient.delete(`/persons/${id}`);
  },

  search: async (
    searchRequest: PersonSearchRequest
  ): Promise<SearchResult[]> => {
    const { data } = await apiClient.post<SearchMatchResponse[]>(
      "/persons/search",
      searchRequest
    );
    return data.map((m) => ({
      person: mapPersonResponseToPerson(m.person),
      confidence: m.confidence,
      matchReasons: m.match_reasons,
    }));
  },
};

// ─── Relationships ──────────────────────────────────────────────────────────────

export const relationshipsApi = {
  create: async (
    relationship: Omit<Relationship, "id">
  ): Promise<Relationship> => {
    const { data } = await apiClient.post<{
      id: string;
      person_a_id: string;
      person_b_id: string;
      type: Relationship["type"];
    }>("/tree/relationships", {
      person_a_id: relationship.personAId,
      person_b_id: relationship.personBId,
      type: relationship.type,
    });
    return {
      id: data.id,
      personAId: data.person_a_id,
      personBId: data.person_b_id,
      type: data.type,
    };
  },

  delete: async (id: string): Promise<void> => {
    await apiClient.delete(`/tree/relationships/${id}`);
  },
};

// ─── Media ──────────────────────────────────────────────────────────────────────

export const mediaApi = {
  upload: async (
    personId: string,
    mediaType: "photo" | "audio",
    file: File
  ): Promise<MediaFile> => {
    const formData = new FormData();
    formData.append("person_id", personId);
    formData.append("media_type", mediaType);
    formData.append("file", file);
    const { data } = await apiClient.post<BackendMedia>(
      "/media/upload",
      formData,
      { headers: { "Content-Type": "multipart/form-data" } }
    );
    return mapMedia(data);
  },

  delete: async (mediaId: string): Promise<void> => {
    await apiClient.delete(`/media/${mediaId}`);
  },
};

export default apiClient;
