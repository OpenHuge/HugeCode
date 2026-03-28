/** @vitest-environment jsdom */

import type { ReactNode } from "react";
import { renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import {
  useRuntimeSessionCommandsResolver,
  useWorkspaceRuntimeSessionCommands,
} from "./runtimeSessionCommandFacadeHooks";
import { RuntimeKernelProvider } from "../kernel/RuntimeKernelContext";
import type { RuntimeKernel } from "../kernel/runtimeKernelTypes";
import { RUNTIME_KERNEL_CAPABILITY_KEYS } from "../kernel/runtimeKernelCapabilities";

describe("runtimeSessionCommandFacadeHooks", () => {
  function createWrapper(kernel: RuntimeKernel) {
    return function Wrapper({ children }: { children: ReactNode }) {
      return <RuntimeKernelProvider value={kernel}>{children}</RuntimeKernelProvider>;
    };
  }

  it("returns workspace-scoped session commands from the runtime scope hook", () => {
    const runtimeSessionCommands = {
      sendMessage: vi.fn(),
      steerTurn: vi.fn(),
      interruptTurn: vi.fn(),
      startReview: vi.fn(),
      compactThread: vi.fn(),
      listMcpServerStatus: vi.fn(),
      respondToApproval: vi.fn(),
      respondToUserInput: vi.fn(),
      respondToToolCall: vi.fn(),
      canStartReviewInCurrentHost: vi.fn(() => true),
      reviewStartDesktopOnlyMessage: "desktop-only",
    };
    const kernel = {
      getWorkspaceScope: vi.fn(() => ({
        workspaceId: "ws-1",
        runtimeGateway: {} as RuntimeKernel["runtimeGateway"],
        getCapability: vi.fn((key: string) => {
          if (key === RUNTIME_KERNEL_CAPABILITY_KEYS.sessionCommands) {
            return runtimeSessionCommands;
          }
          throw new Error(`unexpected capability ${key}`);
        }),
        hasCapability: vi.fn(() => true),
        listCapabilities: vi.fn(() => [RUNTIME_KERNEL_CAPABILITY_KEYS.sessionCommands]),
      })),
    } as unknown as RuntimeKernel;

    const { result } = renderHook(() => useWorkspaceRuntimeSessionCommands("ws-1"), {
      wrapper: createWrapper(kernel),
    });

    expect(result.current).toBe(runtimeSessionCommands);
    expect(kernel.getWorkspaceScope).toHaveBeenCalledWith("ws-1");
  });

  it("resolves workspace-scoped session commands from the runtime kernel", () => {
    const workspaceSessionCommands = {
      sendMessage: vi.fn(),
      steerTurn: vi.fn(),
      interruptTurn: vi.fn(),
      startReview: vi.fn(),
      compactThread: vi.fn(),
      listMcpServerStatus: vi.fn(),
      respondToApproval: vi.fn(),
      respondToUserInput: vi.fn(),
      respondToToolCall: vi.fn(),
      canStartReviewInCurrentHost: vi.fn(() => true),
      reviewStartDesktopOnlyMessage: "desktop-only",
    };
    const kernel = {
      getWorkspaceScope: vi.fn((workspaceId: string) => ({
        workspaceId,
        runtimeGateway: {} as RuntimeKernel["runtimeGateway"],
        getCapability: vi.fn((key: string) => {
          if (key === RUNTIME_KERNEL_CAPABILITY_KEYS.sessionCommands) {
            return workspaceSessionCommands;
          }
          throw new Error(`unexpected capability ${key}`);
        }),
        hasCapability: vi.fn(() => true),
        listCapabilities: vi.fn(() => [RUNTIME_KERNEL_CAPABILITY_KEYS.sessionCommands]),
      })),
    } as unknown as RuntimeKernel;

    const { result } = renderHook(() => useRuntimeSessionCommandsResolver(), {
      wrapper: createWrapper(kernel),
    });

    expect(result.current("ws-2")).toBe(workspaceSessionCommands);
    expect(kernel.getWorkspaceScope).toHaveBeenCalledWith("ws-2");
  });
});
