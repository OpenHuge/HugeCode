import { Button, Card, Chip } from "@heroui/react";
import { RadioTower, Route, ShieldCheck } from "lucide-react";
import type { T3CodeProviderRoute } from "@ku0/code-t3-runtime-adapter";
import {
  createT3CodexRelayRoute,
  type T3CodexRelayProvider,
  type T3CodexRelayProviderId,
} from "../runtime/t3CodexRelayAssistant";

export type T3CodexRelayAssistantCardProps = {
  providers: T3CodexRelayProvider[];
  selectedProviderId: T3CodexRelayProviderId;
  activeRoute: T3CodeProviderRoute | undefined;
  onSelectProvider: (providerId: T3CodexRelayProviderId) => void;
  onApplyRoute: (route: T3CodeProviderRoute, provider: T3CodexRelayProvider) => void;
};

export function T3CodexRelayAssistantCard({
  activeRoute,
  providers,
  selectedProviderId,
  onApplyRoute,
  onSelectProvider,
}: T3CodexRelayAssistantCardProps) {
  const selectedProvider = providers.find((provider) => provider.id === selectedProviderId);
  return (
    <Card className="t3-relay-assistant" variant="secondary" aria-label="中转助手">
      <Card.Header className="t3-browser-card-header">
        <span>
          <RadioTower size={13} />
          中转助手
        </span>
        <Chip size="sm" variant="tertiary">
          {selectedProvider?.readinessLabel ?? "select relay"}
        </Chip>
      </Card.Header>
      <small>
        为内置 Codex 选择 OpenAI-compatible 中转站。Token 由运行时环境读取，前端不检测也不保存 key。
      </small>
      <div className="t3-relay-provider-list" aria-label="Codex relay providers">
        {providers.map((provider) => (
          <button
            type="button"
            key={provider.id}
            data-selected={provider.id === selectedProviderId}
            onClick={() => onSelectProvider(provider.id)}
          >
            <span>
              <strong>{provider.label}</strong>
              <small>{provider.baseUrl}</small>
            </span>
            <em>{provider.envKey}</em>
          </button>
        ))}
      </div>
      {selectedProvider ? (
        <div className="t3-relay-selected">
          <strong>{selectedProvider.label}</strong>
          <small>{selectedProvider.summary}</small>
          <span>
            <ShieldCheck size={13} />
            Runtime must provide {selectedProvider.envKey}; browser does not read token material
          </span>
          <span>
            <Route size={13} />
            {activeRoute?.backendId ?? "No relay route applied"}
          </span>
        </div>
      ) : null}
      <Button
        type="button"
        size="md"
        variant="primary"
        onPress={() => {
          if (!selectedProvider) {
            return;
          }
          onApplyRoute(createT3CodexRelayRoute(selectedProvider), selectedProvider);
        }}
        aria-disabled={!selectedProvider}
      >
        <Route size={14} />
        设为内置 Codex 中转
      </Button>
    </Card>
  );
}
