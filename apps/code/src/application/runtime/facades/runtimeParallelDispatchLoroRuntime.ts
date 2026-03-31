import initLoro, { LoroDoc, LoroList, LoroMap } from "loro-crdt/web/loro_wasm";
import loroWasmUrl from "loro-crdt/web/loro_wasm_bg.wasm?url";
import type {
  RuntimeParallelDispatchDoc,
  RuntimeParallelDispatchDocumentRuntime,
  RuntimeParallelDispatchList,
  RuntimeParallelDispatchMap,
} from "./runtimeParallelDispatchDocumentRuntimeTypes";

export async function createLoroRuntimeParallelDispatchDocumentRuntime(): Promise<RuntimeParallelDispatchDocumentRuntime> {
  if (import.meta.env.MODE === "test" && loroWasmUrl.startsWith("/@fs/")) {
    const { readFile } = await import("node:fs/promises");
    const bytes = await readFile(loroWasmUrl.slice("/@fs".length));
    await initLoro({ module_or_path: bytes });
  } else {
    await initLoro({ module_or_path: loroWasmUrl });
  }

  return {
    createDoc: () => new LoroDoc() as unknown as RuntimeParallelDispatchDoc,
    createList: <T>() => new LoroList<T>() as unknown as RuntimeParallelDispatchList<T>,
    createMap: () => new LoroMap() as unknown as RuntimeParallelDispatchMap,
  };
}
