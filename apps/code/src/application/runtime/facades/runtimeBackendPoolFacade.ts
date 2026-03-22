import { useCallback, useEffect, useMemo, useState } from "react";
import {
  type AcpIntegrationSummary,
  type AcpIntegrationUpsertInput,
  acpIntegrationProbe,
  acpIntegrationsList,
  acpIntegrationRemove,
  acpIntegrationSetState,
  acpIntegrationUpsert,
  getBackendPoolBootstrapPreview,
  getBackendPoolDiagnostics,
  getRuntimeCapabilitiesSummary,
  runtimeBackendRemove,
  runtimeBackendSetState,
  runtimeBackendsList,
  runtimeBackendUpsert,
  type RuntimeBackendUpsertInput,
} from "../ports/tauriRemoteServers";
import { pushErrorToast } from "../ports/toasts";
import { MULTI_BACKEND_POOL_CAPABILITY, normalizeBackendPoolSnapshot } from "../types/backendPool";
import type { RemoteBackendProvider } from "../../../types";
import {
  formatErrorMessage,
  mergeAcpIntegrationsIntoBackendPoolSnapshot,
} from "./runtimeOperationsShared";

type UseRuntimeBackendPoolFacadeOptions = {
  activeSection: string;
  remoteProvider: RemoteBackendProvider;
};

