/// <reference types="vite/client" />

declare const __APP_VERSION__: string;

interface ImportMetaEnv {
  readonly [key: string]: string | boolean | undefined;
  readonly DEV: boolean;
  readonly PROD: boolean;
  readonly MODE: string;
  readonly VITE_SENTRY_DSN?: string;
  readonly VITE_SENTRY_ENABLED?: string;
  readonly VITE_TAURI_DEBUG_SIDECAR_BINARIES?: string;
  readonly VITE_HYPECODE_DESKTOP_HOST?: string;
  readonly VITE_HYPECODE_PLATFORM?: string;
  readonly VITE_HYPECODE_REQUIRE_DESKTOP_RUNTIME?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

declare module "lucide-react/dist/esm/icons/*" {
  import type { LucideIcon } from "lucide-react";

  const icon: LucideIcon;
  export default icon;
}

declare module "*.mp3" {
  const src: string;
  export default src;
}

declare module "*.png" {
  const src: string;
  export default src;
}

declare module "*?worker&url" {
  const workerUrl: string;
  export default workerUrl;
}
