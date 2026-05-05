import { Button, Card, Chip, Input, TextArea } from "@heroui/react";
import {
  ArrowLeft,
  ArrowRight,
  Camera,
  ClipboardCheck,
  Copy,
  CreditCard,
  Grid3X3,
  Globe2,
  Home,
  KeyRound,
  Lock,
  Mic,
  MoreVertical,
  PackageCheck,
  Pencil,
  Plus,
  QrCode,
  RefreshCw,
  Search,
  ShieldCheck,
  Star,
  TriangleAlert,
  UserCircle,
  X,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import {
  assessEncryptedT3ChatGptSessionEnvelope,
  assessT3ChatGptSession,
  buildT3ChatGptRechargeActions,
  decryptT3ChatGptSessionVault,
  encryptT3ChatGptSessionVault,
  T3_CHATGPT_HOME_URL,
  T3_CHATGPT_SESSION_URL,
  T3_CHATGPT_SESSION_VAULT_STORAGE_KEY,
  type T3ChatGptEncryptedSessionEnvelope,
  type T3ChatGptSessionAssessment,
} from "../runtime/t3ChatGptRechargeAssistant";
import { T3ChatGptBrowserAssistantCard } from "./T3ChatGptBrowserAssistantCard";
import {
  buildT3LdxpFulfillmentActions,
  parseT3LdxpFulfillmentPrompt,
  parseT3LdxpPaymentPrompt,
  T3_LDXP_AI_SHOP_URL,
  T3_LDXP_TEST_AMOUNT_CENTS,
  T3_LDXP_TEST_CATEGORY_LABEL,
} from "../runtime/t3LdxpPurchaseAssistant";
import { startT3CodexOAuthLogin } from "../runtime/t3CodexOAuth";
import {
  getT3BrowserChromeBridge,
  type BrowserChromeCommandResult,
  type BrowserChromeSnapshot,
  type BrowserChromeTabState,
} from "../runtime/t3BrowserChromeBridge";
import { EMPTY_BROWSER_CHROME_SNAPSHOT } from "./t3BrowserChromeDesktopConstants";
import { hostLabel, isSecureUrl } from "./t3BrowserLaunchHelpers";
import { T3BrowserChatGptLoginWitnessBadge } from "./T3BrowserChatGptLoginWitnessBadge";
import { T3OperatorDeliveryCaptureStatus } from "./T3OperatorDeliveryCaptureStatus";

type BrowserLaunchPageProps = {
  initialCaptureMode?: "operator-delivery" | null;
  initialChatGptAssistant: boolean;
  initialLdxpAssistant: boolean;
  initialProvider: string;
  initialTargetUrl: string;
};

const QUICK_STARTS = [
  { label: "ChatGPT", url: "https://chatgpt.com/" },
  { label: "GitHub", url: "https://github.com/" },
  { label: "Gemini", url: "https://gemini.google.com/app" },
  { label: "Gmail", url: "https://mail.google.com/" },
  { label: "YouTube", url: "https://www.youtube.com/" },
  { label: "Maps", url: "https://maps.google.com/" },
  { label: "Linear", url: "https://linear.app/" },
] as const;

export const T3_LDXP_BROWSER_DRAFT_STORAGE_KEY = "hugecode:ldxp-assistant-draft:v1";
const T3_CODEX_OAUTH_BROWSER_WORKSPACE_ID = "workspace-web";
const GOOGLE_SEARCH_URL = "https://www.google.com/search";

type T3LdxpBrowserDraft = {
  fulfillmentText: string;
  paid: boolean;
  paymentText: string;
};

type LdxpTradeCheck = {
  label: string;
  level: "danger" | "success" | "warning";
  summary: string;
};

export function normalizeAddressInput(value: string) {
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }
  if (/^https?:\/\//iu.test(trimmed)) {
    return new URL(trimmed).toString();
  }
  if (shouldOpenAsGoogleSearch(trimmed)) {
    const searchUrl = new URL(GOOGLE_SEARCH_URL);
    searchUrl.searchParams.set("q", trimmed);
    return searchUrl.toString();
  }
  return new URL(`https://${trimmed}`).toString();
}

function shouldOpenAsGoogleSearch(value: string) {
  if (/\s/u.test(value)) {
    return true;
  }
  if (value === "localhost" || value.includes(".") || value.includes(":")) {
    return false;
  }
  return true;
}

function formatCny(cents: number) {
  return new Intl.NumberFormat("zh-CN", {
    currency: "CNY",
    style: "currency",
  }).format(cents / 100);
}

function isLdxpShopUrl(url: string) {
  try {
    const parsed = new URL(url);
    return parsed.hostname === "pay.ldxp.cn" && parsed.pathname.startsWith("/shop/ku0");
  } catch {
    return false;
  }
}

function isChatGptUrl(url: string) {
  try {
    return new URL(url).hostname === "chatgpt.com";
  } catch {
    return false;
  }
}

async function writeBrowserTextClipboard(text: string) {
  try {
    await navigator.clipboard?.writeText(text);
    return;
  } catch {
    // Fall back below for browser contexts where Clipboard API writes are blocked.
  }
  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.setAttribute("readonly", "true");
  textarea.className = "browser-product-clipboard-proxy";
  document.body.append(textarea);
  textarea.select();
  try {
    if (!document.execCommand("copy")) {
      throw new Error("Copy command was rejected.");
    }
  } finally {
    textarea.remove();
  }
}

function readT3LdxpBrowserDraft() {
  try {
    const stored = window.localStorage.getItem(T3_LDXP_BROWSER_DRAFT_STORAGE_KEY);
    if (!stored) {
      return null;
    }
    const parsed = JSON.parse(stored) as Partial<T3LdxpBrowserDraft>;
    return {
      fulfillmentText: typeof parsed.fulfillmentText === "string" ? parsed.fulfillmentText : "",
      paid: parsed.paid === true,
      paymentText: typeof parsed.paymentText === "string" ? parsed.paymentText : "",
    };
  } catch {
    return null;
  }
}

function isLdxpUrl(value: string) {
  try {
    return new URL(value).hostname.endsWith("ldxp.cn");
  } catch {
    return null;
  }
}

