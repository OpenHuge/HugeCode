export function resolveT3RuntimeEventsEndpoint() {
  const configuredEndpoint = import.meta.env.VITE_CODE_RUNTIME_GATEWAY_EVENTS_ENDPOINT?.trim();
  if (configuredEndpoint) {
    return configuredEndpoint;
  }
  return import.meta.env.DEV ? "http://127.0.0.1:8788/events" : null;
}

function parseRuntimeEventStream(text: string): unknown[] {
  return text.split(/\n\n/u).flatMap((frame) => {
    const data = frame
      .split(/\n/u)
      .filter((line) => line.startsWith("data:"))
      .map((line) => line.slice(5).trim())
      .join("\n");
    if (!data) {
      return [];
    }
    try {
      return [JSON.parse(data) as unknown];
    } catch {
      return [];
    }
  });
}

export async function readT3RuntimeEventSnapshot(endpoint: string): Promise<unknown[]> {
  const response = await fetch(endpoint, {
    headers: {
      accept: "text/event-stream",
    },
  });
  const reader = response.body?.getReader();
  if (!reader) {
    return [];
  }
  const decoder = new TextDecoder();
  const chunks: string[] = [];
  const deadline = Date.now() + 1800;
  try {
    while (Date.now() < deadline) {
      const timeoutMs = Math.max(1, deadline - Date.now());
      const result = await Promise.race([
        reader.read(),
        new Promise<null>((resolve) => window.setTimeout(() => resolve(null), timeoutMs)),
      ]);
      if (!result) {
        break;
      }
      if (result.done) {
        break;
      }
      chunks.push(decoder.decode(result.value, { stream: true }));
    }
  } finally {
    await reader.cancel().catch(() => undefined);
  }
  chunks.push(decoder.decode());
  return parseRuntimeEventStream(chunks.join(""));
}
