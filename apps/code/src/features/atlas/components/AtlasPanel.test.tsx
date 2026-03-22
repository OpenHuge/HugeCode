// @vitest-environment jsdom
import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { ConversationItem } from "../../../types";
import { AtlasPanel } from "./AtlasPanel";

const items: ConversationItem[] = [
  {
    id: "msg-1",
    kind: "message",
    role: "user",
    text: "hello",
  },
];

function renderPanel(overrides?: Partial<Parameters<typeof AtlasPanel>[0]>) {
  const onDriverOrderChange = vi.fn();
  const onEnabledChange = vi.fn();
  const onDetailLevelChange = vi.fn();
  const props: Parameters<typeof AtlasPanel>[0] = {
    filePanelMode: "atlas",
    onFilePanelModeChange: vi.fn(),
    activeItems: items,
    activePlan: null,
    activeTokenUsage: null,
    activeThreadStatus: null,
    activeTurnId: null,
    activeThreadId: "thread-1",
    enabled: true,
    detailLevel: "balanced",
    driverOrder: [
      "plan",
      "recent_messages",
      "context_compaction",
      "long_term_memory",
      "token_budget",
      "execution_state",
    ],
    longTermMemoryDigest: null,
    onEnabledChange,
    onDetailLevelChange,
    onDriverOrderChange,
    ...overrides,
  };

  return {
    ...render(<AtlasPanel {...props} />),
    onDriverOrderChange,
    onEnabledChange,
    onDetailLevelChange,
  };
}

describe("AtlasPanel", () => {
  it("disables reordering when no active thread", () => {
    const { container } = renderPanel({ activeThreadId: null });

    expect(screen.getByText("Select a thread to customize priorities")).toBeTruthy();
    const firstMoveUp = within(container).getAllByLabelText(/Move .* up/i)[0] as HTMLButtonElement;
    const firstMoveDown = within(container).getAllByLabelText(
      /Move .* down/i
    )[0] as HTMLButtonElement;
    expect(firstMoveUp.disabled).toBe(true);
    expect(firstMoveDown.disabled).toBe(true);
    const toggle = within(container).getByLabelText("Inject context") as HTMLInputElement;
    expect(toggle.disabled).toBe(true);
    const balancedPreset = within(container).getByTitle(
      "Balanced context blend for most conversations."
    ) as HTMLButtonElement;
    const conciseDetail = within(container).getByRole("button", { name: "Concise" });
    const resetButton = within(container).getByRole("button", { name: "Reset Default" });
    expect(balancedPreset.disabled).toBe(true);
    expect((conciseDetail as HTMLButtonElement).disabled).toBe(true);
    expect((resetButton as HTMLButtonElement).disabled).toBe(true);
  });

  it("updates enabled toggle", () => {
    const { onEnabledChange, container } = renderPanel();
    const toggle = within(container).getByLabelText("Inject context") as HTMLInputElement;
    expect(toggle.checked).toBe(true);
    fireEvent.click(toggle);
    expect(onEnabledChange).toHaveBeenCalledWith(false);
  });

  it("applies presets and forces context injection enabled", () => {
    const { container, onEnabledChange, onDriverOrderChange } = renderPanel({ enabled: false });

    fireEvent.click(within(container).getByRole("button", { name: "Fast Reply" }));

    expect(onDriverOrderChange).toHaveBeenCalledWith([
      "recent_messages",
      "execution_state",
      "token_budget",
      "long_term_memory",
      "plan",
      "context_compaction",
    ]);
    expect(onEnabledChange).toHaveBeenCalledWith(true);
  });

  it("resets to default ordering and enables context injection", () => {
    const { container, onEnabledChange, onDriverOrderChange } = renderPanel({
      enabled: false,
      driverOrder: [
        "token_budget",
        "context_compaction",
        "long_term_memory",
        "execution_state",
        "recent_messages",
        "plan",
      ],
    });

    fireEvent.click(within(container).getByRole("button", { name: "Reset Default" }));

    expect(onDriverOrderChange).toHaveBeenCalledWith([
      "plan",
      "recent_messages",
      "context_compaction",
      "long_term_memory",
      "token_budget",
      "execution_state",
    ]);
    expect(onEnabledChange).toHaveBeenCalledWith(true);
  });

  it("re-enables context when preset is already selected", () => {
    const { container, onEnabledChange, onDriverOrderChange } = renderPanel({ enabled: false });

    fireEvent.click(within(container).getByTitle("Balanced context blend for most conversations."));

    expect(onDriverOrderChange).not.toHaveBeenCalled();
    expect(onEnabledChange).toHaveBeenCalledWith(true);
  });

  it("reorders drivers with move controls", () => {
    const { onDriverOrderChange, container } = renderPanel();
    const movePlanDown = (
      within(container).getAllByLabelText("Move Plan down") as HTMLButtonElement[]
    ).find((button) => !button.disabled);
    if (!movePlanDown) {
      throw new Error("Expected an enabled move-down control for Plan.");
    }

    fireEvent.click(movePlanDown);

    expect(onDriverOrderChange).toHaveBeenCalledWith([
      "recent_messages",
      "plan",
      "context_compaction",
      "long_term_memory",
      "token_budget",
      "execution_state",
    ]);
  });

  it("reorders drivers with drag and drop", () => {
    const { onDriverOrderChange, container } = renderPanel();

    const rows = container.querySelectorAll<HTMLDivElement>(".atlas-driver-row");
    const source = rows[0];
    const target = rows[2];
    const dataTransfer = {
      setData: vi.fn(),
      getData: vi.fn(() => "plan"),
      effectAllowed: "",
    } as unknown as DataTransfer;

    fireEvent.dragStart(source, { dataTransfer });
    fireEvent.dragOver(target, { dataTransfer });
    fireEvent.drop(target, { dataTransfer });

    expect(onDriverOrderChange).toHaveBeenCalledWith([
      "recent_messages",
      "plan",
      "context_compaction",
      "long_term_memory",
      "token_budget",
      "execution_state",
    ]);
  });

  it("changes detail level from toolbar", () => {
    const { onDetailLevelChange, container } = renderPanel({
      detailLevel: "concise",
    });

    fireEvent.click(within(container).getByRole("button", { name: "Detailed" }));

    expect(onDetailLevelChange).toHaveBeenCalledWith("detailed");
  });
});
