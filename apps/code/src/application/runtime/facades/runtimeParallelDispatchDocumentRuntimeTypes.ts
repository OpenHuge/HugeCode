export interface RuntimeParallelDispatchContainer {}

export interface RuntimeParallelDispatchMap extends RuntimeParallelDispatchContainer {
  getOrCreateContainer<T extends RuntimeParallelDispatchContainer>(key: string, container: T): T;
  set(key: string, value: unknown): void;
  toJSON(): unknown;
}

export interface RuntimeParallelDispatchList<T> extends RuntimeParallelDispatchContainer {
  push(value: T): void;
  toJSON(): unknown;
}

export interface RuntimeParallelDispatchDoc {
  commit(options: { origin: string }): void;
  export(options: { mode: "snapshot" }): Uint8Array;
  getMap(name: string): RuntimeParallelDispatchMap;
  import(snapshot: Uint8Array): void;
  toJSON(): unknown;
}

export type RuntimeParallelDispatchDocumentRuntime = {
  createDoc: () => RuntimeParallelDispatchDoc;
  createList: <T>() => RuntimeParallelDispatchList<T>;
  createMap: () => RuntimeParallelDispatchMap;
};
