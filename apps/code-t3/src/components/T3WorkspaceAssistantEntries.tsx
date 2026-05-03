import { Button, Card, Chip } from "@heroui/react";
import { ArrowLeft, Chrome, CreditCard, FileUp, KeyRound, RadioTower } from "lucide-react";
import { useMemo, useState } from "react";
import type { T3CodeProviderRoute } from "@ku0/code-t3-runtime-adapter";
import { T3AccountRentalAssistantCard } from "./T3AccountRentalAssistantCard";
import { T3CodexRelayAssistantCard } from "./T3CodexRelayAssistantCard";
import {
  listT3CodexRelayProviders,
  resolveT3CodexRelayBackendId,
  type T3CodexRelayProviderId,
} from "../runtime/t3CodexRelayAssistant";
import { getT3WorkspaceMessages, type T3WorkspaceLocale } from "./t3WorkspaceLocale";

export type T3WorkspaceAssistantPage = "home" | "account-rental" | "relay";

type T3WorkspaceAssistantEntriesProps = {
  activePage: T3WorkspaceAssistantPage;
  browserDataImported: boolean;
  browserImportBusy: boolean;
  locale: T3WorkspaceLocale;
  routes: readonly T3CodeProviderRoute[];
  onApplyRelayRoute: (route: T3CodeProviderRoute) => void;
  onAssistantPageChange: (page: T3WorkspaceAssistantPage) => void;
  onImportBrowserData: () => void;
  onLoginChatGptAccount: () => void;
  onOpenBrowser: () => void;
  onNotice: (notice: string) => void;
};

