import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    globals: false,
    setupFiles: ["./src/test/setup.ts"],
    // Datas do canal web do cidadão são formatadas no fuso da cidade
    // (America/Sao_Paulo); fixa o fuso da suíte para que testes com datas
    // literais passem em qualquer máquina.
    env: { TZ: "America/Sao_Paulo" }
  }
});
