import { describe, expect, it } from "vitest";
import { resolveThreadConnectionPresentation } from "./threadConnectionPresentation";

describe("threadConnectionPresentation", () => {
  it("resolves a single presentation contract for each thread connection state", () => {
    expect(resolveThreadConnectionPresentation("live")).toEqual({
      label: "Live",
      title: "Receiving live thread events",
      tone: "success",
    });
    expect(resolveThreadConnectionPresentation("syncing")).toEqual({
      label: "Syncing",
      title: "Connected, syncing thread state",
      tone: "progress",
    });
    expect(resolveThreadConnectionPresentation("fallback")).toEqual({
      label: "Fallback",
      title: "Live stream degraded, using polling fallback",
      tone: "warning",
    });
    expect(resolveThreadConnectionPresentation("offline")).toEqual({
      label: "Offline",
      title: "Disconnected from backend",
      tone: "default",
    });
  });
});
