import { describe, expect, it } from "vitest";
import {
  buildAttachmentContextPrefix,
  buildStartTurnPayload,
  parseCodexArgs,
  resolveProviderRouteBlockMessage,
  resolveExpandedMessageText,
  resolveSendMessageSettings,
} from "./useThreadMessagingHelpers";

describe("parseCodexArgs", () => {
  it("preserves quoted segments as a single argument", () => {
    expect(parseCodexArgs('--profile personal --config "a b"')).toEqual([
      "--profile",
      "personal",
      "--config",
      "a b",
    ]);
  });
});

describe("resolveExpandedMessageText", () => {
  it("expands plain custom slash commands", () => {
    expect(
      resolveExpandedMessageText("/summarize TARGET=src/features", false, [
        {
          name: "summarize",
          path: "/tmp/summarize.md",
          content: "Summarize $TARGET",
          scope: "workspace",
        },
      ])
    ).toEqual({
      finalText: "Summarize src/features",
      errorMessage: null,
    });
  });

  it("does not expand plain syntax for built-in command names", () => {
    expect(
      resolveExpandedMessageText("/review TARGET=src/features", false, [
        {
          name: "review",
          path: "/tmp/review.md",
          content: "Summarize $TARGET",
          scope: "workspace",
        },
      ])
    ).toEqual({
      finalText: "/review TARGET=src/features",
      errorMessage: null,
    });
  });
});

describe("resolveSendMessageSettings", () => {
  it("preserves explicit chat collaboration mode when only minimal identity fields are present", () => {
    expect(
      resolveSendMessageSettings(
        {
          collaborationMode: {
            mode: "default",
          },
        },
        {
          provider: null,
          model: null,
          effort: null,
          collaborationMode: null,
          accessMode: "read-only",
          executionMode: "runtime",
        }
      ).sanitizedCollaborationMode
    ).toEqual({
      id: "default",
      mode: "default",
      settings: { id: "default" },
    });
  });

  it("keeps fallback collaboration mode identity instead of dropping it", () => {
    expect(
      resolveSendMessageSettings(
        {
          collaborationMode: {
            id: "plan",
            mode: "plan",
            settings: { id: "plan" },
          },
        },
        {
          provider: null,
          model: null,
          effort: null,
          collaborationMode: null,
          accessMode: "read-only",
          executionMode: "runtime",
        }
      ).sanitizedCollaborationMode
    ).toEqual({
      id: "plan",
      mode: "plan",
      settings: { id: "plan" },
    });
  });

  it("strips unsupported collaboration settings and keeps only the stable identity fields", () => {
    expect(
      resolveSendMessageSettings(
        {
          collaborationMode: {
            id: "plan",
            mode: "plan",
            label: "Plan",
            settings: {
              id: "plan",
              developer_instructions: "Return a full plan first.",
              model: "gpt-5.4",
              reasoning_effort: "low",
            },
          },
        },
        {
          provider: null,
          model: "gpt-5.4",
          effort: "low",
          collaborationMode: null,
          accessMode: "read-only",
          executionMode: "runtime",
        }
      ).sanitizedCollaborationMode
    ).toEqual({
      id: "plan",
      mode: "plan",
      settings: { id: "plan" },
    });
  });

  it("resolves fast mode from explicit options before falling back to defaults", () => {
    expect(
      resolveSendMessageSettings(
        {
          fastMode: true,
        },
        {
          provider: null,
          model: "gpt-5.4",
          effort: "medium",
          fastMode: false,
          collaborationMode: null,
          accessMode: "read-only",
          executionMode: "runtime",
        }
      ).resolvedFastMode
    ).toBe(true);
  });
});

describe("resolveProviderRouteBlockMessage", () => {
  it("blocks runtime sends when the selected provider route is blocked", () => {
    expect(
      resolveProviderRouteBlockMessage({
        providerRoute: {
          label: "Claude Code",
          ready: false,
          readiness: "blocked",
          detail: "No enabled credential-ready pool is available.",
        },
        executionMode: "runtime",
      })
    ).toBe("Claude Code route is blocked. No enabled credential-ready pool is available.");
  });

  it("does not block local-cli or hybrid sends on the runtime route summary alone", () => {
    expect(
      resolveProviderRouteBlockMessage({
        providerRoute: {
          label: "Claude Code",
          ready: false,
          readiness: "blocked",
          detail: "No enabled credential-ready pool is available.",
        },
        executionMode: "local-cli",
      })
    ).toBeNull();
    expect(
      resolveProviderRouteBlockMessage({
        providerRoute: {
          label: "Claude Code",
          ready: false,
          readiness: "blocked",
          detail: "No enabled credential-ready pool is available.",
        },
        executionMode: "hybrid",
      })
    ).toBeNull();
  });

  it("skips blocking when the send carries an explicit provider or model override", () => {
    expect(
      resolveProviderRouteBlockMessage({
        providerRoute: {
          label: "Claude Code",
          ready: false,
          readiness: "blocked",
          detail: "No enabled credential-ready pool is available.",
        },
        executionMode: "runtime",
        hasExplicitModelOverride: true,
      })
    ).toBeNull();
  });
});

describe("buildAttachmentContextPrefix", () => {
  it("lists local file attachments with stable labels", () => {
    expect(buildAttachmentContextPrefix(["C:\\tmp\\brief.pdf", "/tmp/screenshot.png"])).toBe(
      [
        "[ATTACHMENTS v1]",
        "1. brief.pdf :: C:\\tmp\\brief.pdf",
        "2. screenshot.png :: /tmp/screenshot.png",
        "[/ATTACHMENTS]",
      ].join("\n")
    );
  });

  it("ignores pasted and remote attachment sources", () => {
    expect(
      buildAttachmentContextPrefix([
        "data:image/png;base64,AAAA",
        "https://example.com/file.png",
        "  ",
      ])
    ).toBeNull();
  });
});

describe("buildStartTurnPayload", () => {
  it("maps fast mode to the fast service tier", () => {
    expect(
      buildStartTurnPayload({
        provider: "openai",
        model: "gpt-5.4",
        effort: "medium",
        fastMode: true,
        collaborationMode: null,
        accessMode: "read-only",
        executionMode: "runtime",
        missionMode: null,
        executionProfileId: null,
        preferredBackendIds: null,
        codexBin: null,
        codexArgs: null,
        contextPrefix: null,
        images: [],
        appMentions: [],
      })
    ).toMatchObject({
      provider: "openai",
      model: "gpt-5.4",
      effort: "medium",
      serviceTier: "fast",
    });
  });
});
