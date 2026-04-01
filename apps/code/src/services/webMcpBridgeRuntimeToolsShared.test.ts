import { describe, expect, it, vi } from "vitest";
import {
  buildRuntimeAllowedSkillResolution,
  getRuntimeLiveSkillCatalogIndex,
  resolveProviderModelFromInputAndAgent,
  resolveProviderModelFromInputAndAgentWithSource,
  validateAllowedRuntimeSkillIds,
} from "./webMcpBridgeRuntimeToolsShared";

const toNonEmptyString = (value: unknown): string | null =>
  typeof value === "string" && value.trim().length > 0 ? value.trim() : null;

describe("webMcpBridgeRuntimeToolsShared caller context resolution", () => {
  it("reports explicit source when explicit provider/model inputs are present", () => {
    const resolution = resolveProviderModelFromInputAndAgentWithSource(
      { provider: " anthropic " },
      {
        model: {
          provider: "openai",
          id: " gpt-5.3-codex ",
        },
      },
      { toNonEmptyString }
    );

    expect(resolution).toEqual({
      provider: "anthropic",
      modelId: "gpt-5.3-codex",
      source: "explicit",
    });
  });

  it("reports agent source when values are inferred from agent metadata only", () => {
    const resolution = resolveProviderModelFromInputAndAgentWithSource(
      {},
      {
        context: {
          provider: " google ",
          model_id: " gemini-2.5-pro ",
        },
      },
      { toNonEmptyString }
    );

    expect(resolution).toEqual({
      provider: "google",
      modelId: "gemini-2.5-pro",
      source: "agent",
    });
  });

  it("reports none source when no provider/model can be resolved", () => {
    const resolution = resolveProviderModelFromInputAndAgentWithSource(
      { provider: "   ", modelId: "" },
      {
        context: {
          provider: " ",
          modelId: "",
        },
      },
      { toNonEmptyString }
    );

    expect(resolution).toEqual({
      provider: null,
      modelId: null,
      source: "none",
    });
  });

  it("keeps legacy helper behavior for provider/model return shape", () => {
    const resolution = resolveProviderModelFromInputAndAgent(
      {},
      {
        provider: "openai",
        modelId: "gpt-5.3-codex",
      },
      { toNonEmptyString }
    );

    expect(resolution).toEqual({
      provider: "openai",
      modelId: "gpt-5.3-codex",
    });
  });
});

