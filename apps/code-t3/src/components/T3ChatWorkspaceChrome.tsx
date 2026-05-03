import {
  AlertTriangle,
  CheckCircle2,
  Ellipsis,
  Loader2,
  SendHorizontal,
  Sidebar,
} from "lucide-react";
import type { ReactNode } from "react";
import type {
  T3CodeProviderKind,
  T3CodeProviderModelOption,
  T3CodeProviderRoute,
  T3CodeTimelineEvent,
} from "@ku0/code-t3-runtime-adapter";

type ComposerModelOption = {
  available: boolean;
  model: T3CodeProviderModelOption;
  provider: T3CodeProviderKind;
  route: T3CodeProviderRoute | undefined;
};

type ComposerCommand = {
  command: string;
  description: string;
};

export function statusLabel(route: T3CodeProviderRoute | undefined) {
  if (!route) {
    return "Unavailable";
  }
  if (route.status === "ready") {
    return "Ready";
  }
  if (route.status === "attention") {
    return "Attention";
  }
  if (route.status === "blocked") {
    return "Blocked";
  }
  return "Unknown";
}

export function eventClassName(event: T3CodeTimelineEvent) {
  if (event.id.startsWith("local-launch-")) {
    return "user";
  }
  if (event.kind === "assistant.delta" || event.kind === "task.completed") {
    return "assistant";
  }
  if (event.kind === "task.failed" || event.kind === "approval.requested") {
    return "warning";
  }
  return "work";
}

