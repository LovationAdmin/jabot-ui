"use client";

import { useAuthStore } from "@/lib/store";
import { authApi } from "@/lib/api";
import { useRouter } from "next/navigation";
import { useToast } from "@/hooks/use-toast";

export function useAuth() {
  const authStore = useAuthStore();
  const router = useRouter();
  const { toast } = useToast();

  const handleLogout = async () => {
    try {
      await authApi.logout();
    } catch {
      // ignore API errors on logout
    }
    authStore.logout();
    toast({
      title: "Déconnexion",
      description: "Vous avez été déconnecté avec succès.",
    });
    router.push("/");
  };

  return {
    ...authStore,
    logout: handleLogout,
  };
}
