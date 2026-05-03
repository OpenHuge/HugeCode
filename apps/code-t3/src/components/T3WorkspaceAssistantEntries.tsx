import { useMemo, useState } from "react";
import type { T3CodeProviderRoute } from "@ku0/code-t3-runtime-adapter";
import { T3CodexRelayAssistantCard } from "./T3CodexRelayAssistantCard";
import { T3LdxpPurchaseAssistantCard } from "./T3LdxpPurchaseAssistantCard";
import {
  listT3CodexRelayProviders,
  resolveT3CodexRelayBackendId,
  type T3CodexRelayProviderId,
} from "../runtime/t3CodexRelayAssistant";

type T3WorkspaceAssistantEntriesProps = {
  routes: readonly T3CodeProviderRoute[];
  onApplyRelayRoute: (route: T3CodeProviderRoute) => void;
  onNotice: (notice: string) => void;
};

export function T3WorkspaceAssistantEntries({
  routes,
  onApplyRelayRoute,
  onNotice,
}: T3WorkspaceAssistantEntriesProps) {
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

  return (
    <section className="t3-main-entry-grid" aria-label="Main action entries">
      <T3LdxpPurchaseAssistantCard onNotice={onNotice} />
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

type T3WorkspaceAssistantThreadRowsProps = {
  onOpenChat: () => void;
};

export function T3WorkspaceAssistantThreadRows({
  onOpenChat,
}: T3WorkspaceAssistantThreadRowsProps) {
  return (
    <>
      <button className="t3-thread-row" type="button" onClick={onOpenChat}>
        <span className="t3-thread-status work" />
        <span>
          <strong>账户充值</strong>
          <small>ldxp.cn ku0 in-app checkout</small>
        </span>
      </button>
      <button className="t3-thread-row" type="button" onClick={onOpenChat}>
        <span className="t3-thread-status assistant" />
        <span>
          <strong>中转助手</strong>
          <small>TokenFlux / env-backed Codex</small>
        </span>
      </button>
    </>
  );
}
