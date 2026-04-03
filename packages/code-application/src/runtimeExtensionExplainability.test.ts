import { describe, expect, it } from "vitest";
import type { RuntimeAgentControl } from "@ku0/code-runtime-webmcp-client/webMcpBridgeTypes";
import { readRuntimeSkillBackedToolPublicationDecision } from "./runtimeExtensionExplainability";

describe("runtimeExtensionExplainability", () => {
  it("explains hidden and published runtime skill-backed tool publication from activation truth", async () => {
    const runtimeControl = {
      readRuntimeExecutableSkills: async () => ({
        catalogSessionId: null,
        fallbackToLegacyTransport: false,
        entries: [
          {
            canonicalSkillId: "core-read",
            runtimeSkillId: "core-read",
            acceptedSkillIds: ["core-read"],
            availability: {
              invocationId: "core-read",
              live: true,
              activationState: "active",
              publicationStatus: "published",
              publicationReason:
                "Published because activation-backed runtime skill core-read is active: Ready for workspace reads.",
              readiness: {
                state: "ready",
                summary: "Ready for workspace reads.",
                detail: "Activation-backed runtime read skill is available.",
              },
            },
            source: null,
            metadata: null,
          },
          {
            canonicalSkillId: "core-write",
            runtimeSkillId: "core-write",
            acceptedSkillIds: ["core-write"],
            availability: {
              invocationId: "core-write",
              live: false,
              activationState: "degraded",
              publicationStatus: "hidden",
              publicationReason:
                "Hidden because activation-backed runtime skill core-write is degraded: Awaiting runtime write binding.",
              readiness: {
                state: "attention",
                summary: "Awaiting runtime write binding.",
                detail: "Activation-backed runtime write skill is not currently executable.",
              },
            },
            source: null,
            metadata: null,
          },
        ],
      }),
    } satisfies Pick<RuntimeAgentControl, "readRuntimeExecutableSkills"> as RuntimeAgentControl;

    const decision = await readRuntimeSkillBackedToolPublicationDecision(runtimeControl);

    expect(decision?.publishedToolNames).toContain("read-workspace-file");
    expect(decision?.hiddenToolNames).toContain("write-workspace-file");
    expect(decision?.hiddenToolNames).toContain("search-workspace-files");

    const publishedEntry = decision?.entries.find(
      (entry) => entry.toolName === "read-workspace-file"
    );
    expect(publishedEntry?.status).toBe("published");
    expect(publishedEntry?.reason).toContain("core-read");
    expect(publishedEntry?.reason).toContain("active");

    const degradedEntry = decision?.entries.find(
      (entry) => entry.toolName === "write-workspace-file"
    );
    expect(degradedEntry?.status).toBe("hidden");
    expect(degradedEntry?.reason).toContain("core-write");
    expect(degradedEntry?.reason).toContain("degraded");

    const missingEntry = decision?.entries.find(
      (entry) => entry.toolName === "search-workspace-files"
    );
    expect(missingEntry?.status).toBe("hidden");
    expect(missingEntry?.reason).toContain("not present in the current executable skill catalog");
  });
});
