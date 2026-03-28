/// <reference types="vite/client" />

declare module "*.css?url" {
  const url: string;
  export default url;
}

interface ImportMetaEnv {
  readonly VITE_APP_URL: string;
  readonly VITE_MASTRA_API_URL: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
