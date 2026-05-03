import { Button, Card, Chip, Input, TextArea } from "@heroui/react";
import {
  CheckCircle2,
  Circle,
  Code2,
  Copy,
  Globe2,
  KeyRound,
  Link2,
  Network,
  Server,
  ShieldCheck,
  Terminal,
} from "lucide-react";
import { useMemo, useState } from "react";
import type { HugeRouterCommercialServiceSnapshot } from "@ku0/code-runtime-host-contract/codeRuntimeRpc";
import type { T3CodeProviderRoute } from "@ku0/code-t3-runtime-adapter";
import {
  createT3ProductShareCode,
  parseT3ProductShareCode,
  summarizeT3ProductRouteReadiness,
  type T3ProductLanguage,
  type T3ProductTransportMode,
} from "../runtime/t3ProductLaunch";
import { T3LdxpPurchaseAssistantCard } from "./T3LdxpPurchaseAssistantCard";

export type T3ProductLaunchPanelProps = {
  hugeRouterSnapshot: HugeRouterCommercialServiceSnapshot;
  onNotice: (notice: string) => void;
  routes: readonly T3CodeProviderRoute[];
};

const copy = {
  en: {
    activeRoute: "Active route",
    arbitraryRelay: "Any relay",
    apply: "Apply",
    builtIn: "Built-in Codex",
    capacity: "Capacity",
    connection: "Connection",
    create: "Create",
    endpoint: "Relay URL",
    hugeRouter: "HugeRouter",
    invite: "Invite",
    language: "English",
    localClaude: "Claude CLI",
    localCodex: "Codex CLI",
    model: "Model",
    privateNetwork: "Private network",
    ready: "Ready",
    routeToken: "Route token",
    share: "Share code",
    standby: "Standby",
    title: "Product launch",
    tokenEnv: "Token env",
    transport: "Transport",
    workspace: "T3Code",
  },
  zh: {
    activeRoute: "当前路径",
    arbitraryRelay: "任意中转站",
    apply: "应用",
    builtIn: "内置 Codex",
    capacity: "容量",
    connection: "连接",
    create: "生成",
    endpoint: "中转地址",
    hugeRouter: "HugeRouter",
    invite: "口令",
    language: "中文",
    localClaude: "Claude CLI",
    localCodex: "Codex CLI",
    model: "模型",
    privateNetwork: "私有网络",
    ready: "就绪",
    routeToken: "Route token",
    share: "分享口令",
    standby: "待命",
    title: "产品发布",
    tokenEnv: "令牌变量",
    transport: "传输",
    workspace: "T3Code",
  },
} as const satisfies Record<T3ProductLanguage, Record<string, string>>;

