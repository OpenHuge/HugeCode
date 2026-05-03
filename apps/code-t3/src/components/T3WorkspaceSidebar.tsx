import { Chrome, Plus, RefreshCw, Search, Settings, SquarePen } from "lucide-react";
import type {
  T3CodeProviderKind,
  T3CodeProviderRoute,
  T3CodeTimelineEvent,
} from "@ku0/code-t3-runtime-adapter";
import { eventClassName, formatEventTime, statusLabel } from "./T3ChatWorkspaceChrome";
import {
  T3WorkspaceAssistantThreadRows,
  type T3WorkspaceAssistantPage,
} from "./T3WorkspaceAssistantEntries";
import { providerTitle } from "./t3WorkspaceLabels";
import type { T3WorkspaceMessages, T3WorkspaceLocale } from "./t3WorkspaceLocale";
import { T3Wordmark } from "./T3Wordmark";

type T3WorkspacePage = "chat" | "browser";

type T3WorkspaceSidebarProps = {
  activePage: T3WorkspacePage;
  assistantPage: T3WorkspaceAssistantPage;
  loadingRoutes: boolean;
  locale: T3WorkspaceLocale;
  providerOrder: readonly T3CodeProviderKind[];
  routes: readonly T3CodeProviderRoute[];
  selectedProvider: T3CodeProviderKind;
  selectedRoute: T3CodeProviderRoute | undefined;
  sidebarOpen: boolean;
  text: T3WorkspaceMessages;
  timeline: readonly T3CodeTimelineEvent[];
  workspaceId: string;
  onOpenAssistantPage: (page: T3WorkspaceAssistantPage) => void;
  onOpenBrowser: () => void;
  onOpenChat: () => void;
  onRefreshRoutes: () => void;
  onSelectProvider: (provider: T3CodeProviderKind) => void;
};

export function T3WorkspaceSidebar({
  activePage,
  assistantPage,
  loadingRoutes,
  locale,
  providerOrder,
  routes,
  selectedProvider,
  selectedRoute,
  sidebarOpen,
  text,
  timeline,
  workspaceId,
  onOpenAssistantPage,
  onOpenBrowser,
  onOpenChat,
  onRefreshRoutes,
  onSelectProvider,
}: T3WorkspaceSidebarProps) {
  return (
    <aside className="t3-sidebar" aria-label="HugeCode T3 navigation" aria-expanded={sidebarOpen}>
      <div className="t3-sidebar-header">
        <div className="t3-brand">
          <T3Wordmark />
          <strong>Code</strong>
          <span className="t3-stage-pill">{text.devStage}</span>
        </div>
        <button
          className="t3-icon-button"
          type="button"
          aria-label={text.newThread}
          title={text.newThread}
        >
          <SquarePen size={15} />
        </button>
      </div>

      <button className="t3-search" type="button">
        <Search size={14} />
        <span>{text.search}</span>
      </button>

      <section className="t3-sidebar-group" aria-label={text.currentProject}>
        <header>
          <span>{text.projects}</span>
          <button type="button" aria-label={text.addProject}>
            <Plus size={14} />
          </button>
        </header>
        <button className="t3-project-row active" type="button">
          <span className="t3-project-dot" />
          <span>
            <strong>hugecode</strong>
            <small>{workspaceId}</small>
          </span>
        </button>
      </section>

      <section className="t3-sidebar-group" aria-label={text.threads}>
        <header>{text.threads}</header>
        <button
          className={
            activePage === "chat" && assistantPage === "home"
              ? "t3-thread-row active"
              : "t3-thread-row"
          }
          type="button"
          onClick={onOpenChat}
        >
          <span className="t3-thread-status assistant" />
          <span>
            <strong>{providerTitle(selectedProvider)}</strong>
            <small>{selectedRoute?.modelId ?? text.runtimeDefault}</small>
          </span>
        </button>
        <T3WorkspaceAssistantThreadRows
          activePage={activePage === "chat" ? assistantPage : "home"}
          locale={locale}
          onOpenAssistantPage={onOpenAssistantPage}
        />
        {timeline.slice(-3).map((event) => (
          <button
            className="t3-thread-row"
            type="button"
            key={`thread-${event.id}`}
            onClick={onOpenChat}
          >
            <span className={`t3-thread-status ${eventClassName(event)}`} />
            <span>
              <strong>{event.title}</strong>
              <small>{formatEventTime(event.createdAt)}</small>
            </span>
          </button>
        ))}
      </section>

      <footer className="t3-sidebar-footer">
        <div className="t3-sidebar-provider-select" aria-label={text.providers}>
          <span>
            <label htmlFor="t3-sidebar-provider-select">{text.providers}</label>
            <button type="button" onClick={onRefreshRoutes} aria-label={text.refreshLocalProviders}>
              <RefreshCw className={loadingRoutes ? "spin" : undefined} size={13} />
            </button>
          </span>
          <select
            id="t3-sidebar-provider-select"
            value={selectedProvider}
            onChange={(event) => {
              const provider = event.target.value === "claudeAgent" ? "claudeAgent" : "codex";
              onSelectProvider(provider);
            }}
          >
            {providerOrder.map((provider) => {
              const route = routes.find((candidate) => candidate.provider === provider);
              return (
                <option key={provider} value={provider}>
                  {providerTitle(provider)} · {route?.modelId ?? text.localCli} ·{" "}
                  {statusLabel(route, locale)}
                </option>
              );
            })}
          </select>
        </div>
        <button type="button">
          <Settings size={14} />
          <span>{text.settings}</span>
        </button>
        <button
          className={
            activePage === "browser"
              ? "t3-sidebar-footer-browser active"
              : "t3-sidebar-footer-browser"
          }
          type="button"
          onClick={onOpenBrowser}
          aria-label={text.browser}
          title={text.browser}
        >
          <span className="t3-sidebar-chrome-icon" aria-hidden="true">
            <Chrome size={17} />
          </span>
          <span>{text.browser}</span>
        </button>
      </footer>
    </aside>
  );
}
