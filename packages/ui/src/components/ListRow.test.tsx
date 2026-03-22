// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ListRow } from "../index";

describe("ListRow", () => {
  it("keeps shared list-row primitives consumable through @ku0/ui", () => {
    render(
      <ListRow
        title="Review ready"
        description="Open the latest validation summary."
        trailing={<span>Open</span>}
      />
    );

    expect(screen.getByText("Review ready")).toBeTruthy();
    expect(screen.getByText("Open the latest validation summary.")).toBeTruthy();
    expect(screen.getByText("Open")).toBeTruthy();
  });
});
