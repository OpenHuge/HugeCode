import {
  AlertTriangle,
  ArrowUp,
  Bot,
  CheckCircle2,
  ChevronDown,
  Loader2,
  Lock,
  LockOpen,
} from "lucide-react";
import type { ReactNode } from "react";
import type { AccessMode, ReasonEffort } from "@ku0/code-runtime-host-contract";
import type {
  T3CodeProviderKind,
  T3CodeProviderModelOption,
  T3CodeProviderRoute,
  T3CodeTimelineEvent,
} from "@ku0/code-t3-runtime-adapter";
import {
  getT3WorkspaceAccessModeLabel,
  getT3WorkspaceMessages,
  getT3WorkspaceReasonEffortLabel,
  getT3WorkspaceStatusLabel,
  type T3WorkspaceLocale,
} from "./t3WorkspaceLocale";

export type T3ComposerMode = "build" | "plan";
export type T3ComposerAccessMode = AccessMode;
export type T3ComposerReasonEffort = ReasonEffort;
export type T3NoticeTone = "danger" | "info" | "success";

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

export function statusLabel(
  route: T3CodeProviderRoute | undefined,
  locale: T3WorkspaceLocale = "en"
) {
  return getT3WorkspaceStatusLabel(locale, route);
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

export function noticeTone(notice: string): T3NoticeTone {
  if (/loaded .*account data|restored .*cookies|imported .*browser metadata/iu.test(notice)) {
    return "success";
  }
  if (/unable|failed|requires|must|error|blocked|invalid/iu.test(notice)) {
    return "danger";
  }
  return "info";
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

const composerModeValues: T3ComposerMode[] = ["build", "plan"];
const composerAccessValues: T3ComposerAccessMode[] = ["read-only", "on-request", "full-access"];
const composerReasonValues: T3ComposerReasonEffort[] = ["low", "medium", "high", "xhigh"];

function OpenAIIcon() {
  return (
    <svg
      aria-hidden="true"
      className="t3-provider-icon"
      preserveAspectRatio="xMidYMid"
      viewBox="0 0 256 260"
    >
      <path
        fill="currentColor"
        d="M239.184 106.203a64.716 64.716 0 0 0-5.576-53.103C219.452 28.459 191 15.784 163.213 21.74A65.586 65.586 0 0 0 52.096 45.22a64.716 64.716 0 0 0-43.23 31.36c-14.31 24.602-11.061 55.634 8.033 76.74a64.665 64.665 0 0 0 5.525 53.102c14.174 24.65 42.644 37.324 70.446 31.36a64.72 64.72 0 0 0 48.754 21.744c28.481.025 53.714-18.361 62.414-45.481a64.767 64.767 0 0 0 43.229-31.36c14.137-24.558 10.875-55.423-8.083-76.483Zm-97.56 136.338a48.397 48.397 0 0 1-31.105-11.255l1.535-.87 51.67-29.825a8.595 8.595 0 0 0 4.247-7.367v-72.85l21.845 12.636c.218.111.37.32.409.563v60.367c-.056 26.818-21.783 48.545-48.601 48.601Zm-104.466-44.61a48.345 48.345 0 0 1-5.781-32.589l1.534.921 51.722 29.826a8.339 8.339 0 0 0 8.441 0l63.181-36.425v25.221a.87.87 0 0 1-.358.665l-52.335 30.184c-23.257 13.398-52.97 5.431-66.404-17.803ZM23.549 85.38a48.499 48.499 0 0 1 25.58-21.333v61.39a8.288 8.288 0 0 0 4.195 7.316l62.874 36.272-21.845 12.636a.819.819 0 0 1-.767 0L41.353 151.53c-23.211-13.454-31.171-43.144-17.804-66.405v.256Zm179.466 41.695-63.08-36.63L161.73 77.86a.819.819 0 0 1 .768 0l52.233 30.184a48.6 48.6 0 0 1-7.316 87.635v-61.391a8.544 8.544 0 0 0-4.4-7.213Zm21.742-32.69-1.535-.922-51.619-30.081a8.39 8.39 0 0 0-8.492 0L99.98 99.808V74.587a.716.716 0 0 1 .307-.665l52.233-30.133a48.652 48.652 0 0 1 72.236 50.391v.205ZM88.061 139.097l-21.845-12.585a.87.87 0 0 1-.41-.614V65.685a48.652 48.652 0 0 1 79.757-37.346l-1.535.87-51.67 29.825a8.595 8.595 0 0 0-4.246 7.367l-.051 72.697Zm11.868-25.58 28.138-16.217 28.188 16.218v32.434l-28.086 16.218-28.188-16.218-.052-32.434Z"
      />
    </svg>
  );
}

type T3ChatWorkspaceChromeProps = {
  canLaunchTask: boolean;
  composerAccessMode: T3ComposerAccessMode;
  composerCommandMatches: ComposerCommand[];
  composerMode: T3ComposerMode;
  composerModelOptions: ComposerModelOption[];
  composerReasonEffort: T3ComposerReasonEffort;
  contentOverlay?: ReactNode;
  locale: T3WorkspaceLocale;
  launching: boolean;
  notice: string | null;
  productChrome?: boolean;
  prompt: string;
  quickEntries?: ReactNode;
  selectedModelId: string | null;
  selectedModelLabel: string;
  selectedProvider: T3CodeProviderKind;
  selectedRoute: T3CodeProviderRoute | undefined;
  sidebarOpen?: boolean;
  visibleTimeline: T3CodeTimelineEvent[];
  onApplyComposerCommand: (command: string) => void;
  onComposerAccessModeChange: (accessMode: T3ComposerAccessMode) => void;
  onLocaleChange: (locale: T3WorkspaceLocale) => void;
  onComposerModeChange: (mode: T3ComposerMode) => void;
  onComposerReasonEffortChange: (reasonEffort: T3ComposerReasonEffort) => void;
  onLaunchTask: () => void;
  onModelSelection: (provider: T3CodeProviderKind, modelId: string) => void;
  onPromptChange: (prompt: string) => void;
  onToggleSidebar: () => void;
};

export function T3ChatWorkspaceChrome({
  canLaunchTask,
  composerAccessMode,
  composerCommandMatches,
  composerMode,
  composerModelOptions,
  composerReasonEffort,
  contentOverlay,
  locale,
  launching,
  notice,
  productChrome = false,
  prompt,
  quickEntries,
  selectedModelId,
  selectedModelLabel,
  selectedProvider,
  selectedRoute,
  sidebarOpen = true,
  visibleTimeline,
  onApplyComposerCommand,
  onComposerAccessModeChange,
  onLocaleChange,
  onComposerModeChange,
  onComposerReasonEffortChange,
  onLaunchTask,
  onModelSelection,
  onPromptChange,
  onToggleSidebar,
}: T3ChatWorkspaceChromeProps) {
  const text = getT3WorkspaceMessages(locale);
  const selectedAccessLabel = getT3WorkspaceAccessModeLabel(locale, composerAccessMode);
  const selectedModeLabel = composerMode === "plan" ? text.plan : text.build;
  const selectedReasonLabel = getT3WorkspaceReasonEffortLabel(locale, composerReasonEffort);
  const AccessIcon = composerAccessMode === "full-access" ? LockOpen : Lock;
  const nextLocale = locale === "zh" ? "en" : "zh";

  return (
    <section className={productChrome ? "t3-workspace product-chrome" : "t3-workspace"} id="chat">
      {!productChrome ? (
        <header className="t3-toolbar">
          <div className="t3-toolbar-primary">
            <button
              className="t3-toolbar-sidebar-toggle"
              type="button"
              aria-label={text.toggleSidebar}
              onClick={onToggleSidebar}
            >
              <span
                aria-hidden="true"
                className={
                  sidebarOpen
                    ? "t3-toolbar-sidebar-toggle-triangle open"
                    : "t3-toolbar-sidebar-toggle-triangle closed"
                }
              />
            </button>
            <div className="t3-thread-title">
              <strong>{text.newThread}</strong>
              <span className="t3-runtime-badge">{selectedRoute?.backendLabel ?? "server"}</span>
            </div>
          </div>
          <div className="t3-toolbar-actions">
            <button
              className="t3-language-toggle"
              type="button"
              aria-label={text.language}
              onClick={() => onLocaleChange(nextLocale)}
            >
              {locale === "zh" ? text.languageSwitchToEnglish : text.languageSwitchToChinese}
            </button>
            <div className={`t3-status ${selectedRoute?.status ?? "blocked"}`}>
              {selectedRoute?.status === "ready" ? (
                <CheckCircle2 size={14} />
              ) : (
                <AlertTriangle size={14} />
              )}
              {statusLabel(selectedRoute, locale)}
            </div>
          </div>
        </header>
      ) : null}

      {notice ? (
        <div className="t3-notice" data-tone={noticeTone(notice)}>
          {notice}
        </div>
      ) : null}

      <section className={`t3-chat-surface${contentOverlay ? " has-content-overlay" : ""}`}>
        {contentOverlay}
        <div className="t3-thread">
          {visibleTimeline.length === 0 ? (
            quickEntries ? (
              quickEntries
            ) : (
              <div className="t3-empty-thread">
                <strong>{text.emptyThreadTitle}</strong>
                <span>{selectedRoute?.summary ?? text.emptyThreadSubtitle}</span>
              </div>
            )
          ) : null}
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
          aria-label={text.taskInstruction}
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
              placeholder={text.composerPlaceholder}
              aria-label={text.taskInstruction}
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
              <label className="t3-composer-trigger t3-model-select">
                <OpenAIIcon />
                <strong>{selectedModelLabel}</strong>
                <ChevronDown aria-hidden="true" size={12} />
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
                  aria-label={text.composerModelProvider}
                >
                  {composerModelOptions.map(({ available, model, provider, route }) => (
                    <option key={`${provider}:${model.slug}`} value={`${provider}:${model.slug}`}>
                      {providerTitle(provider)} · {model.shortName ?? model.name}
                      {route?.status === "blocked" || !available ? " (unavailable)" : ""}
                    </option>
                  ))}
                </select>
              </label>
              <span className="t3-composer-separator" aria-hidden="true" />
              <label className="t3-composer-trigger t3-reason-select">
                <strong>
                  {selectedReasonLabel} · {text.normal}
                </strong>
                <ChevronDown aria-hidden="true" size={12} />
                <select
                  value={composerReasonEffort}
                  onChange={(event) =>
                    onComposerReasonEffortChange(event.target.value as T3ComposerReasonEffort)
                  }
                  aria-label={text.composerReasoningEffort}
                >
                  {composerReasonValues.map((value) => (
                    <option key={value} value={value}>
                      {getT3WorkspaceReasonEffortLabel(locale, value)}
                    </option>
                  ))}
                </select>
              </label>
              <span className="t3-composer-separator" aria-hidden="true" />
              <label className="t3-composer-trigger">
                <Bot aria-hidden="true" size={16} />
                <strong>{selectedModeLabel}</strong>
                <ChevronDown aria-hidden="true" size={12} />
                <select
                  value={composerMode}
                  onChange={(event) => onComposerModeChange(event.target.value as T3ComposerMode)}
                  aria-label={text.composerMode}
                >
                  {composerModeValues.map((value) => (
                    <option key={value} value={value}>
                      {value === "plan" ? text.plan : text.build}
                    </option>
                  ))}
                </select>
              </label>
              <span className="t3-composer-separator" aria-hidden="true" />
              <label className="t3-composer-trigger">
                <AccessIcon aria-hidden="true" size={16} />
                <strong>{selectedAccessLabel}</strong>
                <ChevronDown aria-hidden="true" size={12} />
                <select
                  value={composerAccessMode}
                  onChange={(event) =>
                    onComposerAccessModeChange(event.target.value as T3ComposerAccessMode)
                  }
                  aria-label={text.composerAccessMode}
                >
                  {composerAccessValues.map((value) => (
                    <option key={value} value={value}>
                      {getT3WorkspaceAccessModeLabel(locale, value)}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <button type="submit" disabled={!canLaunchTask} aria-label={text.startTask}>
              {launching ? <Loader2 size={16} className="spin" /> : <ArrowUp size={18} />}
            </button>
          </footer>
        </form>
      </section>
    </section>
  );
}
