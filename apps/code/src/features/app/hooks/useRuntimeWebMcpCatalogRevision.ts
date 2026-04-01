import { useEffect, useMemo, useRef, useState } from "react";
import { useScopedRuntimeUpdatedEvent } from "../../../application/runtime/ports/runtimeUpdatedEvents";

const WEB_MCP_CATALOG_RESYNC_SCOPES = ["bootstrap", "skills"] as const;
const WEB_MCP_CATALOG_RESYNC_DEBOUNCE_MS = 250;

function normalizeScopes(scopes: readonly string[]): string[] {
  return [...new Set(scopes)];
}

export function useRuntimeWebMcpCatalogRevision(input: {
  workspaceId?: string | null;
  enabled?: boolean;
}): number {
  const enabled = input.enabled ?? true;
  const scopes = useMemo(() => normalizeScopes(WEB_MCP_CATALOG_RESYNC_SCOPES), []);
  // WebMCP publication stays workspace-scoped. Session overlays continue to affect
  // execution and resolution only, not the globally published browser catalog.
  const runtimeUpdatedEvent = useScopedRuntimeUpdatedEvent({
    enabled,
    workspaceId: input.workspaceId ?? null,
    scopes,
  });
  const [catalogRevision, setCatalogRevision] = useState(0);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setCatalogRevision(0);
  }, [input.workspaceId, enabled]);

  useEffect(
    () => () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
    },
    []
  );

  useEffect(() => {
    if (!enabled || !runtimeUpdatedEvent.lastEvent) {
      return;
    }
    const eventScopes = runtimeUpdatedEvent.lastEvent.scope ?? [];
    if (!eventScopes.some((scope) => scopes.includes(scope))) {
      return;
    }
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    timeoutRef.current = setTimeout(() => {
      timeoutRef.current = null;
      setCatalogRevision((currentRevision) => currentRevision + 1);
    }, WEB_MCP_CATALOG_RESYNC_DEBOUNCE_MS);
  }, [enabled, runtimeUpdatedEvent, scopes]);

  return catalogRevision;
}