function buildLdxpTradeChecks(input: {
  fulfillmentReady: boolean;
  paid: boolean;
  paymentPrompt: ReturnType<typeof parseT3LdxpPaymentPrompt>;
}) {
  const checks: LdxpTradeCheck[] = [];
  if (input.paymentPrompt.paymentCode) {
    const paymentCodeIsLdxpUrl = isLdxpUrl(input.paymentPrompt.paymentCode);
    if (paymentCodeIsLdxpUrl === false) {
      checks.push({
        label: "付款来源",
        level: "danger",
        summary: "付款链接不是 ldxp.cn，先回到站点收银台重新生成。",
      });
    } else {
      checks.push({
        label: "付款来源",
        level: "success",
        summary:
          paymentCodeIsLdxpUrl === true
            ? "已识别 ldxp.cn 付款链接。"
            : "已识别付款码，确认它来自 ldxp.cn 收银台。",
      });
    }
  } else {
    checks.push({
      label: "付款来源",
      level: "warning",
      summary: "还没有付款码，不能让用户支付。",
    });
  }

  if (input.paymentPrompt.amountCents === null) {
    checks.push({
      label: "金额",
      level: "warning",
      summary: `未识别金额，应为 ${formatCny(T3_LDXP_TEST_AMOUNT_CENTS)}。`,
    });
  } else if (input.paymentPrompt.amountCents === T3_LDXP_TEST_AMOUNT_CENTS) {
    checks.push({
      label: "金额",
      level: "success",
      summary: `金额匹配 ${formatCny(T3_LDXP_TEST_AMOUNT_CENTS)}。`,
    });
  } else {
    checks.push({
      label: "金额",
      level: "danger",
      summary: `金额不是 ${formatCny(T3_LDXP_TEST_AMOUNT_CENTS)}，不要确认到账。`,
    });
  }

  const productLabel = input.paymentPrompt.productLabel?.toLowerCase() ?? "";
  if (!productLabel) {
    checks.push({
      label: "商品",
      level: "warning",
      summary: "未识别商品名，确认是 AI 充值 0.1 测试商品。",
    });
  } else if (productLabel.includes("ai") && productLabel.includes("充值")) {
    checks.push({
      label: "商品",
      level: "success",
      summary: "商品与 AI 充值分类匹配。",
    });
  } else {
    checks.push({
      label: "商品",
      level: "warning",
      summary: "商品名不像 AI 充值测试商品，先核对分类和规格。",
    });
  }

  if (input.fulfillmentReady) {
    checks.push({
      label: "交付",
      level: "success",
      summary: "已识别卡密或兑换入口，可以交付给用户。",
    });
  } else if (input.paid) {
    checks.push({
      label: "交付",
      level: "warning",
      summary: "已确认支付，但还缺支付后的取货页文本。",
    });
  } else {
    checks.push({
      label: "交付",
      level: "warning",
      summary: "等待用户支付后再进入取货兑换。",
    });
  }
  return checks;
}

function localizeLdxpFulfillmentAction(action: string) {
  if (action === "Paste the paid order page text or delivery prompt from ldxp.cn.") {
    return "粘贴 ldxp.cn 支付后的订单页或发货提示。";
  }
  if (action === "Follow the latest ldxp.cn page prompt and paste the next page text here.") {
    return "按 ldxp.cn 页面提示继续，并粘贴下一页文本。";
  }
  const pickupPage = /^Open pickup page: (.+)$/u.exec(action)?.[1];
  if (pickupPage) {
    return `打开取货页：${pickupPage}`;
  }
  const orderId = /^Use order id (.+) when the page asks for an order query\.$/u.exec(action)?.[1];
  if (orderId) {
    return `查询订单：${orderId}`;
  }
  const pickupCode = /^Use pickup code (.+) when the page asks for delivery proof\.$/u.exec(
    action
  )?.[1];
  if (pickupCode) {
    return `使用取货码：${pickupCode}`;
  }
  const redemptionPage = /^Open redemption page: (.+)$/u.exec(action)?.[1];
  if (redemptionPage) {
    return `打开兑换页：${redemptionPage}`;
  }
  const cardKey = /^Redeem card key: (.+)$/u.exec(action)?.[1];
  if (cardKey) {
    return `兑换卡密：${cardKey}`;
  }
  return action;
}

