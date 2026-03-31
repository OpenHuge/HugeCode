import initLoro, { LoroDoc, LoroList, LoroMap } from "loro-crdt/web/loro_wasm";
import loroWasmUrl from "loro-crdt/web/loro_wasm_bg.wasm?url";
import type { RuntimeParallelDispatchDocumentRuntime } from "./runtimeParallelDispatchDocumentRuntime";

export async function createLoroRuntimeParallelDispatchDocumentRuntime(): Promise<RuntimeParallelDispatchDocumentRuntime> {
  if (import.meta.env.MODE === "test" && loroWasmUrl.startsWith("/@fs/")) {
    const { readFile } = await import("node:fs/promises");
    const bytes = await readFile(loroWasmUrl.slice("/@fs".length));
    await initLoro({ module_or_path: bytes });
  } else {
    await initLoro({ module_or_path: loroWasmUrl });
  }

  return {
    createDoc: () => new LoroDoc(),
    createList: <T>() => new LoroList<T>(),
    createMap: () => new LoroMap(),
  };
}
