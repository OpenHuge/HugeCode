/** @vitest-environment jsdom */
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { DsSelect } from "./SelectPrimitives";

describe("DsSelect", () => {
  it("selects a single option and closes menu", () => {
    const onValueChange = vi.fn();
    render(
      <DsSelect
        ariaLabel="Model"
        options={[
          { value: "gpt-5.3", label: "GPT-5.3 Codex" },
          { value: "gpt-5.2", label: "GPT-5.2 Codex" },
        ]}
        value="gpt-5.3"
        onValueChange={onValueChange}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "Model" }));
    fireEvent.click(screen.getByRole("option", { name: "GPT-5.2 Codex" }));

    expect(onValueChange).toHaveBeenCalledWith("gpt-5.2");
    expect(screen.queryByRole("listbox")).toBeNull();
  });

  it("toggles values in multiple mode", () => {
    const onValuesChange = vi.fn();
    render(
      <DsSelect
        ariaLabel="Routing accounts"
        multiple
        options={[
          { value: "acc-1", label: "Account 1" },
          { value: "acc-2", label: "Account 2" },
        ]}
        values={["acc-1"]}
        onValuesChange={onValuesChange}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "Routing accounts" }));
    fireEvent.click(screen.getByRole("option", { name: "Account 2" }));
    fireEvent.click(screen.getByRole("option", { name: "Account 1" }));

    expect(onValuesChange).toHaveBeenNthCalledWith(1, ["acc-1", "acc-2"]);
    expect(onValuesChange).toHaveBeenNthCalledWith(2, []);
  });

  it("uses a portal and flips upward when there is not enough space below", async () => {
    const onValueChange = vi.fn();
    const originalInnerHeight = window.innerHeight;
    Object.defineProperty(window, "innerHeight", {
      configurable: true,
      value: 400,
    });

    render(
      <DsSelect
        ariaLabel="Thinking mode"
        options={[
          { value: "low", label: "low" },
          { value: "medium", label: "medium" },
          { value: "high", label: "high" },
          { value: "xhigh", label: "xhigh" },
          { value: "max", label: "max" },
          { value: "ultra", label: "ultra" },
        ]}
        value="medium"
        onValueChange={onValueChange}
      />
    );

    const trigger = screen.getByRole("button", { name: "Thinking mode" });
    const container = trigger.closest(".ds-select") as HTMLDivElement;
    const originalContainerRect = container.getBoundingClientRect.bind(container);
    const originalTriggerRect = trigger.getBoundingClientRect.bind(trigger);
    const mockedRect = () =>
      ({
        x: 16,
        y: 340,
        left: 16,
        top: 340,
        right: 206,
        bottom: 372,
        width: 190,
        height: 32,
        toJSON: () => ({}),
      }) as DOMRect;
    container.getBoundingClientRect = mockedRect;
    trigger.getBoundingClientRect = mockedRect;

    fireEvent.click(trigger);

    await waitFor(() => {
      const listbox = screen.getByRole("listbox", { name: "Thinking mode" });
      expect(listbox.className).toContain("is-up");
      expect(container.contains(listbox)).toBe(false);
    });

    container.getBoundingClientRect = originalContainerRect;
    trigger.getBoundingClientRect = originalTriggerRect;
    Object.defineProperty(window, "innerHeight", {
      configurable: true,
      value: originalInnerHeight,
    });
  });

  it("supports trigger-aligned menu sizing with width constraints", async () => {
    const onValueChange = vi.fn();
    const originalInnerWidth = window.innerWidth;
    Object.defineProperty(window, "innerWidth", {
      configurable: true,
      value: 760,
    });

    render(
      <DsSelect
        ariaLabel="Model"
        options={[
          { value: "gpt-5.3", label: "GPT-5.3 Codex" },
          { value: "claude", label: "Claude Sonnet 4.5 (unavailable)" },
        ]}
        value="gpt-5.3"
        onValueChange={onValueChange}
        menuWidthMode="trigger"
        minMenuWidth={180}
        maxMenuWidth={220}
      />
    );

    const trigger = screen.getAllByRole("button", { name: "Model" }).at(-1);
    expect(trigger).toBeTruthy();
    if (!trigger) {
      throw new Error("Expected Model select trigger");
    }
    const originalTriggerRect = trigger.getBoundingClientRect.bind(trigger);
    trigger.getBoundingClientRect = () =>
      ({
        x: 100,
        y: 120,
        left: 100,
        top: 120,
        right: 190,
        bottom: 148,
        width: 90,
        height: 28,
        toJSON: () => ({}),
      }) as DOMRect;

    fireEvent.click(trigger);

    await waitFor(() => {
      const listbox = screen.getAllByRole("listbox", { name: "Model" }).at(-1);
      expect(listbox).toBeTruthy();
      if (!listbox) {
        throw new Error("Expected Model listbox");
      }
      expect((listbox as HTMLElement).style.width).toBe("180px");
    });

    trigger.getBoundingClientRect = originalTriggerRect;
    Object.defineProperty(window, "innerWidth", {
      configurable: true,
      value: originalInnerWidth,
    });
  });

  it("supports end-aligned menu anchoring", async () => {
    const onValueChange = vi.fn();
    const originalInnerWidth = window.innerWidth;
    Object.defineProperty(window, "innerWidth", {
      configurable: true,
      value: 760,
    });

    render(
      <DsSelect
        ariaLabel="Model"
        options={[
          { value: "gpt-5.3", label: "GPT-5.3 Codex" },
          { value: "claude", label: "Claude Sonnet 4.5 (unavailable)" },
        ]}
        value="gpt-5.3"
        onValueChange={onValueChange}
        menuWidthMode="trigger"
        minMenuWidth={180}
        anchorAlign="end"
      />
    );

    const trigger = screen.getAllByRole("button", { name: "Model" }).at(-1);
    expect(trigger).toBeTruthy();
    if (!trigger) {
      throw new Error("Expected Model select trigger");
    }
    const originalTriggerRect = trigger.getBoundingClientRect.bind(trigger);
    trigger.getBoundingClientRect = () =>
      ({
        x: 240,
        y: 120,
        left: 240,
        top: 120,
        right: 330,
        bottom: 148,
        width: 90,
        height: 28,
        toJSON: () => ({}),
      }) as DOMRect;

    fireEvent.click(trigger);

    await waitFor(() => {
      const listbox = screen.getAllByRole("listbox", { name: "Model" }).at(-1);
      expect(listbox).toBeTruthy();
      if (!listbox) {
        throw new Error("Expected Model listbox");
      }
      expect((listbox as HTMLElement).style.left).toBe("150px");
      expect((listbox as HTMLElement).style.width).toBe("180px");
    });

    trigger.getBoundingClientRect = originalTriggerRect;
    Object.defineProperty(window, "innerWidth", {
      configurable: true,
      value: originalInnerWidth,
    });
  });

  it("supports auto anchoring by preferring the side with less overflow", async () => {
    const onValueChange = vi.fn();
    const originalInnerWidth = window.innerWidth;
    Object.defineProperty(window, "innerWidth", {
      configurable: true,
      value: 760,
    });

    render(
      <DsSelect
        ariaLabel="Model"
        options={[
          { value: "gpt-5.3", label: "GPT-5.3 Codex" },
          { value: "claude", label: "Claude Sonnet 4.5 (unavailable)" },
        ]}
        value="gpt-5.3"
        onValueChange={onValueChange}
        menuWidthMode="trigger"
        minMenuWidth={200}
        anchorAlign="auto"
      />
    );

    const trigger = screen.getAllByRole("button", { name: "Model" }).at(-1);
    expect(trigger).toBeTruthy();
    if (!trigger) {
      throw new Error("Expected Model select trigger");
    }
    const originalTriggerRect = trigger.getBoundingClientRect.bind(trigger);
    trigger.getBoundingClientRect = () =>
      ({
        x: 620,
        y: 120,
        left: 620,
        top: 120,
        right: 700,
        bottom: 148,
        width: 80,
        height: 28,
        toJSON: () => ({}),
      }) as DOMRect;

    fireEvent.click(trigger);

    await waitFor(() => {
      const listbox = screen.getAllByRole("listbox", { name: "Model" }).at(-1);
      expect(listbox).toBeTruthy();
      if (!listbox) {
        throw new Error("Expected Model listbox");
      }
      expect((listbox as HTMLElement).style.left).toBe("500px");
      expect((listbox as HTMLElement).style.width).toBe("200px");
    });

    trigger.getBoundingClientRect = originalTriggerRect;
    Object.defineProperty(window, "innerWidth", {
      configurable: true,
      value: originalInnerWidth,
    });
  });

  it("aligns trigger-sized menus to scoped anchor geometry when an anchor wrapper is present", async () => {
    const onValueChange = vi.fn();

    render(
      <div data-ds-select-anchor>
        <DsSelect
          ariaLabel="Agent access"
          options={[
            { value: "read-only", label: "Read only" },
            { value: "current", label: "On-Request" },
            { value: "full-access", label: "Full access" },
          ]}
          value="current"
          onValueChange={onValueChange}
          menuWidthMode="trigger"
          menuClassName="composer-select-menu"
        />
      </div>
    );

    const trigger = screen.getAllByRole("button", { name: "Agent access" }).at(-1);
    expect(trigger).toBeTruthy();
    if (!trigger) {
      throw new Error("Expected Agent access select trigger");
    }
    const container = trigger.closest(".ds-select");
    if (!container) {
      throw new Error("Expected select container");
    }
    const scopedAnchor = container.closest("[data-ds-select-anchor]") as HTMLDivElement | null;
    if (!scopedAnchor) {
      throw new Error("Expected scoped select anchor");
    }

    const originalTriggerRect = trigger.getBoundingClientRect.bind(trigger);
    const originalContainerRect = container.getBoundingClientRect.bind(container);
    const originalScopedAnchorRect = scopedAnchor.getBoundingClientRect.bind(scopedAnchor);
    trigger.getBoundingClientRect = () =>
      ({
        x: 160,
        y: 140,
        left: 160,
        top: 140,
        right: 234,
        bottom: 170,
        width: 74,
        height: 30,
        toJSON: () => ({}),
      }) as DOMRect;
    container.getBoundingClientRect = () =>
      ({
        x: 132,
        y: 140,
        left: 132,
        top: 140,
        right: 232,
        bottom: 170,
        width: 100,
        height: 30,
        toJSON: () => ({}),
      }) as DOMRect;
    scopedAnchor.getBoundingClientRect = () =>
      ({
        x: 118,
        y: 140,
        left: 118,
        top: 140,
        right: 236,
        bottom: 170,
        width: 118,
        height: 30,
        toJSON: () => ({}),
      }) as DOMRect;

    fireEvent.click(trigger);

    await waitFor(() => {
      const listbox = screen.getAllByRole("listbox", { name: "Agent access" }).at(-1);
      expect(listbox).toBeTruthy();
      if (!listbox) {
        throw new Error("Expected Agent access listbox");
      }
      expect((listbox as HTMLElement).style.left).toBe("118px");
      expect((listbox as HTMLElement).style.width).toBe("118px");
      expect((listbox as HTMLElement).style.minWidth).toBe("118px");
    });

    trigger.getBoundingClientRect = originalTriggerRect;
    container.getBoundingClientRect = originalContainerRect;
    scopedAnchor.getBoundingClientRect = originalScopedAnchorRect;
  });

  it("caps compact viewport menu minimum width for trigger-aligned selects", async () => {
    const onValueChange = vi.fn();
    const originalInnerWidth = window.innerWidth;
    Object.defineProperty(window, "innerWidth", {
      configurable: true,
      value: 390,
    });

    render(
      <DsSelect
        ariaLabel="Model"
        options={[
          { value: "gpt-5.3", label: "GPT-5.3 Codex" },
          { value: "claude", label: "Claude Sonnet 4.5 (unavailable)" },
        ]}
        value="gpt-5.3"
        onValueChange={onValueChange}
        menuWidthMode="trigger"
        minMenuWidth={240}
      />
    );

    const trigger = screen.getAllByRole("button", { name: "Model" }).at(-1);
    expect(trigger).toBeTruthy();
    if (!trigger) {
      throw new Error("Expected Model select trigger");
    }
    const originalTriggerRect = trigger.getBoundingClientRect.bind(trigger);
    trigger.getBoundingClientRect = () =>
      ({
        x: 100,
        y: 120,
        left: 100,
        top: 120,
        right: 184,
        bottom: 142,
        width: 84,
        height: 22,
        toJSON: () => ({}),
      }) as DOMRect;

    fireEvent.click(trigger);

    await waitFor(() => {
      const listbox = screen.getAllByRole("listbox", { name: "Model" }).at(-1);
      expect(listbox).toBeTruthy();
      if (!listbox) {
        throw new Error("Expected Model listbox");
      }
      expect((listbox as HTMLElement).style.width).toBe("175px");
    });

    trigger.getBoundingClientRect = originalTriggerRect;
    Object.defineProperty(window, "innerWidth", {
      configurable: true,
      value: originalInnerWidth,
    });
  });

  it("uses custom menu gap when positioning", async () => {
    const onValueChange = vi.fn();

    render(
      <DsSelect
        ariaLabel="Model"
        options={[
          { value: "gpt-5.3", label: "GPT-5.3 Codex" },
          { value: "gpt-5.2", label: "GPT-5.2 Codex" },
        ]}
        value="gpt-5.3"
        onValueChange={onValueChange}
        menuGap={2}
      />
    );

    const trigger = screen.getAllByRole("button", { name: "Model" }).at(-1);
    expect(trigger).toBeTruthy();
    if (!trigger) {
      throw new Error("Expected Model select trigger");
    }
    const originalTriggerRect = trigger.getBoundingClientRect.bind(trigger);
    trigger.getBoundingClientRect = () =>
      ({
        x: 100,
        y: 120,
        left: 100,
        top: 120,
        right: 260,
        bottom: 150,
        width: 160,
        height: 30,
        toJSON: () => ({}),
      }) as DOMRect;

    fireEvent.click(trigger);

    await waitFor(() => {
      const listbox = screen.getAllByRole("listbox", { name: "Model" }).at(-1);
      expect(listbox).toBeTruthy();
      if (!listbox) {
        throw new Error("Expected Model listbox");
      }
      expect((listbox as HTMLElement).style.top).toBe("152px");
    });

    trigger.getBoundingClientRect = originalTriggerRect;
  });

  it("uses visual viewport dimensions without introducing offset drift", async () => {
    const onValueChange = vi.fn();
    const originalInnerWidth = window.innerWidth;
    const originalInnerHeight = window.innerHeight;
    const originalVisualViewportDescriptor = Object.getOwnPropertyDescriptor(
      window,
      "visualViewport"
    );
    Object.defineProperty(window, "innerWidth", {
      configurable: true,
      value: 1200,
    });
    Object.defineProperty(window, "innerHeight", {
      configurable: true,
      value: 900,
    });
    Object.defineProperty(window, "visualViewport", {
      configurable: true,
      value: {
        width: 320,
        height: 280,
        offsetLeft: 40,
        offsetTop: 30,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      },
    });

    try {
      render(
        <DsSelect
          ariaLabel="Model"
          options={[
            { value: "gpt-5.3", label: "GPT-5.3 Codex" },
            { value: "gpt-5.2", label: "GPT-5.2 Codex" },
          ]}
          value="gpt-5.3"
          onValueChange={onValueChange}
        />
      );

      const trigger = screen.getAllByRole("button", { name: "Model" }).at(-1);
      expect(trigger).toBeTruthy();
      if (!trigger) {
        throw new Error("Expected Model select trigger");
      }
      const originalTriggerRect = trigger.getBoundingClientRect.bind(trigger);
      trigger.getBoundingClientRect = () =>
        ({
          x: 100,
          y: 120,
          left: 100,
          top: 120,
          right: 260,
          bottom: 150,
          width: 160,
          height: 30,
          toJSON: () => ({}),
        }) as DOMRect;

      fireEvent.click(trigger);

      await waitFor(() => {
        const listbox = screen.getAllByRole("listbox", { name: "Model" }).at(-1);
        expect(listbox).toBeTruthy();
        if (!listbox) {
          throw new Error("Expected Model listbox");
        }
        expect((listbox as HTMLElement).style.left).toBe("100px");
        expect((listbox as HTMLElement).style.top).toBe("154px");
      });

      trigger.getBoundingClientRect = originalTriggerRect;
    } finally {
      if (originalVisualViewportDescriptor) {
        Object.defineProperty(window, "visualViewport", originalVisualViewportDescriptor);
      } else {
        // Align with test setup where visualViewport may be absent.
        Reflect.deleteProperty(window, "visualViewport");
      }
      Object.defineProperty(window, "innerWidth", {
        configurable: true,
        value: originalInnerWidth,
      });
      Object.defineProperty(window, "innerHeight", {
        configurable: true,
        value: originalInnerHeight,
      });
    }
  });

  it("repositions an open menu when trigger geometry changes", async () => {
    const onValueChange = vi.fn();

    render(
      <DsSelect
        ariaLabel="Model"
        options={[
          { value: "gpt-5.3", label: "GPT-5.3 Codex" },
          { value: "gpt-5.2", label: "GPT-5.2 Codex" },
        ]}
        value="gpt-5.3"
        onValueChange={onValueChange}
      />
    );

    const trigger = screen.getAllByRole("button", { name: "Model" }).at(-1);
    expect(trigger).toBeTruthy();
    if (!trigger) {
      throw new Error("Expected Model select trigger");
    }
    const originalTriggerRect = trigger.getBoundingClientRect.bind(trigger);
    const createRect = (left: number, top: number) =>
      ({
        x: left,
        y: top,
        left,
        top,
        right: left + 180,
        bottom: top + 32,
        width: 180,
        height: 32,
        toJSON: () => ({}),
      }) as DOMRect;
    let currentRect = createRect(120, 140);
    trigger.getBoundingClientRect = () => currentRect;

    fireEvent.click(trigger);

    const getCurrentListbox = () => {
      const listboxId = trigger.getAttribute("aria-controls");
      return listboxId ? document.getElementById(listboxId) : null;
    };

    await waitFor(() => {
      const listbox = getCurrentListbox();
      expect(listbox).toBeTruthy();
      expect((listbox as HTMLElement).style.left).toBe("120px");
      expect((listbox as HTMLElement).style.top).toBe("178px");
    });

    currentRect = createRect(260, 180);

    fireEvent(window, new Event("resize"));

    await waitFor(() => {
      const listbox = getCurrentListbox();
      expect(listbox).toBeTruthy();
      expect((listbox as HTMLElement).style.left).toBe("260px");
      expect((listbox as HTMLElement).style.top).toBe("218px");
    });

    trigger.getBoundingClientRect = originalTriggerRect;
  });

  it("keeps menu open and repositions when trigger is clicked while menu is offscreen", async () => {
    const onValueChange = vi.fn();

    render(
      <DsSelect
        ariaLabel="Model"
        options={[
          { value: "gpt-5.3", label: "GPT-5.3 Codex" },
          { value: "gpt-5.2", label: "GPT-5.2 Codex" },
        ]}
        value="gpt-5.3"
        onValueChange={onValueChange}
      />
    );

    const trigger = screen.getAllByRole("button", { name: "Model" }).at(-1);
    expect(trigger).toBeTruthy();
    if (!trigger) {
      throw new Error("Expected Model select trigger");
    }

    fireEvent.click(trigger);

    const listboxId = trigger.getAttribute("aria-controls");
    if (!listboxId) {
      throw new Error("Expected Model listbox id");
    }
    const listbox = document.getElementById(listboxId);
    if (!listbox) {
      throw new Error("Expected Model listbox");
    }
    const originalListboxRect = listbox.getBoundingClientRect.bind(listbox);
    listbox.getBoundingClientRect = () =>
      ({
        x: -400,
        y: -300,
        left: -400,
        top: -300,
        right: -200,
        bottom: -200,
        width: 200,
        height: 100,
        toJSON: () => ({}),
      }) as DOMRect;

    fireEvent.click(trigger);

    await waitFor(() => {
      expect(trigger.getAttribute("aria-expanded")).toBe("true");
      expect(document.getElementById(listboxId)).toBeTruthy();
    });

    listbox.getBoundingClientRect = originalListboxRect;
  });

  it("supports keyboard navigation and escape close", async () => {
    const onValueChange = vi.fn();

    render(
      <DsSelect
        ariaLabel="Thinking mode"
        options={[
          { value: "low", label: "low" },
          { value: "medium", label: "medium" },
          { value: "high", label: "high" },
        ]}
        value="medium"
        onValueChange={onValueChange}
      />
    );

    const trigger = screen.getAllByRole("button", { name: "Thinking mode" }).at(-1);
    expect(trigger).toBeTruthy();
    if (!trigger) {
      throw new Error("Expected Thinking mode select trigger");
    }
    fireEvent.keyDown(trigger, { key: "ArrowDown" });

    await waitFor(() => {
      expect(trigger.getAttribute("aria-expanded")).toBe("true");
      expect(trigger.getAttribute("aria-controls")).toBeTruthy();
    });

    const listboxId = trigger.getAttribute("aria-controls");
    if (!listboxId) {
      throw new Error("Expected Thinking mode listbox id");
    }
    const listbox = document.getElementById(listboxId);
    if (!listbox) {
      throw new Error("Expected Thinking mode listbox");
    }
    fireEvent.keyDown(listbox, { key: "ArrowDown" });

    await waitFor(() => {
      expect(document.activeElement?.getAttribute("role")).toBe("option");
    });

    fireEvent.keyDown(listbox, { key: "Escape" });

    await waitFor(() => {
      expect(document.getElementById(listboxId)).toBeNull();
      expect(trigger.getAttribute("aria-expanded")).toBe("false");
      expect(document.activeElement).toBe(trigger);
    });
  });
});