describe("webMcpBridgeRuntimeToolsShared delegated skill resolution", () => {
  it("prefers activation-backed runtime invocations over legacy live skill listings", async () => {
    const listRuntimeInvocations = vi.fn(async () => [
      {
        id: "session.review",
        title: "Session Review",
        version: "1.0.0",
        kind: "skill",
        bindingStage: "session_overlay",
        live: true,
        activationState: "active",
        readiness: {
          state: "ready",
          summary: "Overlay is active.",
          detail: "Overlay-backed review flow is ready.",
        },
        diagnostics: [],
        transitionHistory: [],
        source: {
          activationId: "overlay:session-1:review",
          sourceType: "session_overlay",
          sourceScope: "session_overlay",
          sourceRef: "session.review",
          pluginId: "session.review",
          packageRef: null,
          overlayId: "review",
          sessionId: "session-1",
        },
        metadata: {
          runtimeSkillId: "session.review",
          aliases: ["session-review"],
        },
      },
    ]);
    const listLiveSkills = vi.fn(async () => [
      {
        id: "legacy-review",
        aliases: ["session-review"],
      },
    ]);

    const catalog = await getRuntimeLiveSkillCatalogIndex(
      {
        listRuntimeInvocations,
        listLiveSkills,
      } as never,
      { sessionId: "session-1" }
    );

    expect(listRuntimeInvocations).toHaveBeenCalledWith({
      sessionId: "session-1",
      kind: "skill",
    });
    expect(listLiveSkills).not.toHaveBeenCalled();
    expect(catalog?.catalogSessionId).toBe("session-1");
    expect(catalog?.entriesByCanonicalSkillId.get("session.review")).toMatchObject({
      invocationId: "session.review",
      live: true,
      activationState: "active",
    });
  });

  it("consumes shared executable-skill readers when they are exposed on runtime control", async () => {
    const readRuntimeExecutableSkills = vi.fn(async () => ({
      catalogSessionId: "session-2",
      fallbackToLegacyTransport: false,
      entries: [
        {
          canonicalSkillId: "session.review",
          runtimeSkillId: "session.review",
          acceptedSkillIds: ["session.review", "review-skill"],
          availability: {
            invocationId: "session.review",
            live: true,
            activationState: "active" as const,
            publicationStatus: "published" as const,
            publicationReason:
              "Published because activation-backed runtime skill session.review is active: Ready.",
            readiness: {
              state: "ready" as const,
              summary: "Ready.",
              detail: "Overlay-backed skill is ready.",
            },
          },
          source: null,
          metadata: null,
        },
      ],
    }));
    const listRuntimeInvocations = vi.fn(async () => []);

    const catalog = await getRuntimeLiveSkillCatalogIndex(
      {
        readRuntimeExecutableSkills,
        listRuntimeInvocations,
      } as never,
      { sessionId: "session-2" }
    );

    expect(readRuntimeExecutableSkills).toHaveBeenCalledWith({
      sessionId: "session-2",
    });
    expect(listRuntimeInvocations).not.toHaveBeenCalled();
    expect(catalog?.catalogSessionId).toBe("session-2");
    expect(catalog?.knownSkillIds.has("review-skill")).toBe(true);
  });

  it("falls back to live skill listings only when invocation catalog is unavailable", async () => {
    const listLiveSkills = vi.fn(async () => [
      {
        id: "core-grep",
        aliases: ["grep", "search"],
      },
    ]);

    const catalog = await getRuntimeLiveSkillCatalogIndex(
      {
        listLiveSkills,
      } as never,
      { sessionId: "session-ignored" }
    );

    expect(listLiveSkills).toHaveBeenCalledTimes(1);
    expect(catalog?.catalogSessionId).toBeNull();
    expect(catalog?.entriesByCanonicalSkillId.get("core-grep")).toMatchObject({
      invocationId: null,
      live: true,
      activationState: "active",
    });
  });

  it("returns activation-backed availability metadata in allowed skill resolution", async () => {
    const resolution = buildRuntimeAllowedSkillResolution(
      ["review-skill"],
      { toStringArray: (value) => (Array.isArray(value) ? (value as string[]) : []) },
      {
        catalogSessionId: "session-1",
        knownSkillIds: new Set(["review-skill"]),
        canonicalSkillIdByAcceptedId: new Map([["review-skill", "session.review"]]),
        acceptedSkillIdsByCanonicalId: new Map([
          ["session.review", ["session.review", "review-skill"]],
        ]),
        entriesByCanonicalSkillId: new Map([
          [
            "session.review",
            {
              invocationId: "session.review",
              live: true,
              activationState: "degraded",
              publicationStatus: "published",
              publicationReason:
                "Published because activation-backed runtime skill session.review is degraded: Skill is active with reduced readiness.",
              readiness: {
                state: "attention",
                summary: "Skill is active with reduced readiness.",
                detail: "Overlay dependency is missing a secondary binder.",
              },
            },
          ],
        ]),
      }
    );

    expect(resolution).toMatchObject({
      catalogSessionId: "session-1",
      requestedSkillIds: ["review-skill"],
      resolvedSkillIds: ["session.review"],
      entries: [
        {
          requestedSkillId: "review-skill",
          resolvedSkillId: "session.review",
          aliasApplied: true,
          availability: {
            invocationId: "session.review",
            live: true,
            activationState: "degraded",
            publicationStatus: "published",
            publicationReason:
              "Published because activation-backed runtime skill session.review is degraded: Skill is active with reduced readiness.",
            readiness: {
              state: "attention",
              summary: "Skill is active with reduced readiness.",
            },
          },
        },
      ],
    });
  });

  it("rejects non-live activation-backed skills with stateful explanation", () => {
    expect(() =>
      validateAllowedRuntimeSkillIds(
        ["session.review"],
        {
          catalogSessionId: "session-1",
          knownSkillIds: new Set(["session.review"]),
          canonicalSkillIdByAcceptedId: new Map([["session.review", "session.review"]]),
          acceptedSkillIdsByCanonicalId: new Map([["session.review", ["session.review"]]]),
          entriesByCanonicalSkillId: new Map([
            [
              "session.review",
              {
                invocationId: "session.review",
                live: false,
                activationState: "refresh_pending",
                publicationStatus: "hidden",
                publicationReason:
                  "Hidden because activation-backed runtime skill session.review is refresh_pending: Skill refresh is pending.",
                readiness: {
                  state: "attention",
                  summary: "Skill refresh is pending.",
                  detail: "The session overlay is rebuilding.",
                },
              },
            ],
          ]),
        },
        "spawn-runtime-sub-agent-session"
      )
    ).toThrow(
      /Hidden because activation-backed runtime skill session\.review is refresh_pending: Skill refresh is pending\./i
    );
  });
});
