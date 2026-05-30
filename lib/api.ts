import axios from "axios";
import { FamilyTree, Person, Relationship, SearchResult } from "./types";

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

// Family Tree
export const familyTreeApi = {
  getTree: async (): Promise<FamilyTree> => {
    const { data } = await apiClient.get<FamilyTree>("/family-tree");
    return data;
  },

  getTreePublic: async (): Promise<FamilyTree> => {
    const { data } = await apiClient.get<FamilyTree>("/family-tree/public");
    return data;
  },
};

// Persons
export const personsApi = {
  getAll: async (): Promise<Person[]> => {
    const { data } = await apiClient.get<Person[]>("/persons");
    return data;
  },

  getById: async (id: string): Promise<Person> => {
    const { data } = await apiClient.get<Person>(`/persons/${id}`);
    return data;
  },

  create: async (person: Omit<Person, "id">): Promise<Person> => {
    const { data } = await apiClient.post<Person>("/persons", person);
    return data;
  },

  update: async (id: string, person: Partial<Person>): Promise<Person> => {
    const { data } = await apiClient.put<Person>(`/persons/${id}`, person);
    return data;
  },

  delete: async (id: string): Promise<void> => {
    await apiClient.delete(`/persons/${id}`);
  },

  search: async (query: string): Promise<SearchResult[]> => {
    const { data } = await apiClient.get<SearchResult[]>("/persons/search", {
      params: { q: query },
    });
    return data;
  },

  uploadPhoto: async (personId: string, file: File): Promise<{ url: string; id: string }> => {
    const formData = new FormData();
    formData.append("photo", file);
    const { data } = await apiClient.post(
      `/persons/${personId}/photos`,
      formData,
      { headers: { "Content-Type": "multipart/form-data" } }
    );
    return data;
  },

  uploadAudio: async (
    personId: string,
    file: File
  ): Promise<{ url: string; id: string; duration: number }> => {
    const formData = new FormData();
    formData.append("audio", file);
    const { data } = await apiClient.post(
      `/persons/${personId}/audios`,
      formData,
      { headers: { "Content-Type": "multipart/form-data" } }
    );
    return data;
  },

  deleteMedia: async (personId: string, mediaId: string): Promise<void> => {
    await apiClient.delete(`/persons/${personId}/media/${mediaId}`);
  },
};

// Relationships
export const relationshipsApi = {
  create: async (relationship: Omit<Relationship, "id">): Promise<Relationship> => {
    const { data } = await apiClient.post<Relationship>("/relationships", relationship);
    return data;
  },

  delete: async (id: string): Promise<void> => {
    await apiClient.delete(`/relationships/${id}`);
  },
};

// Auth
export const authApi = {
  requestOtp: async (phone: string): Promise<{ message: string }> => {
    const { data } = await apiClient.post("/auth/otp/request", { phone });
    return data;
  },

  verifyOtp: async (
    phone: string,
    otp: string
  ): Promise<{ token: string; userId: string; isNewUser: boolean }> => {
    const { data } = await apiClient.post("/auth/otp/verify", { phone, otp });
    return data;
  },

  logout: async (): Promise<void> => {
    await apiClient.post("/auth/logout");
  },
};

// Onboarding
export const onboardingApi = {
  searchExisting: async (params: {
    firstName: string;
    lastName: string;
    fatherFirstName?: string;
    fatherLastName?: string;
    motherFirstName?: string;
    motherLastName?: string;
  }): Promise<SearchResult[]> => {
    const { data } = await apiClient.post<SearchResult[]>("/onboarding/search", params);
    return data;
  },

  createFromOnboarding: async (onboardingData: object): Promise<{ personId: string }> => {
    const { data } = await apiClient.post<{ personId: string }>(
      "/onboarding/create",
      onboardingData
    );
    return data;
  },
};

export default apiClient;
