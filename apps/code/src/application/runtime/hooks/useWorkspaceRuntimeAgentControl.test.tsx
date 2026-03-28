/** @vitest-environment jsdom */

import type { ReactNode } from "react";
import { renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { useWorkspaceRuntimeAgentControl } from "./useWorkspaceRuntimeAgentControl";
import { RuntimeKernelProvider } from "../kernel/RuntimeKernelContext";
import type { RuntimeKernel } from "../kernel/runtimeKernelTypes";
import { RUNTIME_KERNEL_CAPABILITY_KEYS } from "../kernel/runtimeKernelCapabilities";

describe("useWorkspaceRuntimeAgentControl", () => {
  function createWrapper(kernel: RuntimeKernel) {
    return function Wrapper({ children }: { children: ReactNode }) {
      return <RuntimeKernelProvider value={kernel}>{children}</RuntimeKernelProvider>;
    };
  }

  it("resolves agent control through the workspace runtime capability registry", () => {
    const runtimeAgentControl = {
      listTasks: vi.fn(),
    };
    const kernel = {
      getWorkspaceScope: vi.fn(() => ({
        workspaceId: "ws-1",
        runtimeGateway: {} as RuntimeKernel["runtimeGateway"],
        getCapability: vi.fn((key: string) => {
          if (key === RUNTIME_KERNEL_CAPABILITY_KEYS.agentControl) {
            return runtimeAgentControl;
          }
          throw new Error(`unexpected capability ${key}`);
        }),
        hasCapability: vi.fn(() => true),
        listCapabilities: vi.fn(() => [RUNTIME_KERNEL_CAPABILITY_KEYS.agentControl]),
      })),
    } as unknown as RuntimeKernel;

    const { result } = renderHook(() => useWorkspaceRuntimeAgentControl("ws-1"), {
      wrapper: createWrapper(kernel),
    });

    expect(result.current).toBe(runtimeAgentControl);
    expect(kernel.getWorkspaceScope).toHaveBeenCalledWith("ws-1");
  });
});
