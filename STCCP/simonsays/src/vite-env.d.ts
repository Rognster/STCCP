/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_FACE_API_KEY: string;
  readonly VITE_FACE_API_ENDPOINT: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
