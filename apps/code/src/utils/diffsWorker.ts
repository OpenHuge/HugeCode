// oxlint-disable-next-line import/default -- Vite's ?worker&url virtual module resolves to a string URL at build time.
import WorkerUrl from "@pierre/diffs/worker/worker.js?worker&url";

export function workerFactory(): Worker {
  return new Worker(WorkerUrl, { type: "module" });
}
