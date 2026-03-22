import { describe, expect, it } from "vitest";
import {
  getDiffStatusBadgeTone,
  getDiffStatusLabel,
  getDiffStatusMetadata,
  getStatusSymbol,
  getStatusTone,
} from "./GitDiffPanel.utils";

describe("GitDiffPanel.utils", () => {
  it("returns shared metadata for canonical git diff statuses", () => {
    expect(getDiffStatusMetadata("A")).toEqual({
      symbol: "+",
      tone: "added",
      badgeTone: "success",
      label: "Added",
    });
    expect(getDiffStatusMetadata("modified")).toEqual({
      symbol: "?",
      tone: "neutral",
      badgeTone: "warning",
      label: "Modified",
    });
    expect(getDiffStatusMetadata("T")).toEqual({
      symbol: "T",
      tone: "neutral",
      badgeTone: "neutral",
      label: "Type changed",
    });
    expect(getDiffStatusMetadata("??")).toEqual({
      symbol: "?",
      tone: "neutral",
      badgeTone: "neutral",
      label: "??",
    });
  });

  it("keeps legacy helpers aligned with shared metadata", () => {
    expect(getStatusSymbol("A")).toBe("+");
    expect(getStatusTone("M")).toBe("modified");
    expect(getDiffStatusBadgeTone("deleted")).toBe("danger");
    expect(getDiffStatusLabel("renamed")).toBe("Renamed");
  });
});
