import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { RouterProvider, createRouter } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";
import { useAuthStore } from "./lib/store";
import { ErrorBoundary } from "./components/ErrorBoundary";
import "./styles.css";

// Le store auth utilise skipHydration: on relit donc explicitement le
// localStorage au demarrage, sinon isAuthenticated/onboarded restent a false
// et l'onboarding ne se declenche jamais apres un rechargement.
useAuthStore.persist.rehydrate();

const router = createRouter({
  routeTree,
  defaultPreloadStaleTime: 0,
});

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ErrorBoundary>
      <RouterProvider router={router} />
    </ErrorBoundary>
  </StrictMode>,
);
