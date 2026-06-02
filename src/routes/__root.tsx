import { createRootRoute, Outlet } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import axios from "axios";
import { useAuthStore } from "@/lib/store";
import { authApi, setActiveTreeId } from "@/lib/api";

export const Route = createRootRoute({
  component: RootComponent,
});

function RootComponent() {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      // Le store auth est persiste avec skipHydration : il faut le rehydrater
      // explicitement au demarrage, sinon l'utilisateur repart deconnecte.
      await useAuthStore.persist.rehydrate();

      const { token, isAuthenticated, logout, activeTreeId, setTreeAccesses } = useAuthStore.getState();
      // Resynchronise l'arbre actif persisté vers localStorage (lu par l'intercepteur).
      if (activeTreeId) setActiveTreeId(activeTreeId);
      if (token && isAuthenticated) {
        try {
          // Rafraichit personId / onboarded / arbres depuis le serveur (source de verite).
          const me = await authApi.me();
          if (!cancelled) {
            // Session glissante : on restocke le token frais réémis par /me pour
            // repousser l'expiration (l'utilisateur actif ne refait jamais l'OTP).
            if (me.accessToken) {
              localStorage.setItem("jabot_token", me.accessToken);
              useAuthStore.setState({ token: me.accessToken });
            }
            useAuthStore.setState({
              personId: me.personId ?? undefined,
              onboarded: me.onboarded,
              phone: me.phone,
            });
            setTreeAccesses(me.treeAccesses, me.activeTreeId);
          }
        } catch (err) {
          // Token expire ou compte supprime : on nettoie la session.
          if (axios.isAxiosError(err) && err.response?.status === 401) logout();
        }
      }
      if (!cancelled) setReady(true);
    })();
    return () => { cancelled = true; };
  }, []);

  if (!ready) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-canvas">
        <div className="size-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  return <Outlet />;
}
