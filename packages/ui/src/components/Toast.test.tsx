// @vitest-environment jsdom
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Button } from "./Button";
import { ToastProvider, useToast } from "./Toast";

function ToastHarness() {
  const { addToast } = useToast();

  return (
    <Button
      onClick={() =>
        addToast({
          title: "Checkpoint ready",
          description: "The runtime summary is ready for continuation review.",
          type: "success",
        })
      }
    >
      Add toast
    </Button>
  );
}

describe("ToastProvider", () => {
  it("renders toasts from context and lets the user dismiss them", () => {
    render(
      <ToastProvider>
        <ToastHarness />
      </ToastProvider>
    );

    fireEvent.click(screen.getByRole("button", { name: "Add toast" }));

    const alert = screen.getByRole("alert");
    expect(alert.textContent).toContain("Checkpoint ready");
    expect(alert.textContent).toContain("The runtime summary is ready for continuation review.");

    fireEvent.click(screen.getByRole("button", { name: "关闭通知" }));
    expect(screen.queryByRole("alert")).toBeNull();
  });
});
