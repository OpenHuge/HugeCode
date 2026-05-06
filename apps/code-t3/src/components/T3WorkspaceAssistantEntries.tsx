import { Button, Card, Chip, Input } from "@heroui/react";
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
import {
  canUseT3P0UnreleasedAssistantSurfaces,
  readT3P0RuntimeRoleMode,
} from "../runtime/t3P0RuntimeRole";
import type { T3DeliveryProjection } from "../runtime/t3DeliveryService";
import { getT3WorkspaceMessages, type T3WorkspaceLocale } from "./t3WorkspaceLocale";

export type T3WorkspaceAssistantPage = "home" | "account-rental" | "relay";

const T3_CUSTOMER_FILE_UNLOCK_INPUT_HIDE_KEYWORD = "hide-customer-file-unlock-input";
const hideCustomerFileUnlockInput = true;

type T3WorkspaceAssistantEntriesProps = {
  activePage: T3WorkspaceAssistantPage;
  browserDataImported: boolean;
  browserAccountFileUnlockCode: string;
  browserAccountImportCode: string;
  browserDeliveryProjection?: T3DeliveryProjection | null;
  browserImportBusy: boolean;
  locale: T3WorkspaceLocale;
  routes: readonly T3CodeProviderRoute[];
  onApplyRelayRoute: (route: T3CodeProviderRoute) => void;
  onAssistantPageChange: (page: T3WorkspaceAssistantPage) => void;
  onBrowserAccountFileUnlockCodeChange: (value: string) => void;
  onBrowserAccountImportCodeChange: (value: string) => void;
  onImportBrowserData: () => void;
  onLoginChatGptAccount: () => void;
  onOpenBrowser: () => void;
  onNotice: (notice: string) => void;
  onRedeemBrowserDelivery: () => void;
};

function deliveryStatusColor(projection: T3DeliveryProjection | null | undefined) {
  if (projection?.status === "redeemed" || projection?.status === "exported") {
    return "success" as const;
  }
  if (projection?.status === "prepared") {
    return "warning" as const;
  }
  if (
    projection?.status === "expired" ||
    projection?.status === "failed" ||
    projection?.status === "fileUnavailable" ||
    projection?.status === "revoked" ||
    projection?.status === "unavailable"
  ) {
    return "danger" as const;
  }
  return "warning" as const;
}

export function T3WorkspaceAssistantEntries({
  activePage,
  browserDataImported,
  browserAccountFileUnlockCode,
  browserAccountImportCode,
  browserDeliveryProjection,
  browserImportBusy,
  locale,
  routes,
  onApplyRelayRoute,
  onAssistantPageChange,
  onBrowserAccountFileUnlockCodeChange,
  onBrowserAccountImportCodeChange,
  onImportBrowserData,
  onLoginChatGptAccount,
  onOpenBrowser,
  onNotice,
  onRedeemBrowserDelivery,
}: T3WorkspaceAssistantEntriesProps) {
  const text = getT3WorkspaceMessages(locale);
  const runtimeRole = readT3P0RuntimeRoleMode();
  const importCodeReady = browserAccountImportCode.trim().length >= 8;
  const fileUnlockCodeReady = browserAccountFileUnlockCode.trim().length >= 8;
  const remoteRedeemReady = importCodeReady && (hideCustomerFileUnlockInput || fileUnlockCodeReady);
  const canUseUnreleasedAssistantSurfaces = canUseT3P0UnreleasedAssistantSurfaces(runtimeRole);
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

  if (runtimeRole === "customer") {
    return (
      <section className="t3-startup-entry-page" aria-label={text.startupEntries}>
        <Card
          className="t3-browser-account-data-gate"
          variant="secondary"
          aria-label={text.browserRemoteDataGateTitle}
        >
          <Card.Header className="t3-browser-card-header">
            <span>
              <KeyRound size={14} />
              {text.browserRemoteDataGateTitle}
            </span>
            <Chip size="sm" variant="soft" color={deliveryStatusColor(browserDeliveryProjection)}>
              {browserDeliveryProjection?.status ?? text.browserAccountDataLoginState}
            </Chip>
          </Card.Header>
          <p>{text.browserRemoteDataGateSubtitle}</p>
          <div
            className="t3-browser-account-data-actions"
            data-file-unlock-input={
              hideCustomerFileUnlockInput ? T3_CUSTOMER_FILE_UNLOCK_INPUT_HIDE_KEYWORD : "visible"
            }
          >
            <Input
              className="t3-browser-account-import-code"
              value={browserAccountImportCode}
              onChange={(event) => onBrowserAccountImportCodeChange(event.target.value)}
              aria-label={text.browserRedemptionCodeLabel}
              placeholder={text.browserRedemptionCodePlaceholder}
              type="password"
              variant="secondary"
            />
            {!hideCustomerFileUnlockInput ? (
              <Input
                className="t3-browser-account-import-code"
                value={browserAccountFileUnlockCode}
                onChange={(event) => onBrowserAccountFileUnlockCodeChange(event.target.value)}
                aria-label={text.browserAccountImportCodeLabel}
                placeholder={text.browserAccountImportCodePlaceholder}
                type="password"
                variant="secondary"
              />
            ) : null}
            <Button
              className="t3-browser-account-data-import-button"
              type="button"
              onPress={onRedeemBrowserDelivery}
              isDisabled={browserImportBusy || !remoteRedeemReady}
              variant="primary"
            >
              <FileUp size={15} />
              {text.browserRedeemData}
            </Button>
          </div>
          {browserDeliveryProjection ? <small>{browserDeliveryProjection.summary}</small> : null}
        </Card>
      </section>
    );
  }

  if (canUseUnreleasedAssistantSurfaces && activePage === "account-rental") {
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

  if (canUseUnreleasedAssistantSurfaces && activePage === "relay") {
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
              <Input
                className="t3-browser-account-import-code"
                value={browserAccountFileUnlockCode}
                onChange={(event) => onBrowserAccountFileUnlockCodeChange(event.target.value)}
                aria-label={text.browserAccountImportCodeLabel}
                placeholder={text.browserAccountImportCodePlaceholder}
                type="password"
                variant="secondary"
              />
              <Button type="button" onPress={onOpenBrowser} size="sm" variant="outline">
                <Chrome size={13} />
                {text.browser}
              </Button>
              <Button
                type="button"
                onPress={onImportBrowserData}
                aria-disabled={browserImportBusy || !fileUnlockCodeReady}
                isDisabled={browserImportBusy || !fileUnlockCodeReady}
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
        {canUseUnreleasedAssistantSurfaces ? (
          <>
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
          </>
        ) : null}
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
  const runtimeRole = readT3P0RuntimeRoleMode();
  if (!canUseT3P0UnreleasedAssistantSurfaces(runtimeRole)) {
    return null;
  }
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
