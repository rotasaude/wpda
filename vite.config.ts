import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Frontend WPDA — autoria de protocolo da cidade.
// Em dev, Vite proxa as rotas de backend para o Rails (apps/api, :3030).
//   /up         → healthcheck do Rails (sem auth), usado pelo health-ping.
//   /admin/api  → Admin::Api::* (read-only).
//   /session    → SessionsController.
const proxy = (target: string) => ({ target, changeOrigin: true });
const TARGET = process.env.VITE_API_PROXY_TARGET || "http://localhost:3030";

export default defineConfig({
  plugins: [react()],
  base: "/wpda/",
  server: {
    port: 5173,
    host: "0.0.0.0",
    proxy: {
      "/up":        proxy(TARGET),
      "/admin/api": proxy(TARGET),
      "/session":   proxy(TARGET)
    }
  }
});
