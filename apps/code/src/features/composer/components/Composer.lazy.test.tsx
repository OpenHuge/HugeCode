/** @vitest-environment jsdom */
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ComposerProps } from "./Composer.types";
import { flushLazyBoundary } from "../../../test/asyncTestUtils";

function createDeferredModule<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((nextResolve) => {
    resolve = nextResolve;
  });
  return { promise, resolve };
}

function createComposerProps(overrides: Partial<ComposerProps> = {}): ComposerProps {
  return {
    onSend: vi.fn(),
    onQueue: vi.fn(),
    onStop: vi.fn(),
    canStop: false,
    disabled: false,
    isProcessing: false,
    steerEnabled: false,
    collaborationModes: [],
    selectedCollaborationModeId: null,
    onSelectCollaborationMode: vi.fn(),
    models: [],
    selectedModelId: null,
    onSelectModel: vi.fn(),
    reasoningOptions: [],
    selectedEffort: null,
    onSelectEffort: vi.fn(),
    reasoningSupported: false,
    accessMode: "on-request",
    onSelectAccessMode: vi.fn(),
    executionOptions: [{ value: "runtime", label: "Runtime" }],
    selectedExecutionMode: "runtime",
    onSelectExecutionMode: vi.fn(),
    skills: [],
    prompts: [],
    files: [],
    queuedMessages: [],
    draftText: "",
    onDraftChange: vi.fn(),
    ...overrides,
  };
}

describe("Composer lazy queue boundary", () => {
  afterEach(() => {
    cleanup();
    vi.resetModules();
    vi.clearAllMocks();
    vi.doUnmock("./ComposerQueue");
  });

  it("does not require the queue chunk when no queued messages are present", async () => {
    const queueModule = createDeferredModule<{
      ComposerQueue: () => JSX.Element;
    }>();

    vi.doMock("./ComposerQueue", () => queueModule.promise);

    const { Composer } = await import("./Composer");

    render(<Composer {...createComposerProps()} />);

    expect(screen.getByRole("textbox", { name: "Composer draft" })).toBeTruthy();
    expect(screen.queryByTestId("composer-queue")).toBeNull();
  }, 20_000);

  it("renders the queue when queued messages exist", async () => {
    const { Composer } = await import("./Composer");

    render(
      <Composer
        {...createComposerProps({
          queuedMessages: [{ id: "queued-1", text: "Run checks", createdAt: 1, images: [] }],
        })}
      />
    );

    expect(screen.getByRole("textbox", { name: "Composer draft" })).toBeTruthy();
    expect(screen.queryByTitle("1 queued")).toBeNull();

    await flushLazyBoundary();

    expect(screen.getByTitle("1 queued")).toBeTruthy();
  }, 30_000);
});
