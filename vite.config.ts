import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";

// Dev API server is started separately (`npm run dev:server`, default port
// 3000) — see package.json. This just proxies /api and /uploads to it so
// `npm run dev` can hit the real Express routes instead of a mock.
const API_PROXY_TARGET = process.env.API_PROXY_TARGET || "http://localhost:3000";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    port: 5174,
    strictPort: false,
    proxy: {
      "/api": API_PROXY_TARGET,
      "/uploads": API_PROXY_TARGET,
    },
  },
});