export function T3WorkspaceAssistantEntries({
  activePage,
  browserDataImported,
  browserImportBusy,
  locale,
  routes,
  onApplyRelayRoute,
  onAssistantPageChange,
  onImportBrowserData,
  onLoginChatGptAccount,
  onOpenBrowser,
  onNotice,
}: T3WorkspaceAssistantEntriesProps) {
  const text = getT3WorkspaceMessages(locale);
  const [selectedRelayProviderId, setSelectedRelayProviderId] =
    useState<T3CodexRelayProviderId>("tokenflux");
  const relayProviders = useMemo(() => listT3CodexRelayProviders(), []);
  const activeRelayRoute = useMemo(
    () =>
      routes.find(
        (route) =>
          route.provider === "codex" &&
          route.backendId === resolveT3CodexRelayBackendId(selectedRelayProviderId)
      ),
    [routes, selectedRelayProviderId]
  );

  if (!browserDataImported) {
    return (
      <section className="t3-startup-entry-page" aria-label={text.startupEntries}>
        <Card
          className="t3-browser-account-data-gate"
          variant="secondary"
          aria-label={text.browserAccountDataGateTitle}
        >
          <Card.Header className="t3-browser-card-header">
            <span>
              <KeyRound size={14} />
              {text.browserAccountDataGateTitle}
            </span>
            <Chip size="sm" variant="soft" color="warning">
              {text.browserAccountDataLoginState}
            </Chip>
          </Card.Header>
          <p>{text.browserAccountDataGateSubtitle}</p>
          <div className="t3-browser-account-data-actions">
            <Button
              type="button"
              onPress={onImportBrowserData}
              isDisabled={browserImportBusy}
              variant="primary"
            >
              <FileUp size={15} />
              {text.browserAccountDataGatePrimary}
            </Button>
            <Button
              type="button"
              onPress={onLoginChatGptAccount}
              isDisabled={browserImportBusy}
              variant="outline"
            >
              <Chrome size={15} />
              {text.browserAccountDataGateSecondary}
            </Button>
          </div>
        </Card>
      </section>
    );
  }

  if (activePage === "account-rental") {
    return (
      <section className="t3-assistant-operation-page" aria-label={text.accountRentalPageLabel}>
        <header className="t3-assistant-page-header">
          <Button
            type="button"
            aria-label={text.backToStartup}
            isIconOnly
            size="sm"
            variant="ghost"
            onPress={() => onAssistantPageChange("home")}
          >
            <ArrowLeft size={15} />
          </Button>
          <div>
            <span>{text.accountRental}</span>
            <h2>{text.accountRental}</h2>
          </div>
          <Chip size="sm" variant="tertiary">
            {text.assistantOperationTag}
          </Chip>
        </header>
        <T3AccountRentalAssistantCard onNotice={onNotice} />
      </section>
    );
  }

  if (activePage === "relay") {
    return (
      <section className="t3-assistant-operation-page" aria-label={text.relayAssistantPageLabel}>
        <header className="t3-assistant-page-header">
          <Button
            type="button"
            aria-label={text.backToStartup}
            isIconOnly
            size="sm"
            variant="ghost"
            onPress={() => onAssistantPageChange("home")}
          >
            <ArrowLeft size={15} />
          </Button>
          <div>
            <span>{text.relayAssistant}</span>
            <h2>{text.relayAssistant}</h2>
          </div>
          <Chip size="sm" variant="tertiary">
            {text.assistantOperationTag}
          </Chip>
        </header>
        <T3CodexRelayAssistantCard
          activeRoute={activeRelayRoute}
          providers={relayProviders}
          selectedProviderId={selectedRelayProviderId}
          onApplyRoute={onApplyRelayRoute}
          onSelectProvider={setSelectedRelayProviderId}
        />
      </section>
    );
  }

  return (
    <section className="t3-startup-entry-page" aria-label={text.startupEntries}>
      <div className="t3-main-entry-grid" aria-label={text.mainActionEntries}>
        <article className="t3-main-entry-card browser">
          <span className="t3-main-entry-icon">
            <Chrome size={16} />
          </span>
          <span>
            <strong>{text.browser}</strong>
            <small>{text.browserSubtitle}</small>
            <span className="t3-main-entry-actions">
              <Button type="button" onPress={onOpenBrowser} size="sm" variant="outline">
                <Chrome size={13} />
                {text.browser}
              </Button>
              <Button
                type="button"
                onPress={onImportBrowserData}
                aria-disabled={browserImportBusy}
                size="sm"
                variant="outline"
              >
                <FileUp size={13} />
                {text.browserImportData}
              </Button>
              {browserDataImported ? (
                <Button
                  type="button"
                  onPress={onLoginChatGptAccount}
                  aria-disabled={browserImportBusy}
                  size="sm"
                  variant="primary"
                >
                  <Chrome size={13} />
                  {text.browserImportChatGptAccount}
                </Button>
              ) : null}
            </span>
          </span>
        </article>
        <button
          className="t3-main-entry-card account"
          type="button"
          onClick={() => onAssistantPageChange("account-rental")}
        >
          <span className="t3-main-entry-icon">
            <CreditCard size={16} />
          </span>
          <span>
            <strong>{text.accountRental}</strong>
            <small>{text.accountRentalSubtitle}</small>
          </span>
        </button>
        <button
          className="t3-main-entry-card relay"
          type="button"
          onClick={() => onAssistantPageChange("relay")}
        >
          <span className="t3-main-entry-icon">
            <RadioTower size={16} />
          </span>
          <span>
            <strong>{text.relayAssistant}</strong>
            <small>{text.relayAssistantSubtitle}</small>
          </span>
        </button>
      </div>
    </section>
  );
}

type T3WorkspaceAssistantThreadRowsProps = {
  activePage: T3WorkspaceAssistantPage;
  locale: T3WorkspaceLocale;
  onOpenAssistantPage: (page: T3WorkspaceAssistantPage) => void;
};

export function T3WorkspaceAssistantThreadRows({
  activePage,
  locale,
  onOpenAssistantPage,
}: T3WorkspaceAssistantThreadRowsProps) {
  const text = getT3WorkspaceMessages(locale);
  return (
    <>
      <button
        className={activePage === "account-rental" ? "t3-thread-row active" : "t3-thread-row"}
        type="button"
        onClick={() => onOpenAssistantPage("account-rental")}
      >
        <span className="t3-thread-status work" />
        <span>
          <strong>{text.accountRental}</strong>
          <small>Pro 20x / Pro 5x</small>
        </span>
      </button>
      <button
        className={activePage === "relay" ? "t3-thread-row active" : "t3-thread-row"}
        type="button"
        onClick={() => onOpenAssistantPage("relay")}
      >
        <span className="t3-thread-status assistant" />
        <span>
          <strong>{text.relayAssistant}</strong>
          <small>TokenFlux / env-backed Codex</small>
        </span>
      </button>
    </>
  );
}
