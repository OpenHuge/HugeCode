import { describe, expect, it } from "vitest";
import * as publicUi from "./index";

describe("@ku0/ui public API", () => {
  it("keeps the root barrel focused on UI exports", () => {
    expect(publicUi.Button).toBeDefined();
    expect("useAuth" in publicUi).toBe(false);
    expect("useFeed" in publicUi).toBe(false);
    expect("apiClient" in publicUi).toBe(false);
  });

  it("re-exports the closed shell, row/meta, and status families from the shared design system", () => {
    expect(publicUi.ShellFrame).toBeDefined();
    expect(publicUi.ShellSection).toBeDefined();
    expect(publicUi.ShellToolbar).toBeDefined();
    expect(publicUi.SplitPanel).toBeDefined();
    expect(publicUi.SectionHeader).toBeDefined();
    expect(publicUi.MetadataList).toBeDefined();
    expect(publicUi.MetadataRow).toBeDefined();
    expect(publicUi.InlineActionRow).toBeDefined();
    expect(publicUi.StatusBadge).toBeDefined();
    expect(publicUi.Surface).toBeDefined();
  });
});
