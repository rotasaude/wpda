import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Frontend WPDA — app público do cidadão (relatório por token assinado).
// Em dev, Vite proxa rotas de backend para o Rails (apps/api, :3030).
//   /up         → healthcheck do Rails.
//   /r          → ReportsController (relatório público por token).
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
      "/r":         proxy(TARGET),
      "/admin/api": proxy(TARGET),
      "/session":   proxy(TARGET)
    }
  }
});