export function formatEventTime(createdAt: number) {
  return new Intl.DateTimeFormat(undefined, {
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(createdAt));
}

function providerTitle(provider: T3CodeProviderKind) {
  return provider === "codex" ? "Codex CLI" : "Claude Code CLI";
}

type T3ChatWorkspaceChromeProps = {
  canLaunchTask: boolean;
  composerCommandMatches: ComposerCommand[];
  composerModelOptions: ComposerModelOption[];
  launching: boolean;
  notice: string | null;
  prompt: string;
  quickEntries?: ReactNode;
  selectedModelId: string | null;
  selectedModelLabel: string;
  selectedProvider: T3CodeProviderKind;
  selectedRoute: T3CodeProviderRoute | undefined;
  visibleTimeline: T3CodeTimelineEvent[];
  onApplyComposerCommand: (command: string) => void;
  onLaunchTask: () => void;
  onModelSelection: (provider: T3CodeProviderKind, modelId: string) => void;
  onNotice: (notice: string | null) => void;
  onPromptChange: (prompt: string) => void;
  onToggleSidebar: () => void;
};

export function T3ChatWorkspaceChrome({
  canLaunchTask,
  composerCommandMatches,
  composerModelOptions,
  launching,
  notice,
  prompt,
  quickEntries,
  selectedModelId,
  selectedModelLabel,
  selectedProvider,
  selectedRoute,
  visibleTimeline,
  onApplyComposerCommand,
  onLaunchTask,
  onModelSelection,
  onNotice,
  onPromptChange,
  onToggleSidebar,
}: T3ChatWorkspaceChromeProps) {
  return (
    <section className="t3-workspace" id="chat">
      <header className="t3-toolbar">
        <div className="t3-toolbar-primary">
          <button
            className="t3-toolbar-sidebar-toggle"
            type="button"
            aria-label="Toggle Sidebar"
            onClick={onToggleSidebar}
          >
            <Sidebar size={16} />
          </button>
          <div className="t3-thread-title">
            <strong>New thread</strong>
            <span className="t3-runtime-badge">{selectedRoute?.backendLabel ?? "server"}</span>
          </div>
        </div>
        <div className="t3-toolbar-actions">
          <div className={`t3-status ${selectedRoute?.status ?? "blocked"}`}>
            {selectedRoute?.status === "ready" ? (
              <CheckCircle2 size={14} />
            ) : (
              <AlertTriangle size={14} />
            )}
            {statusLabel(selectedRoute)}
          </div>
        </div>
      </header>

      {notice ? <div className="t3-notice">{notice}</div> : null}

      <section className="t3-chat-surface">
        <div className="t3-thread">
          {visibleTimeline.length === 0 ? (
            <div className="t3-empty-thread">
              <strong>Send a message to start the conversation.</strong>
              <span>
                {selectedRoute?.summary ?? "HugeCode runtime will choose a local backend."}
              </span>
            </div>
          ) : null}
          {visibleTimeline.length === 0 && quickEntries ? quickEntries : null}
          {selectedRoute ? (
            <article className="t3-message work">
              <span>{selectedRoute.backendLabel}</span>
              <p>{selectedRoute.summary}</p>
            </article>
          ) : null}
          {visibleTimeline.map((event) => (
            <article className={`t3-message ${eventClassName(event)}`} key={event.id}>
              <span>
                {event.title}
                <time>{formatEventTime(event.createdAt)}</time>
              </span>
              {event.body ? <p>{event.body}</p> : null}
            </article>
          ))}
        </div>

        <form
          className="t3-composer"
          aria-label="Task composer"
          onSubmit={(event) => {
            event.preventDefault();
            onLaunchTask();
          }}
        >
          {composerCommandMatches.length > 0 ? (
            <div className="t3-composer-command-menu" aria-label="Composer commands">
              {composerCommandMatches.map((item) => (
                <button
                  type="button"
                  key={item.command}
                  onClick={() => onApplyComposerCommand(item.command)}
                >
                  <strong>{item.command}</strong>
                  <span>{item.description}</span>
                </button>
              ))}
            </div>
          ) : null}
          <div className="t3-composer-inputs">
            <textarea
              value={prompt}
              onChange={(event) => onPromptChange(event.target.value)}
              placeholder="Ask for follow-up changes or attach images"
              aria-label="Task instruction"
              onKeyDown={(event) => {
                if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
                  event.preventDefault();
                  onLaunchTask();
                }
              }}
            />
          </div>
          <footer>
            <div className="t3-composer-controls">
              <label className="t3-composer-select t3-model-select">
                <span>Model</span>
                <strong>{selectedModelLabel}</strong>
                <select
                  value={
                    selectedModelId
                      ? `${selectedProvider}:${selectedModelId}`
                      : `${selectedProvider}:`
                  }
                  onChange={(event) => {
                    const [providerValue, nextModelId] = event.target.value.split(":") as [
                      T3CodeProviderKind,
                      string,
                    ];
                    onModelSelection(
                      providerValue === "claudeAgent" ? "claudeAgent" : "codex",
                      nextModelId
                    );
                  }}
                  aria-label="Composer model provider"
                >
                  {composerModelOptions.map(({ available, model, provider, route }) => (
                    <option key={`${provider}:${model.slug}`} value={`${provider}:${model.slug}`}>
                      {providerTitle(provider)} · {model.shortName ?? model.name}
                      {route?.status === "blocked" || !available ? " (unavailable)" : ""}
                    </option>
                  ))}
                </select>
              </label>
              <button
                className="t3-more-composer-controls"
                type="button"
                aria-label="More composer controls"
                onClick={() =>
                  onNotice(
                    "Mode, access, and reasoning controls remain available in HugeCode runtime settings."
                  )
                }
              >
                <Ellipsis size={15} />
              </button>
              <label className="t3-composer-select t3-composer-compact-options">
                <span>Options</span>
                <select
                  value="on-request:medium"
                  onChange={(event) => onNotice(`Composer option selected: ${event.target.value}`)}
                  aria-label="Composer compact options"
                >
                  <option value="on-request:medium">Supervised · Medium</option>
                  <option value="on-request:high">Supervised · High</option>
                  <option value="full-access:high">Autonomous · High</option>
                  <option value="full-access:xhigh">Autonomous · XHigh</option>
                </select>
              </label>
            </div>
            <button type="submit" disabled={!canLaunchTask} aria-label="Start task">
              {launching ? <Loader2 size={16} className="spin" /> : <SendHorizontal size={16} />}
            </button>
          </footer>
        </form>
      </section>
    </section>
  );
}