function BrowserChromeDesktopShell({
  initialCaptureMode,
  initialTargetUrl,
}: Pick<BrowserLaunchPageProps, "initialCaptureMode" | "initialTargetUrl">) {
  const browserChromeBridge = useMemo(() => getT3BrowserChromeBridge(), []);
  const [snapshot, setSnapshot] = useState<BrowserChromeSnapshot>(EMPTY_BROWSER_CHROME_SNAPSHOT);
  const [addressDraft, setAddressDraft] = useState(initialTargetUrl);
  const [error, setError] = useState<string | null>(null);
  const activeTab = useMemo(
    () => snapshot.tabs.find((tab) => tab.id === snapshot.activeTabId) ?? snapshot.tabs[0] ?? null,
    [snapshot]
  );
  const activeTabUrl = activeTab?.url ?? "";
  const activeTabTitle = activeTab?.title ?? "New Tab";
  const showChromeHome = !activeTabUrl.trim();
  const secure = activeTab?.securityState === "secure";
  const insecure = activeTab?.securityState === "insecure";
  const operatorDeliveryCapture = initialCaptureMode === "operator-delivery";

  useEffect(() => {
    if (!browserChromeBridge) {
      return undefined;
    }
    let mounted = true;
    void browserChromeBridge
      .getSnapshot()
      .then((nextSnapshot) => {
        if (mounted) {
          setSnapshot(nextSnapshot);
        }
      })
      .catch(() => {
        if (mounted) {
          setError("Unable to connect to the desktop browser host.");
        }
      });
    const unsubscribe = browserChromeBridge.subscribe((nextSnapshot) => {
      if (mounted) {
        setSnapshot(nextSnapshot);
      }
    });
    return () => {
      mounted = false;
      unsubscribe();
    };
  }, [browserChromeBridge]);

  useEffect(() => {
    setAddressDraft(activeTabUrl);
  }, [activeTab?.id, activeTabUrl]);

  async function runBrowserChromeCommand(
    command: () => Promise<BrowserChromeCommandResult>,
    fallbackMessage: string
  ) {
    if (!browserChromeBridge) {
      setError("Desktop browser host is unavailable.");
      return;
    }
    try {
      const result = await command();
      setSnapshot(result.snapshot);
      setError(result.ok ? null : result.errorMessage);
    } catch {
      setError(fallbackMessage);
    }
  }

  function navigateActiveTab(nextAddress = addressDraft) {
    void runBrowserChromeCommand(
      () =>
        browserChromeBridge!.navigate({
          tabId: activeTab?.id ?? null,
          url: nextAddress,
        }),
      "Unable to navigate this tab."
    );
  }

  function createNewTab(url?: string) {
    void runBrowserChromeCommand(
      () => browserChromeBridge!.createTab({ activate: true, url: url ?? null }),
      "Unable to create a new browser tab."
    );
  }

  function closeOperatorCaptureWindow() {
    void runBrowserChromeCommand(
      () => browserChromeBridge!.closeWindow(),
      "Unable to close the browser window. Close it manually and return to the production workspace."
    );
  }

  async function copyActiveAddress() {
    try {
      const normalized = normalizeAddressInput(activeTabUrl || addressDraft);
      if (!normalized) {
        setError("Open a page before copying the address.");
        return;
      }
      await writeBrowserTextClipboard(normalized);
      setError(null);
    } catch {
      setError("Unable to copy this address in the current browser context.");
    }
  }

  function tabLabel(tab: BrowserChromeTabState) {
    return tab.title.trim() || hostLabel(tab.url);
  }

  return (
    <main className="browser-product-shell browser-product-shell-chrome browser-product-shell-desktop">
      <header className="browser-product-topbar" aria-label="Browser window controls">
        <div className="browser-product-window-controls" aria-hidden="true">
          <span />
          <span />
          <span />
        </div>
        <div className="browser-product-tab-strip" role="tablist" aria-label="Browser tabs">
          {snapshot.tabs.map((tab) => (
            <div
              className="browser-product-tab"
              data-active={tab.id === snapshot.activeTabId}
              key={tab.id}
              role="presentation"
            >
              <button
                type="button"
                className="browser-product-tab-main"
                role="tab"
                aria-selected={tab.id === snapshot.activeTabId}
                onClick={() =>
                  void runBrowserChromeCommand(
                    () => browserChromeBridge!.activateTab({ tabId: tab.id }),
                    "Unable to activate this tab."
                  )
                }
              >
                <Globe2 size={14} />
                <span>{tabLabel(tab)}</span>
              </button>
              <Button
                type="button"
                aria-label={`Close ${tabLabel(tab)}`}
                className="browser-product-tab-close"
                isIconOnly
                size="sm"
                variant="ghost"
                onPress={() =>
                  void runBrowserChromeCommand(
                    () => browserChromeBridge!.closeTab({ tabId: tab.id }),
                    "Unable to close this tab."
                  )
                }
              >
                <X size={13} />
              </Button>
            </div>
          ))}
        </div>
        <Button
          type="button"
          aria-label="New tab"
          isIconOnly
          size="sm"
          variant="ghost"
          onPress={() => createNewTab()}
        >
          <Plus size={16} />
        </Button>
        <div className="browser-product-topbar-spacer" />
      </header>

      <section className="browser-product-toolbar" aria-label="Browser toolbar">
        <Button
          type="button"
          aria-label="Back"
          aria-disabled={!activeTab?.canGoBack}
          isIconOnly
          size="sm"
          variant="ghost"
          onPress={() => {
            if (activeTab?.canGoBack) {
              void runBrowserChromeCommand(
                () => browserChromeBridge!.goBack({ tabId: activeTab.id }),
                "Unable to go back."
              );
            }
          }}
        >
          <ArrowLeft size={15} />
        </Button>
        <Button
          type="button"
          aria-label="Forward"
          aria-disabled={!activeTab?.canGoForward}
          isIconOnly
          size="sm"
          variant="ghost"
          onPress={() => {
            if (activeTab?.canGoForward) {
              void runBrowserChromeCommand(
                () => browserChromeBridge!.goForward({ tabId: activeTab.id }),
                "Unable to go forward."
              );
            }
          }}
        >
          <ArrowRight size={15} />
        </Button>
        <Button
          type="button"
          aria-label={activeTab?.loading ? "Stop" : "Reload"}
          onPress={() =>
            void runBrowserChromeCommand(
              () =>
                activeTab?.loading
                  ? browserChromeBridge!.stop({ tabId: activeTab.id })
                  : browserChromeBridge!.reload({ tabId: activeTab?.id ?? null }),
              activeTab?.loading ? "Unable to stop loading." : "Unable to reload."
            )
          }
          isIconOnly
          size="sm"
          variant="ghost"
        >
          {activeTab?.loading ? <X size={15} /> : <RefreshCw size={15} />}
        </Button>
        <Button
          type="button"
          aria-label="Home"
          onPress={() => {
            setAddressDraft("");
            createNewTab();
          }}
          isIconOnly
          size="sm"
          variant="ghost"
        >
          <Home size={15} />
        </Button>
        <form
          className={`browser-product-address ${secure ? "secure" : ""} ${insecure ? "insecure" : ""}`}
          onSubmit={(event) => {
            event.preventDefault();
            navigateActiveTab();
          }}
        >
          {secure ? (
            <Lock size={14} />
          ) : insecure ? (
            <TriangleAlert size={14} />
          ) : (
            <Search size={14} />
          )}
          <Input
            value={addressDraft}
            onChange={(event) => setAddressDraft(event.target.value)}
            aria-label="Browser address"
            placeholder="Search Google or type a URL"
            spellCheck={false}
            variant="secondary"
          />
          <Button type="submit" aria-label="Go to address" isIconOnly size="sm" variant="ghost">
            <Search size={14} />
          </Button>
        </form>
        <T3BrowserChatGptLoginWitnessBadge snapshot={snapshot} targetUrl={initialTargetUrl} />
        <T3OperatorDeliveryCaptureStatus
          activeTabUrl={activeTabUrl}
          enabled={operatorDeliveryCapture}
          onCloseWindow={closeOperatorCaptureWindow}
          onOpenChatGpt={() => navigateActiveTab(T3_CHATGPT_HOME_URL)}
        />
        <Button
          className="browser-product-desktop-action"
          type="button"
          aria-label="Bookmark"
          isIconOnly
          size="sm"
          variant="ghost"
        >
          <Star size={15} />
        </Button>
        <Button
          className="browser-product-desktop-action"
          type="button"
          aria-label="Copy address"
          onPress={() => void copyActiveAddress()}
          isIconOnly
          size="sm"
          variant="ghost"
        >
          <Copy size={15} />
        </Button>
        <Button
          className="browser-product-desktop-action"
          type="button"
          aria-label="Chrome profile"
          isIconOnly
          size="sm"
          variant="ghost"
        >
          <UserCircle size={16} />
        </Button>
        <Button
          className="browser-product-desktop-action"
          type="button"
          aria-label="Chrome menu"
          isIconOnly
          size="sm"
          variant="ghost"
        >
          <MoreVertical size={16} />
        </Button>
      </section>

      <section
        className={`browser-product-page browser-product-page-chrome ${showChromeHome ? "" : "browser-product-page-webview"}`}
        aria-label="Desktop browser content"
      >
        {showChromeHome ? (
          <section className="browser-product-start browser-product-chrome-home">
            <nav className="browser-product-chrome-links" aria-label="Chrome home links">
              <Button
                className="browser-product-mobile-hidden"
                type="button"
                size="sm"
                variant="ghost"
              >
                Gmail
              </Button>
              <Button
                className="browser-product-mobile-hidden"
                type="button"
                size="sm"
                variant="ghost"
              >
                Images
              </Button>
              <Button type="button" aria-label="Google apps" isIconOnly size="sm" variant="ghost">
                <Grid3X3 size={16} />
              </Button>
              <Button
                type="button"
                aria-label="Chrome profile"
                isIconOnly
                size="sm"
                variant="ghost"
              >
                <UserCircle size={18} />
              </Button>
            </nav>

            <div className="browser-product-google-logo" aria-label="Google">
              <span data-color="blue">G</span>
              <span data-color="red">o</span>
              <span data-color="yellow">o</span>
              <span data-color="blue">g</span>
              <span data-color="green">l</span>
              <span data-color="red">e</span>
            </div>

            <form
              className="browser-product-chrome-search"
              aria-label="Search Google or type a URL"
              onSubmit={(event) => {
                event.preventDefault();
                navigateActiveTab(addressDraft);
              }}
            >
              <Search size={18} />
              <Input
                value={addressDraft}
                onChange={(event) => setAddressDraft(event.target.value)}
                aria-label="Search Google or type a URL"
                placeholder="Search Google or type a URL"
                spellCheck={false}
                variant="secondary"
              />
              <Button type="button" aria-label="Voice search" isIconOnly size="sm" variant="ghost">
                <Mic size={16} />
              </Button>
              <Button
                type="button"
                aria-label="Search by image"
                isIconOnly
                size="sm"
                variant="ghost"
              >
                <Camera size={16} />
              </Button>
            </form>

            {error ? <div className="browser-product-error">{error}</div> : null}

            <div className="browser-product-grid" aria-label="Quick starts">
              {QUICK_STARTS.map((entry) => (
                <Button
                  type="button"
                  key={entry.url}
                  className="browser-product-quick-start"
                  onPress={() => navigateActiveTab(entry.url)}
                  variant="ghost"
                >
                  <span>{entry.label.slice(0, 1)}</span>
                  <strong>{entry.label}</strong>
                </Button>
              ))}
              <Button
                type="button"
                className="browser-product-quick-start"
                onPress={() => createNewTab()}
                variant="ghost"
              >
                <span>
                  <Plus size={20} />
                </span>
                <strong>Add shortcut</strong>
              </Button>
            </div>

            <Button type="button" className="browser-product-customize" size="sm" variant="ghost">
              <Pencil size={14} />
              Customize Chrome
            </Button>
          </section>
        ) : (
          <div
            className="browser-product-webview-placeholder"
            aria-label="Desktop browser web content"
          >
            {error ? <div className="browser-product-error">{error}</div> : null}
            <span>{activeTab?.loading ? `Opening ${activeTabTitle}` : activeTabTitle}</span>
          </div>
        )}
      </section>
    </main>
  );
}

