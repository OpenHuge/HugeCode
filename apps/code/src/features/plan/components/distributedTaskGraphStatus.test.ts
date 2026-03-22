import { describe, expect, it } from "vitest";
import {
  getDistributedTaskGraphStatusLabel,
  getDistributedTaskGraphStatusTone,
} from "./distributedTaskGraphStatus";

describe("distributedTaskGraphStatus", () => {
  it("maps canonical task statuses to labels", () => {
    expect(getDistributedTaskGraphStatusLabel("completed")).toBe("Done");
    expect(getDistributedTaskGraphStatusLabel("running")).toBe("Running");
    expect(getDistributedTaskGraphStatusLabel("failed")).toBe("Failed");
    expect(getDistributedTaskGraphStatusLabel("queued")).toBe("Queued");
    expect(getDistributedTaskGraphStatusLabel("blocked")).toBe("Blocked");
    expect(getDistributedTaskGraphStatusLabel("canceled")).toBe("Canceled");
    expect(getDistributedTaskGraphStatusLabel("pending")).toBe("Pending");
  });

  it("maps canonical task statuses to tones", () => {
    expect(getDistributedTaskGraphStatusTone("completed")).toBe("success");
    expect(getDistributedTaskGraphStatusTone("running")).toBe("progress");
    expect(getDistributedTaskGraphStatusTone("failed")).toBe("error");
    expect(getDistributedTaskGraphStatusTone("blocked")).toBe("warning");
    expect(getDistributedTaskGraphStatusTone("queued")).toBe("default");
    expect(getDistributedTaskGraphStatusTone("pending")).toBe("default");
  });
});