export function useRuntimeBackendPoolFacade({
  activeSection,
  remoteProvider,
}: UseRuntimeBackendPoolFacadeOptions) {
  void remoteProvider;
  const [backendPoolCapabilityEnabled, setBackendPoolCapabilityEnabled] = useState(false);
  const [backendPoolStateActionsEnabled, setBackendPoolStateActionsEnabled] = useState(false);
  const [backendPoolRemoveEnabled, setBackendPoolRemoveEnabled] = useState(false);
  const [backendPoolUpsertEnabled, setBackendPoolUpsertEnabled] = useState(false);
  const [backendPoolProbeEnabled, setBackendPoolProbeEnabled] = useState(false);
  const [backendPoolLoading, setBackendPoolLoading] = useState(false);
  const [backendPoolError, setBackendPoolError] = useState<string | null>(null);
  const [backendPoolReadOnlyReason, setBackendPoolReadOnlyReason] = useState<string | null>(null);
  const [backendPoolSnapshot, setBackendPoolSnapshot] = useState<ReturnType<
    typeof normalizeBackendPoolSnapshot
  > | null>(null);
  const [acpIntegrationsSnapshot, setAcpIntegrationsSnapshot] = useState<AcpIntegrationSummary[]>(
    []
  );
  const [backendPoolBootstrapPreview, setBackendPoolBootstrapPreview] = useState<Awaited<
    ReturnType<typeof getBackendPoolBootstrapPreview>
  > | null>(null);
  const [backendPoolBootstrapPreviewError, setBackendPoolBootstrapPreviewError] = useState<
    string | null
  >(null);
  const [backendPoolDiagnostics, setBackendPoolDiagnostics] = useState<Awaited<
    ReturnType<typeof getBackendPoolDiagnostics>
  > | null>(null);
  const [backendPoolDiagnosticsError, setBackendPoolDiagnosticsError] = useState<string | null>(
    null
  );

  const refreshBackendPool = useCallback(async () => {
    setBackendPoolLoading(true);
    setBackendPoolError(null);
    try {
      const [payload, acpIntegrations] = await Promise.all([
        runtimeBackendsList(null),
        acpIntegrationsList(null),
      ]);
      if (payload === null) {
        setBackendPoolSnapshot(null);
        setBackendPoolReadOnlyReason("Runtime backend pool RPC is unavailable.");
        return;
      }
      setAcpIntegrationsSnapshot(acpIntegrations ?? []);
      setBackendPoolSnapshot(
        mergeAcpIntegrationsIntoBackendPoolSnapshot(
          normalizeBackendPoolSnapshot(payload),
          acpIntegrations
        )
      );
      setBackendPoolReadOnlyReason(null);
    } catch (error) {
      setBackendPoolError(formatErrorMessage(error, "Unable to load backend pool data."));
    } finally {
      setBackendPoolLoading(false);
    }
  }, []);

  const handleBackendPoolAction = useCallback(
    async ({
      backendId,
      action,
    }: {
      backendId: string;
      action: "drain" | "disable" | "enable" | "remove";
    }) => {
      const targetBackend =
        backendPoolSnapshot?.backends.find((backend) => backend.backendId === backendId) ?? null;
      const integrationId =
        targetBackend?.backendKind === "acp" ? (targetBackend.integrationId ?? null) : null;
      try {
        if (action === "remove") {
          const removed = integrationId
            ? await acpIntegrationRemove({ integrationId })
            : await runtimeBackendRemove({ backendId });
          if (removed === null) {
            setBackendPoolRemoveEnabled(false);
            setBackendPoolReadOnlyReason(
              "Runtime backend remove action is unavailable in current runtime."
            );
            throw new Error("Runtime backend remove action is unavailable in current runtime.");
          }
        } else {
          const state =
            action === "drain" ? "draining" : action === "disable" ? "disabled" : "active";
          const result = integrationId
            ? await acpIntegrationSetState({
                integrationId,
                state,
                reason: `ui:${action}`,
              })
            : await runtimeBackendSetState({
                backendId,
                state,
                reason: `ui:${action}`,
              });
          if (result === null) {
            setBackendPoolStateActionsEnabled(false);
            setBackendPoolReadOnlyReason(
              "Runtime backend actions are unavailable in current runtime."
            );
            throw new Error("Runtime backend actions are unavailable in current runtime.");
          }
        }
        await refreshBackendPool();
      } catch (error) {
        pushErrorToast({
          title: "Backend action failed",
          message: formatErrorMessage(error, "Unable to apply backend action."),
        });
        throw error;
      }
    },
    [backendPoolSnapshot, refreshBackendPool]
  );

  const upsertRuntimeBackend = useCallback(
    async (input: RuntimeBackendUpsertInput) => {
      const created = await runtimeBackendUpsert(input);
      if (created === null) {
        setBackendPoolUpsertEnabled(false);
        setBackendPoolReadOnlyReason(
          "Runtime backend upsert action is unavailable in current runtime."
        );
        throw new Error("Runtime backend upsert action is unavailable in current runtime.");
      }
      await refreshBackendPool();
      return created;
    },
    [refreshBackendPool]
  );

  const upsertAcpBackend = useCallback(
    async (input: AcpIntegrationUpsertInput) => {
      const result = await acpIntegrationUpsert(input);
      if (result === null) {
        setBackendPoolUpsertEnabled(false);
        setBackendPoolReadOnlyReason("ACP backend upsert is unavailable in current runtime.");
        throw new Error("ACP backend upsert is unavailable in current runtime.");
      }
      await refreshBackendPool();
      return result;
    },
    [refreshBackendPool]
  );

  const handleAcpBackendProbe = useCallback(
    async (backendId: string) => {
      const targetBackend =
        backendPoolSnapshot?.backends.find((backend) => backend.backendId === backendId) ?? null;
      const integrationId =
        targetBackend?.backendKind === "acp" ? (targetBackend.integrationId ?? null) : null;
      if (!integrationId) {
        return;
      }
      try {
        const result = await acpIntegrationProbe({ integrationId, force: true });
        if (result === null) {
          setBackendPoolProbeEnabled(false);
          setBackendPoolReadOnlyReason("ACP probe action is unavailable in current runtime.");
          throw new Error("ACP probe action is unavailable in current runtime.");
        }
        await refreshBackendPool();
      } catch (error) {
        pushErrorToast({
          title: "ACP probe failed",
          message: formatErrorMessage(error, "Unable to probe ACP backend."),
        });
        throw error;
      }
    },
    [backendPoolSnapshot, refreshBackendPool]
  );

  useEffect(() => {
    if (activeSection !== "server") {
      return;
    }

    let cancelled = false;
    void (async () => {
      const summary = await getRuntimeCapabilitiesSummary();
      if (cancelled) {
        return;
      }
      const hasCapability = summary.features.includes(MULTI_BACKEND_POOL_CAPABILITY);
      const supportsBackendList = summary.methods.includes("code_runtime_backends_list");
      const supportsBackendSetState = summary.methods.includes("code_runtime_backend_set_state");
      const supportsBackendRemove = summary.methods.includes("code_runtime_backend_remove");
      const supportsBackendUpsert = summary.methods.includes("code_runtime_backend_upsert");
      const supportsAcpProbe = summary.methods.includes("code_acp_integration_probe");

      setBackendPoolCapabilityEnabled(hasCapability);
      setBackendPoolStateActionsEnabled(hasCapability && supportsBackendSetState && !summary.error);
      setBackendPoolRemoveEnabled(hasCapability && supportsBackendRemove && !summary.error);
      setBackendPoolUpsertEnabled(hasCapability && supportsBackendUpsert && !summary.error);
      setBackendPoolProbeEnabled(hasCapability && supportsAcpProbe && !summary.error);

      if (!hasCapability) {
        setBackendPoolSnapshot(null);
        setBackendPoolReadOnlyReason(null);
        return;
      }
      if (!supportsBackendList) {
        setBackendPoolSnapshot(null);
        setBackendPoolReadOnlyReason("Runtime backend pool RPC is unavailable.");
        return;
      }
      if (summary.error) {
        setBackendPoolReadOnlyReason(summary.error);
      } else if (!supportsBackendSetState && !supportsBackendRemove && !supportsBackendUpsert) {
        setBackendPoolReadOnlyReason("Runtime backend actions are unavailable in current runtime.");
      } else if (!supportsBackendSetState || !supportsBackendRemove || !supportsBackendUpsert) {
        setBackendPoolReadOnlyReason("Some backend actions are unavailable in current runtime.");
      }
      await refreshBackendPool();
    })();

    return () => {
      cancelled = true;
    };
  }, [activeSection, refreshBackendPool]);

  useEffect(() => {
    if (activeSection !== "server") {
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        const [preview, diagnostics] = await Promise.all([
          getBackendPoolBootstrapPreview(),
          getBackendPoolDiagnostics(),
        ]);
        if (cancelled) {
          return;
        }
        setBackendPoolBootstrapPreview(preview);
        setBackendPoolBootstrapPreviewError(null);
        setBackendPoolDiagnostics(diagnostics);
        setBackendPoolDiagnosticsError(null);
      } catch (error) {
        if (cancelled) {
          return;
        }
        const message = formatErrorMessage(error, "Unable to load backend pool operator metadata.");
        setBackendPoolBootstrapPreviewError(message);
        setBackendPoolDiagnosticsError(message);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [activeSection]);

  const backendPoolSectionReadOnlyReason = useMemo(
    () =>
      backendPoolReadOnlyReason ??
      (backendPoolCapabilityEnabled &&
      !backendPoolStateActionsEnabled &&
      !backendPoolRemoveEnabled &&
      !backendPoolUpsertEnabled
        ? "Runtime backend actions are unavailable in current runtime."
        : null),
    [
      backendPoolCapabilityEnabled,
      backendPoolReadOnlyReason,
      backendPoolRemoveEnabled,
      backendPoolStateActionsEnabled,
      backendPoolUpsertEnabled,
    ]
  );

  return {
    backendPoolCapabilityEnabled,
    backendPoolSnapshot,
    backendPoolLoading,
    backendPoolError,
    backendPoolSectionReadOnlyReason,
    backendPoolStateActionsEnabled,
    backendPoolRemoveEnabled,
    backendPoolUpsertEnabled,
    backendPoolProbeEnabled,
    acpIntegrationsSnapshot,
    backendPoolBootstrapPreview,
    backendPoolBootstrapPreviewError,
    backendPoolDiagnostics,
    backendPoolDiagnosticsError,
    refreshBackendPool,
    handleBackendPoolAction,
    upsertRuntimeBackend,
    upsertAcpBackend,
    handleAcpBackendProbe,
  };
}