export function BrowserLaunchPage({
  initialCaptureMode = null,
  initialChatGptAssistant,
  initialLdxpAssistant,
  initialProvider,
  initialTargetUrl,
}: BrowserLaunchPageProps) {
  const initialLdxpDraft = useMemo(
    () =>
      initialLdxpAssistant || isLdxpShopUrl(initialTargetUrl) ? readT3LdxpBrowserDraft() : null,
    [initialLdxpAssistant, initialTargetUrl]
  );
  const [address, setAddress] = useState(initialTargetUrl);
  const [copyNotice, setCopyNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [ldxpPaymentText, setLdxpPaymentText] = useState(() => initialLdxpDraft?.paymentText ?? "");
  const [ldxpFulfillmentText, setLdxpFulfillmentText] = useState(
    () => initialLdxpDraft?.fulfillmentText ?? ""
  );
  const [ldxpPaid, setLdxpPaid] = useState(() => initialLdxpDraft?.paid ?? false);
  const [chatGptSessionText, setChatGptSessionText] = useState("");
  const [chatGptCdkCode, setChatGptCdkCode] = useState("");
  const [chatGptVaultPassphrase, setChatGptVaultPassphrase] = useState("");
  const [chatGptVaultNotice, setChatGptVaultNotice] = useState<string | null>(null);
  const [codexOAuthBusy, setCodexOAuthBusy] = useState(false);
  const [codexOAuthNotice, setCodexOAuthNotice] = useState<string | null>(null);
  const [chatGptVaultAssessment, setChatGptVaultAssessment] =
    useState<T3ChatGptSessionAssessment | null>(null);
  const [chatGptEncryptedEnvelope, setChatGptEncryptedEnvelope] =
    useState<T3ChatGptEncryptedSessionEnvelope | null>(() => {
      try {
        const stored = window.localStorage.getItem(T3_CHATGPT_SESSION_VAULT_STORAGE_KEY);
        return stored ? (JSON.parse(stored) as T3ChatGptEncryptedSessionEnvelope) : null;
      } catch {
        return null;
      }
    });
  const secure = isSecureUrl(address);
  const currentHost = hostLabel(address);
  const isLdxpAssistant = initialLdxpAssistant;
  const isChatGptRechargeAssistant =
    initialChatGptAssistant && initialProvider === "chatgpt" && isChatGptUrl(address);
  const chatGptSessionAssessment = useMemo(
    () => chatGptVaultAssessment ?? assessT3ChatGptSession(chatGptSessionText),
    [chatGptSessionText, chatGptVaultAssessment]
  );
  const chatGptRechargeActions = useMemo(
    () => buildT3ChatGptRechargeActions(chatGptSessionAssessment, chatGptCdkCode),
    [chatGptCdkCode, chatGptSessionAssessment]
  );
  const ldxpPaymentPrompt = useMemo(
    () => parseT3LdxpPaymentPrompt(ldxpPaymentText),
    [ldxpPaymentText]
  );
  const ldxpFulfillmentPrompt = useMemo(
    () => parseT3LdxpFulfillmentPrompt(ldxpFulfillmentText),
    [ldxpFulfillmentText]
  );
  const ldxpFulfillmentActions = useMemo(
    () => buildT3LdxpFulfillmentActions(ldxpFulfillmentPrompt),
    [ldxpFulfillmentPrompt]
  );
  const ldxpPaymentReady = ldxpPaymentPrompt.status === "payment_code_ready";
  const ldxpFulfillmentReady = ldxpFulfillmentPrompt.status === "redeem_ready";
  const ldxpPickupRequired = ldxpFulfillmentPrompt.status === "pickup_required";
  const ldxpOrderStatus = ldxpFulfillmentReady
    ? "可交付"
    : ldxpPaid
      ? "待取货"
      : ldxpPaymentReady
        ? "待付款"
        : "待收款码";
  const ldxpCustomerStatus = ldxpFulfillmentReady
    ? "已取货，可兑换"
    : ldxpPaid
      ? "已付款，等待取货信息"
      : ldxpPaymentReady
        ? "请按付款码支付"
        : "等待老板生成付款码";
  const ldxpPaymentSummary = ldxpPaymentReady
    ? "付款码已就绪，可发给用户支付。"
    : "等待从 ldxp.cn 收银台粘贴付款码。";
  const ldxpFulfillmentSummary = ldxpFulfillmentReady
    ? "已识别卡密或兑换入口。"
    : ldxpPickupRequired
      ? "已识别取货线索。"
      : "等待支付后的取货页文本。";
  const ldxpTradeChecks = useMemo(
    () =>
      buildLdxpTradeChecks({
        fulfillmentReady: ldxpFulfillmentReady,
        paid: ldxpPaid,
        paymentPrompt: ldxpPaymentPrompt,
      }),
    [ldxpFulfillmentReady, ldxpPaid, ldxpPaymentPrompt]
  );
  const ldxpTradeRiskLevel = ldxpTradeChecks.some((check) => check.level === "danger")
    ? "danger"
    : ldxpTradeChecks.some((check) => check.level === "warning")
      ? "warning"
      : "success";
  const tabTitle = address.trim() ? currentHost : "New Tab";

  useEffect(() => {
    if (!isLdxpAssistant) {
      return;
    }
    try {
      window.localStorage.setItem(
        T3_LDXP_BROWSER_DRAFT_STORAGE_KEY,
        JSON.stringify({
          fulfillmentText: ldxpFulfillmentText,
          paid: ldxpPaid,
          paymentText: ldxpPaymentText,
        } satisfies T3LdxpBrowserDraft)
      );
    } catch {
      // Draft persistence is a convenience; the visible workflow remains usable without it.
    }
  }, [isLdxpAssistant, ldxpFulfillmentText, ldxpPaid, ldxpPaymentText]);

  if (!isLdxpAssistant && getT3BrowserChromeBridge()) {
    return (
      <BrowserChromeDesktopShell
        initialCaptureMode={initialCaptureMode}
        initialTargetUrl={initialTargetUrl}
      />
    );
  }

  function navigateToAddress(nextAddress = address) {
    try {
      const normalized = normalizeAddressInput(nextAddress);
      if (!normalized) {
        setError("Enter a web address to continue.");
        return;
      }
      setError(null);
      window.location.assign(normalized);
    } catch {
      setError("Use a valid http or https web address.");
    }
  }

  async function copyAddress() {
    try {
      const normalized = normalizeAddressInput(address);
      if (!normalized) {
        setError("Enter a web address before copying.");
        return;
      }
      await writeBrowserTextClipboard(normalized);
      setError(null);
    } catch {
      setError("Unable to copy this address in the current browser context.");
    }
  }

  async function copyLdxpPaymentBrief() {
    const lines = [
      "ldxp.cn 测试购买",
      `店铺：${T3_LDXP_AI_SHOP_URL}`,
      `分类：${T3_LDXP_TEST_CATEGORY_LABEL}`,
      `商品：0.1 AI 充值测试商品`,
      `金额：${formatCny(T3_LDXP_TEST_AMOUNT_CENTS)}`,
      ldxpPaymentPrompt.paymentCode ? `付款码：${ldxpPaymentPrompt.paymentCode}` : null,
    ].filter((line): line is string => line !== null);
    try {
      await writeBrowserTextClipboard(lines.join("\n"));
      setCopyNotice("付款信息已复制。");
      setError(null);
    } catch {
      setCopyNotice("当前浏览器限制自动复制，请手动选中付款码复制。");
      setError(null);
    }
  }

  function openChatGptHome() {
    setAddress(T3_CHATGPT_HOME_URL);
    navigateToAddress(T3_CHATGPT_HOME_URL);
  }

  function openChatGptSession() {
    setAddress(T3_CHATGPT_SESSION_URL);
    navigateToAddress(T3_CHATGPT_SESSION_URL);
  }

  async function openCodexOAuthLogin() {
    if (codexOAuthBusy) {
      return;
    }
    setCodexOAuthBusy(true);
    setCodexOAuthNotice(null);
    setError(null);
    try {
      const login = await startT3CodexOAuthLogin(T3_CODEX_OAUTH_BROWSER_WORKSPACE_ID);
      if (login.immediateSuccess) {
        setCodexOAuthNotice("内置 Codex 已连接。");
        return;
      }
      if (!login.authUrl.trim()) {
        throw new Error("Runtime did not return a Codex OAuth authorization URL.");
      }
      setCodexOAuthNotice("已在内置浏览器打开 Codex 授权页；完成后会保存本机 auth.json。");
      setAddress(login.authUrl);
      navigateToAddress(login.authUrl);
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Unable to start Codex OAuth.");
    } finally {
      setCodexOAuthBusy(false);
    }
  }

  async function encryptChatGptSessionLocally() {
    try {
      const envelope = await encryptT3ChatGptSessionVault({
        crypto: window.crypto,
        passphrase: chatGptVaultPassphrase,
        plaintextSession: chatGptSessionText,
      });
      window.localStorage.setItem(T3_CHATGPT_SESSION_VAULT_STORAGE_KEY, JSON.stringify(envelope));
      setChatGptEncryptedEnvelope(envelope);
      setChatGptSessionText("");
      setChatGptVaultAssessment(null);
      setChatGptVaultNotice("Session encrypted locally. Plaintext was cleared from the form.");
      setError(null);
    } catch (error) {
      setChatGptVaultNotice(
        error instanceof Error ? error.message : "Unable to encrypt ChatGPT session locally."
      );
    }
  }

  async function decryptChatGptSessionForAssessment() {
    if (!chatGptEncryptedEnvelope) {
      setChatGptVaultNotice("No encrypted ChatGPT session is saved locally.");
      return;
    }
    try {
      const plaintextSession = await decryptT3ChatGptSessionVault({
        crypto: window.crypto,
        envelope: chatGptEncryptedEnvelope,
        passphrase: chatGptVaultPassphrase,
      });
      setChatGptVaultAssessment(assessT3ChatGptSession(plaintextSession));
      setChatGptVaultNotice("Session decrypted in memory for status assessment only.");
      setError(null);
    } catch {
      setChatGptVaultNotice("Unable to decrypt session. Check the local vault passphrase.");
    }
  }

  function forgetChatGptSessionVault() {
    window.localStorage.removeItem(T3_CHATGPT_SESSION_VAULT_STORAGE_KEY);
    setChatGptEncryptedEnvelope(null);
    setChatGptVaultAssessment(null);
    setChatGptVaultNotice("Encrypted ChatGPT session was removed from local storage.");
  }

  if (isLdxpAssistant) {
    return (
      <main className="browser-product-shell browser-product-shell-ldxp">
        <header className="browser-product-ldxp-header" aria-label="ldxp.cn payment assistant">
          <div className="browser-product-ldxp-site">
            <span>站点名称</span>
            <strong>{currentHost}</strong>
          </div>
          <div className="browser-product-ldxp-header-meta" aria-label="ldxp.cn transaction facts">
            <span>
              <CreditCard size={13} />
              AI 充值 0.1
            </span>
            <span>
              <QrCode size={13} />
              {ldxpPaymentReady ? "付款码就绪" : "待收款码"}
            </span>
            <span>
              <PackageCheck size={13} />
              草稿已保存
            </span>
          </div>
          <Chip color={ldxpFulfillmentReady ? "success" : "warning"} size="sm" variant="soft">
            {ldxpOrderStatus}
          </Chip>
        </header>

        <section className="browser-product-ldxp-workflow" aria-label="ldxp.cn payment pickup flow">
          <div className="browser-product-ldxp-hero">
            <div className="browser-product-ldxp-title">
              <span>ldxp.cn · AI 充值测试</span>
              <h1>支付/取货助手</h1>
              <p>用户付款单、老板操作台和取货兑换状态合并在同一交易视图。</p>
            </div>
            <div className="browser-product-ldxp-summary" aria-label="ldxp.cn transaction summary">
              <span>应付金额</span>
              <strong>{formatCny(T3_LDXP_TEST_AMOUNT_CENTS)}</strong>
              <small>0.1 AI 充值测试商品</small>
            </div>
            <div className="browser-product-ldxp-steps" aria-label="ldxp.cn assistant steps">
              <span data-active={ldxpPaymentReady || ldxpPaid || ldxpFulfillmentReady}>
                <QrCode size={13} />
                收款码
              </span>
              <span data-active={ldxpPaid || ldxpFulfillmentReady}>
                <PackageCheck size={13} />
                确认支付
              </span>
              <span data-active={ldxpPickupRequired || ldxpFulfillmentReady}>
                <KeyRound size={13} />
                取货兑换
              </span>
            </div>
          </div>

          <div className="browser-product-ldxp-role-grid">
            <Card
              className="browser-product-ldxp-assistant browser-product-ldxp-receipt"
              variant="secondary"
              aria-label="ldxp.cn customer payment view"
            >
              <div className="browser-product-card-header">
                <span>
                  <CreditCard size={14} />
                  用户付款单
                </span>
                <Chip color={ldxpPaymentReady ? "success" : "warning"} size="sm" variant="soft">
                  {ldxpCustomerStatus}
                </Chip>
              </div>
              <div className="browser-product-ldxp-receipt-amount">
                <span>用户应付</span>
                <strong>{formatCny(T3_LDXP_TEST_AMOUNT_CENTS)}</strong>
                <small>商品确认后再扫码支付</small>
              </div>
              <div className="browser-product-ldxp-grid" aria-label="ldxp.cn product details">
                <span>
                  <strong>店铺</strong>
                  pay.ldxp.cn/shop/ku0
                </span>
                <span>
                  <strong>分类</strong>
                  {T3_LDXP_TEST_CATEGORY_LABEL}
                </span>
                <span>
                  <strong>商品</strong>
                  0.1 AI 充值测试商品
                </span>
                <span>
                  <strong>金额</strong>
                  {formatCny(T3_LDXP_TEST_AMOUNT_CENTS)}
                </span>
              </div>
              <div className="browser-product-ldxp-payment-code" data-ready={ldxpPaymentReady}>
                <span>付款码</span>
                <strong>{ldxpPaymentPrompt.paymentCode ?? "等待中转站老板粘贴"}</strong>
                <small>{ldxpPaymentSummary}</small>
              </div>
              <div
                className="browser-product-ldxp-fulfillment"
                data-status={ldxpFulfillmentPrompt.status}
              >
                <KeyRound size={15} />
                <span>
                  <strong>{ldxpFulfillmentSummary}</strong>
                  {ldxpFulfillmentPrompt.orderId ? (
                    <small>订单：{ldxpFulfillmentPrompt.orderId}</small>
                  ) : null}
                  {ldxpFulfillmentPrompt.pickupCode ? (
                    <small>取货码：{ldxpFulfillmentPrompt.pickupCode}</small>
                  ) : null}
                  {ldxpFulfillmentPrompt.cardKeys[0] ? (
                    <small>卡密：{ldxpFulfillmentPrompt.cardKeys[0]}</small>
                  ) : null}
                </span>
              </div>
            </Card>

            <Card
              className="browser-product-ldxp-assistant browser-product-ldxp-operator-panel"
              variant="secondary"
              aria-label="ldxp.cn operator console"
            >
              <div className="browser-product-card-header">
                <span>
                  <PackageCheck size={14} />
                  中转站老板操作台
                </span>
                <Chip color={ldxpPaid ? "success" : "warning"} size="sm" variant="soft">
                  {ldxpPaid ? "已确认支付" : "待确认支付"}
                </Chip>
              </div>
              <div className="browser-product-ldxp-step-block">
                <div className="browser-product-ldxp-step-label">
                  <span>01</span>
                  <strong>从 ldxp 收银台粘贴付款码</strong>
                </div>
                <label htmlFor="browser-ldxp-payment-code">
                  <span>收银台付款码 / 二维码内容 / 支付链接</span>
                  <TextArea
                    id="browser-ldxp-payment-code"
                    value={ldxpPaymentText}
                    onChange={(event) => {
                      setLdxpPaymentText(event.target.value);
                      setCopyNotice(null);
                    }}
                    aria-label="ldxp.cn payment code"
                    rows={4}
                    variant="secondary"
                  />
                </label>
              </div>
              <div className="browser-product-ldxp-payment" data-ready={ldxpPaymentReady}>
                <QrCode size={15} />
                <span>
                  <strong>{ldxpPaymentSummary}</strong>
                  {ldxpPaymentPrompt.paymentCode ? (
                    <small>付款码：{ldxpPaymentPrompt.paymentCode}</small>
                  ) : (
                    <small>只接受 ldxp.cn 收银台生成的付款信息。</small>
                  )}
                </span>
              </div>
              <div
                className="browser-product-ldxp-checks"
                data-risk={ldxpTradeRiskLevel}
                aria-label="ldxp.cn smart transaction checks"
              >
                <div className="browser-product-card-header">
                  <span>
                    {ldxpTradeRiskLevel === "danger" ? (
                      <TriangleAlert size={14} />
                    ) : (
                      <ShieldCheck size={14} />
                    )}
                    智能交易检查
                  </span>
                  <Chip
                    color={ldxpTradeRiskLevel === "success" ? "success" : "warning"}
                    size="sm"
                    variant="soft"
                  >
                    {ldxpTradeRiskLevel === "success"
                      ? "可继续"
                      : ldxpTradeRiskLevel === "danger"
                        ? "需修正"
                        : "需核对"}
                  </Chip>
                </div>
                <div className="browser-product-ldxp-check-list">
                  {ldxpTradeChecks.map((check) => (
                    <span key={check.label} data-level={check.level}>
                      {check.level === "danger" ? (
                        <TriangleAlert size={13} />
                      ) : (
                        <ShieldCheck size={13} />
                      )}
                      <strong>{check.label}</strong>
                      {check.summary}
                    </span>
                  ))}
                </div>
              </div>
              <div className="browser-product-ldxp-step-block">
                <div className="browser-product-ldxp-step-label">
                  <span>02</span>
                  <strong>发送付款信息并确认到账</strong>
                </div>
                <div className="browser-product-actions">
                  <Button
                    type="button"
                    onPress={() => void copyLdxpPaymentBrief()}
                    size="md"
                    variant="outline"
                  >
                    <Copy size={15} />
                    复制付款信息
                  </Button>
                  <Button
                    type="button"
                    onPress={() => {
                      if (ldxpPaymentReady) {
                        setLdxpPaid(true);
                      }
                    }}
                    aria-disabled={!ldxpPaymentReady}
                    size="md"
                    variant="primary"
                  >
                    <PackageCheck size={15} />
                    确认用户已支付
                  </Button>
                </div>
                {copyNotice ? (
                  <div className="browser-product-ldxp-copy-notice">{copyNotice}</div>
                ) : null}
              </div>
              <div className="browser-product-ldxp-section-header">
                <div className="browser-product-card-header">
                  <span>
                    <KeyRound size={14} />
                    取货兑换流程
                  </span>
                  <Chip
                    color={ldxpFulfillmentReady ? "success" : "warning"}
                    size="sm"
                    variant="soft"
                  >
                    {ldxpFulfillmentReady ? "可兑换" : "待取货"}
                  </Chip>
                </div>
                <div className="browser-product-ldxp-step-label">
                  <span>03</span>
                  <strong>粘贴支付后的取货页文本</strong>
                </div>
                <label htmlFor="browser-ldxp-fulfillment">
                  <span>支付后页面提示 / 取货页文本</span>
                  <TextArea
                    id="browser-ldxp-fulfillment"
                    value={ldxpFulfillmentText}
                    onChange={(event) => setLdxpFulfillmentText(event.target.value)}
                    aria-label="ldxp.cn fulfillment prompt"
                    rows={5}
                    variant="secondary"
                  />
                </label>
              </div>
              <div className="browser-product-ldxp-actions" aria-label="ldxp.cn next actions">
                {ldxpFulfillmentActions.map((action) => (
                  <span key={action}>
                    <ClipboardCheck size={13} />
                    {localizeLdxpFulfillmentAction(action)}
                  </span>
                ))}
              </div>
              {error ? <div className="browser-product-error">{error}</div> : null}
            </Card>
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className="browser-product-shell browser-product-shell-chrome">
      <header className="browser-product-topbar" aria-label="Browser window controls">
        <div className="browser-product-window-controls" aria-hidden="true">
          <span />
          <span />
          <span />
        </div>
        <Card className="browser-product-tab active" variant="secondary">
          <Globe2 size={14} />
          <span>{tabTitle}</span>
        </Card>
        <Button
          type="button"
          aria-label="New tab"
          isIconOnly
          size="sm"
          variant="ghost"
          onPress={() => {
            setAddress("");
            setError(null);
          }}
        >
          <Plus size={16} />
        </Button>
        <div className="browser-product-topbar-spacer" />
      </header>

      <section className="browser-product-toolbar" aria-label="Browser toolbar">
        <Button
          type="button"
          aria-label="Back"
          aria-disabled={true}
          isIconOnly
          size="sm"
          variant="ghost"
        >
          <ArrowLeft size={15} />
        </Button>
        <Button
          type="button"
          aria-label="Forward"
          aria-disabled={true}
          isIconOnly
          size="sm"
          variant="ghost"
        >
          <ArrowRight size={15} />
        </Button>
        <Button
          type="button"
          aria-label="Reload"
          onPress={() => navigateToAddress()}
          isIconOnly
          size="sm"
          variant="ghost"
        >
          <RefreshCw size={15} />
        </Button>
        <Button
          type="button"
          aria-label="Home"
          onPress={() => {
            setAddress(T3_CHATGPT_HOME_URL);
            navigateToAddress(T3_CHATGPT_HOME_URL);
          }}
          isIconOnly
          size="sm"
          variant="ghost"
        >
          <Home size={15} />
        </Button>
        <form
          className={`browser-product-address ${secure ? "secure" : "insecure"}`}
          onSubmit={(event) => {
            event.preventDefault();
            navigateToAddress();
          }}
        >
          {secure ? <Lock size={14} /> : <TriangleAlert size={14} />}
          <Input
            value={address}
            onChange={(event) => setAddress(event.target.value)}
            aria-label="Browser address"
            spellCheck={false}
            variant="secondary"
          />
          <Button type="submit" aria-label="Go to address" isIconOnly size="sm" variant="ghost">
            <Search size={14} />
          </Button>
        </form>
        <Button
          className="browser-product-desktop-action"
          type="button"
          aria-label="Bookmark"
          isIconOnly
          size="sm"
          variant="ghost"
        >
          <Star size={15} />
        </Button>
        <Button
          className="browser-product-desktop-action"
          type="button"
          aria-label="Copy address"
          onPress={() => void copyAddress()}
          isIconOnly
          size="sm"
          variant="ghost"
        >
          <Copy size={15} />
        </Button>
        <Button
          className="browser-product-desktop-action"
          type="button"
          aria-label="Chrome profile"
          isIconOnly
          size="sm"
          variant="ghost"
        >
          <UserCircle size={16} />
        </Button>
        <Button
          className="browser-product-desktop-action"
          type="button"
          aria-label="Chrome menu"
          isIconOnly
          size="sm"
          variant="ghost"
        >
          <MoreVertical size={16} />
        </Button>
      </section>

      <section className="browser-product-page browser-product-page-chrome">
        <section className="browser-product-start browser-product-chrome-home">
          <nav className="browser-product-chrome-links" aria-label="Chrome home links">
            <Button
              className="browser-product-mobile-hidden"
              type="button"
              size="sm"
              variant="ghost"
            >
              Gmail
            </Button>
            <Button
              className="browser-product-mobile-hidden"
              type="button"
              size="sm"
              variant="ghost"
            >
              Images
            </Button>
            <Button type="button" aria-label="Google apps" isIconOnly size="sm" variant="ghost">
              <Grid3X3 size={16} />
            </Button>
            <Button type="button" aria-label="Chrome profile" isIconOnly size="sm" variant="ghost">
              <UserCircle size={18} />
            </Button>
          </nav>

          <div className="browser-product-google-logo" aria-label="Google">
            <span data-color="blue">G</span>
            <span data-color="red">o</span>
            <span data-color="yellow">o</span>
            <span data-color="blue">g</span>
            <span data-color="green">l</span>
            <span data-color="red">e</span>
          </div>

          <form
            className="browser-product-chrome-search"
            aria-label="Search Google or type a URL"
            onSubmit={(event) => {
              event.preventDefault();
              navigateToAddress();
            }}
          >
            <Search size={18} />
            <Input
              value={address}
              onChange={(event) => setAddress(event.target.value)}
              aria-label="Search Google or type a URL"
              placeholder="Search Google or type a URL"
              spellCheck={false}
              variant="secondary"
            />
            <Button type="button" aria-label="Voice search" isIconOnly size="sm" variant="ghost">
              <Mic size={16} />
            </Button>
            <Button type="button" aria-label="Search by image" isIconOnly size="sm" variant="ghost">
              <Camera size={16} />
            </Button>
          </form>

          {error ? <div className="browser-product-error">{error}</div> : null}

          <div className="browser-product-grid" aria-label="Quick starts">
            {QUICK_STARTS.map((entry) => (
              <Button
                type="button"
                key={entry.url}
                className="browser-product-quick-start"
                onPress={() => {
                  setAddress(entry.url);
                  navigateToAddress(entry.url);
                }}
                variant="ghost"
              >
                <span>{entry.label.slice(0, 1)}</span>
                <strong>{entry.label}</strong>
              </Button>
            ))}
            <Button
              type="button"
              className="browser-product-quick-start"
              onPress={() => {
                setAddress("");
                setError(null);
              }}
              variant="ghost"
            >
              <span>
                <Plus size={20} />
              </span>
              <strong>Add shortcut</strong>
            </Button>
          </div>

          {isChatGptRechargeAssistant ? (
            <div className="browser-product-assistant-panel">
              <T3ChatGptBrowserAssistantCard
                cdkCode={chatGptCdkCode}
                codexOAuthBusy={codexOAuthBusy}
                codexOAuthNotice={codexOAuthNotice}
                encryptedEnvelopeLabel={assessEncryptedT3ChatGptSessionEnvelope(
                  chatGptEncryptedEnvelope
                )}
                rechargeActions={chatGptRechargeActions}
                sessionAssessment={chatGptSessionAssessment}
                sessionText={chatGptSessionText}
                vaultNotice={chatGptVaultNotice}
                vaultPassphrase={chatGptVaultPassphrase}
                onCdkCodeChange={setChatGptCdkCode}
                onDecryptSession={() => void decryptChatGptSessionForAssessment()}
                onEncryptSession={() => void encryptChatGptSessionLocally()}
                onForgetSessionVault={forgetChatGptSessionVault}
                onOpenChatGptHome={openChatGptHome}
                onOpenChatGptSession={openChatGptSession}
                onOpenCodexOAuthLogin={() => void openCodexOAuthLogin()}
                onSessionTextChange={(value) => {
                  setChatGptSessionText(value);
                  setChatGptVaultAssessment(null);
                }}
                onVaultPassphraseChange={setChatGptVaultPassphrase}
              />
            </div>
          ) : null}

          <Button type="button" className="browser-product-customize" size="sm" variant="ghost">
            <Pencil size={14} />
            Customize Chrome
          </Button>
        </section>
      </section>
    </main>
  );
}
