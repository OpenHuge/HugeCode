import { useMemo } from "react";
import { PhoneLayout } from "./PhoneLayout";
import { Messages } from "../../messages/components/Messages";
import type { ConversationItem } from "../../../types";

type FixtureScenario = "overflow-latest" | "no-visible-response" | "working" | "tool-only";

type FixtureState = {
  items: ConversationItem[];
  isThinking: boolean;
  activeTurnId: string | null;
  lastDurationMs: number | null;
};

function resolveScenario(value: string | null): FixtureScenario {
  if (value === "no-visible-response" || value === "working" || value === "tool-only") {
    return value;
  }
  return "overflow-latest";
}

function buildOverflowItems(): ConversationItem[] {
  const items: ConversationItem[] = [];
  for (let index = 1; index <= 16; index += 1) {
    items.push({
      id: `overflow-user-${index}`,
      kind: "message",
      role: "user",
      text: `Operator check ${index}: verify the mission lane stays readable while the thread grows deeper.`,
    });
    items.push({
      id: `overflow-assistant-${index}`,
      kind: "message",
      role: "assistant",
      text: `Mission update ${index}: the lane keeps its structure, the footer stays visible, and the newest context should remain at the bottom.`,
    });
  }
  items.push({
    id: "overflow-latest-user",
    kind: "message",
    role: "user",
    text: "Summarize the latest mission outcome in one sentence.",
  });
  items.push({
    id: "overflow-latest-assistant",
    kind: "message",
    role: "assistant",
    text: "Latest mission outcome: the compact thread is pinned to the newest reply with no jump pill noise.",
  });
  return items;
}

function buildNoVisibleResponseItems(): ConversationItem[] {
  return [
    {
      id: "warning-user-history",
      kind: "message",
      role: "user",
      text: "Give me the current workspace summary.",
    },
    {
      id: "warning-assistant-history",
      kind: "message",
      role: "assistant",
      text: "The workspace is connected and the shell is ready for another turn.",
    },
    {
      id: "warning-user-latest",
      kind: "message",
      role: "user",
      text: "Run the latest turn again and surface any missing output state.",
    },
  ];
}

function buildWorkingItems(): ConversationItem[] {
  return [
    {
      id: "working-user-history",
      kind: "message",
      role: "user",
      text: "Audit the compact mission lane before the next turn starts.",
    },
    {
      id: "working-assistant-history",
      kind: "message",
      role: "assistant",
      text: "The lane is stable and waiting for the next execution update.",
    },
    {
      id: "working-latest-user",
      kind: "message",
      role: "user",
      text: "Keep streaming the latest execution summary.",
    },
  ];
}

function buildToolOnlyItems(): ConversationItem[] {
  return [
    {
      id: "tool-only-user-history",
      kind: "message",
      role: "user",
      text: "Check whether the tool lane can end without an assistant summary.",
    },
    {
      id: "tool-only-assistant-history",
      kind: "message",
      role: "assistant",
      text: "The previous turn finished cleanly and the shell stayed interactive.",
    },
    {
      id: "tool-only-user-latest",
      kind: "message",
      role: "user",
      text: "Run the workspace scan and stop after the tool output.",
    },
    {
      id: "tool-only-tool",
      kind: "tool",
      toolType: "commandExecution",
      title: "Command: rg --files src",
      detail: '{ "command": "rg --files src" }',
      output: "src/main.tsx\nsrc/App.tsx",
      status: "completed",
    },
  ];
}

function buildFixtureState(scenario: FixtureScenario): FixtureState {
  if (scenario === "no-visible-response") {
    return {
      items: buildNoVisibleResponseItems(),
      isThinking: false,
      activeTurnId: null,
      lastDurationMs: 1_000,
    };
  }
  if (scenario === "working") {
    return {
      items: buildWorkingItems(),
      isThinking: true,
      activeTurnId: "fixture-turn-working",
      lastDurationMs: null,
    };
  }
  if (scenario === "tool-only") {
    return {
      items: buildToolOnlyItems(),
      isThinking: false,
      activeTurnId: null,
      lastDurationMs: 3_000,
    };
  }
  return {
    items: buildOverflowItems(),
    isThinking: false,
    activeTurnId: null,
    lastDurationMs: 4_000,
  };
}

export function CompactMissionThreadFixture() {
  const scenario = useMemo(() => {
    const searchParams = new URLSearchParams(window.location.search);
    return resolveScenario(searchParams.get("scenario"));
  }, []);
  const fixtureState = useMemo(() => buildFixtureState(scenario), [scenario]);

  return (
    <PhoneLayout
      approvalToastsNode={null}
      updateToastNode={null}
      errorToastsNode={null}
      tabBarNode={
        <nav className="tabbar" aria-label="Fixture tabs">
          <button type="button" className="tabbar-item">
            Home
          </button>
          <button type="button" className="tabbar-item">
            Workspaces
          </button>
          <button type="button" className="tabbar-item active" aria-current="page">
            Missions
          </button>
          <button type="button" className="tabbar-item">
            Review
          </button>
          <button type="button" className="tabbar-item">
            Settings
          </button>
        </nav>
      }
      homeNode={null}
      sidebarNode={null}
      missionOverviewNode={
        <section data-testid="fixture-mission-overview">
          <h2>Mission overview</h2>
          <p>This overview should disappear when the thread is active.</p>
        </section>
      }
      activeTab="missions"
      activeWorkspace
      activeThreadId="fixture-thread-compact"
      showGitDetail={false}
      compactEmptyCodexNode={<div>Missing workspace</div>}
      compactEmptyGitNode={<div>Missing review queue</div>}
      compactGitBackNode={null}
      topbarLeftNode={
        <div>
          <h1>Compact Mission Thread Fixture</h1>
          <p>
            {scenario === "no-visible-response"
              ? "No visible response scenario"
              : scenario === "working"
                ? "Working state scenario"
                : scenario === "tool-only"
                  ? "Tool-only completion scenario"
                  : "Overflow latest scenario"}
          </p>
        </div>
      }
      messagesNode={
        <Messages
          items={fixtureState.items}
          threadId="fixture-thread-compact"
          workspaceId="fixture-workspace"
          activeTurnId={fixtureState.activeTurnId}
          isThinking={fixtureState.isThinking}
          lastDurationMs={fixtureState.lastDurationMs}
          openTargets={[]}
          selectedOpenAppId=""
        />
      }
      composerNode={
        <div className="composer">
          <div className="composer-surface composer-surface--workspace">
            <label htmlFor="fixture-composer-draft">Composer draft</label>
            <textarea
              id="fixture-composer-draft"
              aria-label="Composer draft"
              placeholder="Ask Codex to do something..."
              defaultValue=""
            />
          </div>
        </div>
      }
      gitDiffPanelNode={null}
      gitDiffViewerNode={null}
      debugPanelNode={null}
    />
  );
}
