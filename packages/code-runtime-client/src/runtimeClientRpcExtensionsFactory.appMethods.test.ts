import {
  CODE_RUNTIME_RPC_EMPTY_PARAMS,
  CODE_RUNTIME_RPC_METHODS,
} from "@ku0/code-runtime-host-contract";
import { describe, expect, it, vi } from "vitest";
import { createExtendedRpcRuntimeClient } from "./runtimeClientRpcExtensionsFactory";
import type { RuntimeRpcInvoker } from "./runtimeClientRpcHelpers";
import type { RuntimeClient } from "./runtimeClientTypes";

describe("@ku0/code-runtime-client runtimeClientRpcExtensionsFactory app methods", () => {
  it("includes app-owned oauth, settings, and text-file RPC helpers in the shared client", async () => {
    const invokeRpc = vi.fn(async () => undefined as never) as RuntimeRpcInvoker;
    const client = createExtendedRpcRuntimeClient<Record<string, unknown>>(
      invokeRpc
    ) as RuntimeClient<Record<string, unknown>>;

    await client.oauthAccounts("codex");
    await client.appSettingsGet();
    await client.textFileReadV1({
      scope: "workspace",
      kind: "mission-control",
      workspaceId: "ws-1",
    } as never);

    expect(invokeRpc).toHaveBeenNthCalledWith(1, CODE_RUNTIME_RPC_METHODS.OAUTH_ACCOUNTS_LIST, {
      provider: "codex",
    });
    expect(invokeRpc).toHaveBeenNthCalledWith(
      2,
      CODE_RUNTIME_RPC_METHODS.APP_SETTINGS_GET,
      CODE_RUNTIME_RPC_EMPTY_PARAMS
    );
    expect(invokeRpc).toHaveBeenNthCalledWith(3, CODE_RUNTIME_RPC_METHODS.TEXT_FILE_READ_V1, {
      scope: "workspace",
      kind: "mission-control",
      workspaceId: "ws-1",
    });
  });

  it("includes runtime composition authority helpers in the shared client", async () => {
    const invokeRpc = vi.fn(async () => undefined as never) as RuntimeRpcInvoker;
    const client = createExtendedRpcRuntimeClient<Record<string, unknown>>(
      invokeRpc
    ) as RuntimeClient<Record<string, unknown>>;

    await client.runtimeCompositionProfileListV2({ workspaceId: "ws-1" });
    await client.runtimeCompositionProfileGetV2({
      workspaceId: "ws-1",
      profileId: "workspace-default",
    });
    await client.runtimeCompositionProfileResolveV2({
      workspaceId: "ws-1",
      profileId: null,
      launchOverride: null,
    });
    await client.runtimeCompositionSnapshotPublishV1({
      workspaceId: "ws-1",
      profiles: [],
      snapshot: {
        activeProfile: null,
        authorityState: "published",
        authorityRevision: 1,
        publishedAt: 10,
        publisherSessionId: "session-1",
        provenance: {
          activeProfileId: null,
          appliedLayerOrder: [],
          selectorDecisions: {},
        },
        pluginEntries: [],
        selectedRouteCandidates: [],
        selectedBackendCandidates: [],
        blockedPlugins: [],
        trustDecisions: [],
      },
      authorityRevision: 1,
      publishedAt: 10,
      publisherSessionId: "session-1",
    });

    expect(invokeRpc).toHaveBeenNthCalledWith(
      1,
      CODE_RUNTIME_RPC_METHODS.COMPOSITION_PROFILE_LIST_V2,
      {
        workspaceId: "ws-1",
      }
    );
    expect(invokeRpc).toHaveBeenNthCalledWith(
      2,
      CODE_RUNTIME_RPC_METHODS.COMPOSITION_PROFILE_GET_V2,
      {
        workspaceId: "ws-1",
        profileId: "workspace-default",
      }
    );
    expect(invokeRpc).toHaveBeenNthCalledWith(
      3,
      CODE_RUNTIME_RPC_METHODS.COMPOSITION_PROFILE_RESOLVE_V2,
      {
        workspaceId: "ws-1",
        profileId: null,
        launchOverride: null,
      }
    );
    expect(invokeRpc).toHaveBeenNthCalledWith(
      4,
      CODE_RUNTIME_RPC_METHODS.COMPOSITION_SNAPSHOT_PUBLISH_V1,
      {
        workspaceId: "ws-1",
        profiles: [],
        snapshot: {
          activeProfile: null,
          authorityState: "published",
          authorityRevision: 1,
          publishedAt: 10,
          publisherSessionId: "session-1",
          provenance: {
            activeProfileId: null,
            appliedLayerOrder: [],
            selectorDecisions: {},
          },
          pluginEntries: [],
          selectedRouteCandidates: [],
          selectedBackendCandidates: [],
          blockedPlugins: [],
          trustDecisions: [],
        },
        authorityRevision: 1,
        authority_revision: 1,
        publishedAt: 10,
        published_at: 10,
        publisherSessionId: "session-1",
        publisher_session_id: "session-1",
      }
    );
  });
});
