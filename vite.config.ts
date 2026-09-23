import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Frontend WPDA — frontend do paciente: relatório por token e canal web do cidadão (ADR 0017).
// Em dev, Vite proxa rotas de backend para o Rails (apps/api, :3030).
//   /up         → healthcheck do Rails.
//   /r          → ReportsController (relatório público por token).
//   /citizen    → canal web do cidadão (CitizenApi).
const proxy = (target: string) => ({ target, changeOrigin: false });
const TARGET = process.env.VITE_API_PROXY_TARGET || "http://localhost:3030";

export default defineConfig({
  plugins: [react()],
  base: "/wpda/",
  server: {
    port: 5173,
    host: "0.0.0.0",
    allowedHosts: [ ".localhost" ],
    proxy: {
      "/up": proxy(TARGET),
      "/r":  proxy(TARGET),
      "/citizen": proxy(TARGET)
    }
  }
});
