/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Full origin of the API (no trailing slash), e.g. https://api.example.com — when unset, requests use same-origin `/api/...`. */
  readonly VITE_API_BASE_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
