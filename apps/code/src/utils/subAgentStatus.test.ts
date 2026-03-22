import { describe, expect, it } from "vitest";
import {
  getSubAgentSignalLabel,
  getSubAgentTone,
  isBlockingSubAgentStatus,
  resolveSubAgentSignalLabel,
} from "./subAgentStatus";

describe("subAgentStatus", () => {
  it("maps sub-agent statuses to consistent review badge tones", () => {
    expect(getSubAgentTone("running")).toBe("accent");
    expect(getSubAgentTone("awaiting_approval")).toBe("warning");
    expect(getSubAgentTone("completed")).toBe("success");
    expect(getSubAgentTone("failed")).toBe("danger");
    expect(getSubAgentTone("interrupted")).toBe("neutral");
    expect(getSubAgentTone("unknown")).toBe("neutral");
  });

  it("marks blocking statuses through one helper", () => {
    expect(isBlockingSubAgentStatus("awaiting_approval")).toBe(true);
    expect(isBlockingSubAgentStatus("blocked")).toBe(true);
    expect(isBlockingSubAgentStatus("timed_out")).toBe(true);
    expect(isBlockingSubAgentStatus("cancelled")).toBe(true);
    expect(isBlockingSubAgentStatus("completed")).toBe(false);
  });

  it("resolves mission signals with the existing priority order", () => {
    expect(getSubAgentSignalLabel("timeout")).toBe("Sub-agent timed out");
    expect(resolveSubAgentSignalLabel(["completed", "blocked", "running"])).toBe(
      "Sub-agent blocked"
    );
    expect(resolveSubAgentSignalLabel(["completed", "running"])).toBe("Sub-agent completed");
    expect(resolveSubAgentSignalLabel([])).toBeNull();
  });
});
