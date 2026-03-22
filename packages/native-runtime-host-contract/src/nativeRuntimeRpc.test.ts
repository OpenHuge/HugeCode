import {
  CODE_RUNTIME_RPC_METHOD_LIST,
  type CodeRuntimeRpcCapabilities,
  computeCodeRuntimeRpcMethodSetHash,
} from "@ku0/code-runtime-host-contract";
import { describe, expect, it } from "vitest";
import {
  isNativeRuntimeRpcMethod,
  NATIVE_RUNTIME_EVENT_METHODS,
  NATIVE_RUNTIME_METHOD_MAP,
  NATIVE_RUNTIME_NATIVE_ONLY_METHOD_LIST,
  NATIVE_RUNTIME_RPC_METHOD_LIST,
  toCodeRuntimeRpcMethod,
  toNativeRuntimeCapabilities,
  toNativeRuntimeRpcMethod,
} from "./nativeRuntimeRpc";

describe("native runtime rpc mapping", () => {
  it("maps only the shared rpc capabilities handshake into the native namespace", () => {
    const methods = CODE_RUNTIME_RPC_METHOD_LIST.filter(
      (method) => method === "code_rpc_capabilities"
    );
    for (const method of methods) {
      const nativeMethod = toNativeRuntimeRpcMethod(method);
      expect(nativeMethod.startsWith("native_")).toBe(true);
      expect(toCodeRuntimeRpcMethod(nativeMethod)).toBe(method);
      expect(isNativeRuntimeRpcMethod(nativeMethod)).toBe(true);
    }
  });

  it("keeps native-only methods outside code namespace", () => {
    expect(NATIVE_RUNTIME_NATIVE_ONLY_METHOD_LIST).toEqual(
      expect.arrayContaining([
        "native_providers_snapshot",
        "native_providers_connection_probe",
        "native_review_comments_list",
        "native_state_fabric_snapshot",
        "native_state_fabric_delta",
        "native_state_fabric_diagnostics",
      ])
    );
    for (const method of NATIVE_RUNTIME_NATIVE_ONLY_METHOD_LIST) {
      expect(toCodeRuntimeRpcMethod(method)).toBeNull();
      expect(isNativeRuntimeRpcMethod(method)).toBe(true);
    }
  });

  it("advertises a host-only method list", () => {
    expect(NATIVE_RUNTIME_RPC_METHOD_LIST).toContain("native_rpc_capabilities");
    expect(NATIVE_RUNTIME_RPC_METHOD_LIST.length).toBe(
      NATIVE_RUNTIME_NATIVE_ONLY_METHOD_LIST.length + 1
    );
    expect(NATIVE_RUNTIME_METHOD_MAP).toHaveLength(1);
    for (const method of NATIVE_RUNTIME_NATIVE_ONLY_METHOD_LIST) {
      expect(NATIVE_RUNTIME_RPC_METHOD_LIST).toContain(method);
    }
  });

  it("keeps alias/native-only method sets disjoint in capabilities payload", () => {
    const codeCapabilities: CodeRuntimeRpcCapabilities = {
      contractVersion: "2026-02-27",
      freezeEffectiveAt: "2026-02-27",
      methodSetHash: "0000000000000000",
      methods: [...CODE_RUNTIME_RPC_METHOD_LIST],
      features: [],
      errorCodes: {
        METHOD_NOT_FOUND: "METHOD_NOT_FOUND",
      },
    };

    const nativeCapabilities = toNativeRuntimeCapabilities(codeCapabilities);
    const aliasMethods = new Set(nativeCapabilities.methodSets?.aliasNativeMethods ?? []);
    const nativeOnlyMethods = nativeCapabilities.methodSets?.nativeOnlyMethods ?? [];

    expect(aliasMethods).toEqual(new Set(["native_rpc_capabilities"]));
    expect(nativeOnlyMethods.length).toBeGreaterThan(0);
    for (const method of nativeOnlyMethods) {
      expect(aliasMethods.has(method)).toBe(false);
    }
  });

  it("keeps native event method family stable", () => {
    expect([...NATIVE_RUNTIME_EVENT_METHODS]).toEqual(["native_state_fabric_updated"]);
  });

  it("converts capability payload to native namespace", () => {
    const codeCapabilities: CodeRuntimeRpcCapabilities = {
      contractVersion: "2026-02-27",
      freezeEffectiveAt: "2026-02-27",
      methodSetHash: "0000000000000000",
      methods: [...CODE_RUNTIME_RPC_METHOD_LIST],
      features: ["thread_live_subscription_v1"],
      errorCodes: {
        METHOD_NOT_FOUND: "METHOD_NOT_FOUND",
      },
    };

    const nativeCapabilities = toNativeRuntimeCapabilities(codeCapabilities);
    expect(nativeCapabilities.namespace).toBe("native");
    expect(nativeCapabilities.methods.every((method) => method.startsWith("native_"))).toBe(true);
    expect(nativeCapabilities.eventMethods).toEqual([...NATIVE_RUNTIME_EVENT_METHODS]);
    expect(nativeCapabilities.methodSets?.aliasNativeMethods).toEqual(["native_rpc_capabilities"]);
    expect(nativeCapabilities.methodSets?.nativeOnlyMethods).toEqual([
      ...NATIVE_RUNTIME_NATIVE_ONLY_METHOD_LIST,
    ]);
    expect(nativeCapabilities.features).toEqual(
      expect.arrayContaining([
        "native_rpc_namespace_v1",
        "native_state_fabric_v1",
        "native_capability_schema_v2",
      ])
    );
    expect(nativeCapabilities.capabilities?.nativeCapabilitySchemaVersion).toBe("v2");
    expect(nativeCapabilities.capabilities?.uiLayers).toEqual({
      sidebar: true,
      timeline: true,
      composer: true,
      managementCenter: true,
      reviewPanel: true,
      utilityPanel: true,
    });
    expect(nativeCapabilities.capabilities?.voice).toEqual({
      vad: true,
      transcription: true,
      globalHotkey: true,
    });
    expect(nativeCapabilities.capabilities?.workflow).toEqual({
      workMode: true,
      parallelTasks: true,
      approvals: true,
      resume: true,
    });
    expect(nativeCapabilities.capabilities?.tooling).toEqual({
      plugins: true,
      tools: true,
      skills: true,
    });
    expect(nativeCapabilities.capabilities?.fallback).toEqual({
      threadLive: "polling",
      runtimeOffline: "degraded",
    });
    expect(nativeCapabilities.methodSetHash).toBe(
      computeCodeRuntimeRpcMethodSetHash(nativeCapabilities.methods)
    );
  });

  it("keeps native v2 method set hash stable", () => {
    expect(computeCodeRuntimeRpcMethodSetHash([...NATIVE_RUNTIME_RPC_METHOD_LIST])).toBe(
      "d50464c1ed31c62a"
    );
  });
});
