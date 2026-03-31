export type {
  RuntimeParallelDispatchContainer,
  RuntimeParallelDispatchDoc,
  RuntimeParallelDispatchDocumentRuntime,
  RuntimeParallelDispatchList,
  RuntimeParallelDispatchMap,
} from "./runtimeParallelDispatchDocumentRuntimeTypes";

import type { RuntimeParallelDispatchDocumentRuntime } from "./runtimeParallelDispatchDocumentRuntimeTypes";

let runtimePromise: Promise<RuntimeParallelDispatchDocumentRuntime> | null = null;

async function importLoroRuntimeModule() {
  const modulePath = `./runtimeParallelDispatchLoro${"Runtime"}`;
  return import(/* @vite-ignore */ modulePath);
}

async function importFallbackRuntimeModule() {
  return import("./runtimeParallelDispatchFallbackRuntime");
}

export function loadRuntimeParallelDispatchDocumentRuntime() {
  if (!runtimePromise) {
    runtimePromise = importLoroRuntimeModule()
      .then(({ createLoroRuntimeParallelDispatchDocumentRuntime }) =>
        createLoroRuntimeParallelDispatchDocumentRuntime()
      )
      .catch(async () => {
        const { createFallbackRuntimeParallelDispatchDocumentRuntime } =
          await importFallbackRuntimeModule();
        return createFallbackRuntimeParallelDispatchDocumentRuntime();
      });
  }
  return runtimePromise;
}

export function resetRuntimeParallelDispatchDocumentRuntimeForTests() {
  runtimePromise = null;
}
