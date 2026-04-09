/// <reference types="vite/client" />

declare const __APP_VERSION__: string;

declare module "loro-crdt/web/loro_wasm" {
  export default function initLoro(options: { module_or_path: unknown }): Promise<void>;

  export class LoroDoc {}

  export class LoroList<T = unknown> {}

  export class LoroMap {}
}

declare module "loro-crdt/web/loro_wasm_bg.wasm?url" {
  const wasmUrl: string;
  export default wasmUrl;
}
