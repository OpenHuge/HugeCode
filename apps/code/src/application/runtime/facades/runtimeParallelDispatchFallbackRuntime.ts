import type {
  RuntimeParallelDispatchContainer,
  RuntimeParallelDispatchDoc,
  RuntimeParallelDispatchDocumentRuntime,
  RuntimeParallelDispatchList,
  RuntimeParallelDispatchMap,
} from "./runtimeParallelDispatchDocumentRuntimeTypes";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function cloneJsonValue<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

class FallbackRuntimeParallelDispatchMap implements RuntimeParallelDispatchMap {
  constructor(private value: Record<string, unknown> = {}) {}

  bind(nextValue: Record<string, unknown>) {
    this.value = nextValue;
  }

  getOrCreateContainer<T extends RuntimeParallelDispatchContainer>(key: string, container: T): T {
    const existing = this.value[key];
    if (container instanceof FallbackRuntimeParallelDispatchMap) {
      if (isRecord(existing)) {
        container.bind(existing);
        return container;
      }
      this.value[key] = container.raw();
      return container;
    }
    if (container instanceof FallbackRuntimeParallelDispatchList) {
      if (Array.isArray(existing)) {
        container.bind(existing);
        return container;
      }
      this.value[key] = container.raw();
      return container;
    }
    this.value[key] = container;
    return container;
  }

  raw() {
    return this.value;
  }

  set(key: string, value: unknown) {
    this.value[key] = value;
  }

  toJSON() {
    return cloneJsonValue(this.value);
  }
}

class FallbackRuntimeParallelDispatchList<T> implements RuntimeParallelDispatchList<T> {
  constructor(private value: T[] = []) {}

  bind(nextValue: T[]) {
    this.value = nextValue;
  }

  push(entry: T) {
    this.value.push(entry);
  }

  raw() {
    return this.value;
  }

  toJSON() {
    return cloneJsonValue(this.value);
  }
}

class FallbackRuntimeParallelDispatchDoc implements RuntimeParallelDispatchDoc {
  constructor(private value: Record<string, unknown> = {}) {}

  commit(_options: { origin: string }) {}

  export(_options: { mode: "snapshot" }) {
    return new TextEncoder().encode(JSON.stringify(this.value));
  }

  getMap(name: string) {
    const existing = this.value[name];
    if (!isRecord(existing)) {
      this.value[name] = {};
    }
    return new FallbackRuntimeParallelDispatchMap(this.value[name] as Record<string, unknown>);
  }

  import(snapshot: Uint8Array) {
    const decoded = new TextDecoder().decode(snapshot);
    const parsed = JSON.parse(decoded);
    if (!isRecord(parsed)) {
      throw new Error("Parallel dispatch snapshot must decode to an object.");
    }
    this.value = parsed;
  }

  toJSON() {
    return cloneJsonValue(this.value);
  }
}

export function createFallbackRuntimeParallelDispatchDocumentRuntime(): RuntimeParallelDispatchDocumentRuntime {
  return {
    createDoc: () => new FallbackRuntimeParallelDispatchDoc(),
    createList: <T>() => new FallbackRuntimeParallelDispatchList<T>(),
    createMap: () => new FallbackRuntimeParallelDispatchMap(),
  };
}
