import { defineConfig } from "@tanstack/react-start/config";
import viteTsConfigPaths from "vite-tsconfig-paths";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  tsr: {
    generatedRouteTree: "./src/routeTree.gen.ts",
    routesDirectory: "./src/routes",
  },
  server: {
    preset: "vercel",
    entry: "./src/server.ts",
  },
  vite: {
    plugins: [
      tailwindcss(),
      viteTsConfigPaths({ projects: ["./tsconfig.json"] }),
    ],
  },
});