export function T3ProductLaunchPanel({
  hugeRouterSnapshot,
  onNotice,
  routes,
}: T3ProductLaunchPanelProps) {
  const [language, setLanguage] = useState<T3ProductLanguage>("zh");
  const [transport, setTransport] = useState<T3ProductTransportMode>("hugerouter");
  const [relayBaseUrl, setRelayBaseUrl] = useState(
    hugeRouterSnapshot.connection.routeBaseUrl ?? "https://hugerouter.openhuge.local/v1"
  );
  const [routeTokenEnvKey, setRouteTokenEnvKey] = useState(
    hugeRouterSnapshot.routeToken?.envKey ?? "HUGEROUTER_ROUTE_TOKEN"
  );
  const [modelAlias, setModelAlias] = useState("agent-coding-default");
  const [inviteCode, setInviteCode] = useState("team-core");
  const [shareCode, setShareCode] = useState("");
  const text = copy[language];
  const activePlan =
    hugeRouterSnapshot.capacity?.planName ??
    hugeRouterSnapshot.availablePlans[0]?.name ??
    "HugeRouter";
  const remainingCredits = new Intl.NumberFormat(undefined, {
    maximumFractionDigits: 0,
  }).format(hugeRouterSnapshot.capacity?.remainingCredits ?? 0);
  const routeTokenStatus = hugeRouterSnapshot.routeToken?.status ?? "not_issued";
  const activeTransportLabel =
    transport === "private-network" ? text.privateNetwork : text.hugeRouter;
  const readiness = useMemo(
    () =>
      summarizeT3ProductRouteReadiness({
        hugeRouterConnected: hugeRouterSnapshot.connection.status === "connected",
        relayBaseUrl,
        routes,
        shareCode,
      }),
    [hugeRouterSnapshot.connection.status, relayBaseUrl, routes, shareCode]
  );
  const readinessItems: Array<readonly [string, boolean]> = [
    [text.builtIn, readiness.embeddedCodex],
    [text.localCodex, readiness.localCodex],
    [text.localClaude, readiness.localClaude],
    [text.arbitraryRelay, readiness.arbitraryRelay],
    [text.hugeRouter, readiness.hugeRouterConnected],
    [text.share, readiness.shareReady],
  ];

  function createShareCode() {
    try {
      const code = createT3ProductShareCode({
        inviteCode,
        locale: language,
        modelAlias,
        relayBaseUrl,
        relayKind: transport === "private-network" ? "tailscale" : "hugerouter",
        routeTokenEnvKey,
        transport,
      });
      setShareCode(code);
      onNotice(language === "zh" ? "分享口令已生成。" : "Share code created.");
    } catch (error) {
      onNotice(error instanceof Error ? error.message : "Unable to create share code.");
    }
  }

  function applyShareCode() {
    try {
      const payload = parseT3ProductShareCode(shareCode);
      setLanguage(payload.locale);
      setTransport(payload.transport);
      setRelayBaseUrl(payload.relayBaseUrl);
      setRouteTokenEnvKey(payload.routeTokenEnvKey);
      setModelAlias(payload.modelAlias);
      setInviteCode(payload.inviteCode);
      onNotice(payload.locale === "zh" ? "分享口令已应用。" : "Share code applied.");
    } catch (error) {
      onNotice(error instanceof Error ? error.message : "Unable to apply share code.");
    }
  }

  return (
    <Card className="t3-product-launch" variant="secondary" aria-label="T3 product launch">
      <Card.Header className="t3-product-hero">
        <div className="t3-product-identity">
          <span>
            <ShieldCheck size={16} />
            {text.workspace}
          </span>
          <strong>{text.title}</strong>
        </div>
        <div className="t3-product-language" aria-label="Language">
          <Button
            size="sm"
            variant="ghost"
            onPress={() => setLanguage("zh")}
            aria-pressed={language === "zh"}
          >
            中文
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onPress={() => setLanguage("en")}
            aria-pressed={language === "en"}
          >
            EN
          </Button>
        </div>
      </Card.Header>
      <div className="t3-product-metrics" aria-label="Launch metrics">
        <div>
          <span>{text.connection}</span>
          <strong>{hugeRouterSnapshot.connection.status}</strong>
        </div>
        <div>
          <span>{text.capacity}</span>
          <strong>{activePlan}</strong>
        </div>
        <div>
          <span>{text.routeToken}</span>
          <strong>{routeTokenStatus}</strong>
        </div>
        <div>
          <span>{text.activeRoute}</span>
          <strong>{activeTransportLabel}</strong>
        </div>
      </div>
      <div className="t3-product-readiness" aria-label="Launch readiness">
        {readinessItems.map(([label, ready]) => (
          <Chip
            key={label}
            color={ready ? "success" : "default"}
            data-ready={ready}
            size="sm"
            variant={ready ? "soft" : "tertiary"}
          >
            {ready ? <CheckCircle2 size={13} /> : <Circle size={13} />}
            {label}
          </Chip>
        ))}
      </div>
      <div className="t3-product-body">
        <section className="t3-product-route-panel" aria-label="Route configuration">
          <div className="t3-product-section-title">
            <Server size={15} />
            <span>{text.activeRoute}</span>
          </div>
          <div className="t3-product-transport" aria-label="Transport">
            <Button
              size="md"
              variant={transport === "hugerouter" ? "secondary" : "outline"}
              onPress={() => setTransport("hugerouter")}
              aria-pressed={transport === "hugerouter"}
            >
              <Globe2 size={14} />
              {text.hugeRouter}
            </Button>
            <Button
              size="md"
              variant={transport === "private-network" ? "secondary" : "outline"}
              onPress={() => setTransport("private-network")}
              aria-pressed={transport === "private-network"}
            >
              <Network size={14} />
              {text.privateNetwork}
            </Button>
          </div>
          <label>
            <span>{text.endpoint}</span>
            <Input
              value={relayBaseUrl}
              onChange={(event) => setRelayBaseUrl(event.target.value)}
              aria-label="Product relay URL"
              variant="secondary"
            />
          </label>
          <div className="t3-product-two">
            <label>
              <span>{text.tokenEnv}</span>
              <Input
                value={routeTokenEnvKey}
                onChange={(event) => setRouteTokenEnvKey(event.target.value)}
                aria-label="Route token environment key"
                variant="secondary"
              />
            </label>
            <label>
              <span>{text.model}</span>
              <Input
                value={modelAlias}
                onChange={(event) => setModelAlias(event.target.value)}
                aria-label="Product model alias"
                variant="secondary"
              />
            </label>
          </div>
        </section>
        <section className="t3-product-share-panel" aria-label="Share code exchange">
          <div className="t3-product-section-title">
            <KeyRound size={15} />
            <span>{text.share}</span>
          </div>
          <label>
            <span>{text.share}</span>
            <TextArea
              value={shareCode}
              onChange={(event) => setShareCode(event.target.value)}
              aria-label="T3 share code"
              rows={4}
              variant="secondary"
            />
          </label>
          <label>
            <span>{text.invite}</span>
            <Input
              value={inviteCode}
              onChange={(event) => setInviteCode(event.target.value)}
              aria-label="T3 invite code"
              variant="secondary"
            />
          </label>
          <div className="t3-product-actions">
            <Button size="md" variant="primary" onPress={createShareCode}>
              <Copy size={14} />
              {text.create}
            </Button>
            <Button size="md" variant="outline" onPress={applyShareCode}>
              <Link2 size={14} />
              {text.apply}
            </Button>
          </div>
        </section>
      </div>
      <div className="t3-product-footer" aria-label="Runtime summary">
        <span>
          <Terminal size={13} />
          Codex CLI
        </span>
        <span>
          <Code2 size={13} />
          Claude CLI
        </span>
        <span>{remainingCredits}</span>
      </div>
      <T3LdxpPurchaseAssistantCard onNotice={onNotice} />
    </Card>
  );
}
