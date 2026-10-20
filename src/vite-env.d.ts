/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_PROXY_TARGET?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

// Escrito por /wpda/runtime-config.js antes do app (rotasaude/wpda#2).
interface Window {
  __WPDA_RUNTIME__?: { allowDesktop?: boolean };
}
