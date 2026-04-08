import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

/** Must match Django `STATIC_URL` (`/static/`). Otherwise lazy chunks load from `/assets/…` and hit the SPA catch‑all (HTML → MIME errors). */
export default defineConfig(({ mode }) => ({
  base: mode === "production" ? "/static/" : "/",
  plugins: [react()],
  build: {
    manifest: true,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes("node_modules")) return;

          if (
            id.includes("/@chakra-ui/") ||
            id.includes("/@emotion/") ||
            id.includes("/framer-motion/")
          ) {
            return "vendor-ui";
          }

          if (id.includes("/react/") || id.includes("/react-dom/")) {
            return "vendor-react";
          }

          if (id.includes("/react-router/")) {
            return "vendor-router";
          }

          if (id.includes("/@auth0/")) {
            return "vendor-auth";
          }

          if (id.includes("/@sentry/")) {
            return "vendor-sentry";
          }

          return "vendor";
        },
      },
    },
  },
  server: {
    proxy: {
      "/api": {
        target: "http://127.0.0.1:8000",
        changeOrigin: true,
      },
    },
  },
}));
