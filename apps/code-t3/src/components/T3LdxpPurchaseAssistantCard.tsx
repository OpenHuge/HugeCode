import { Button, Card, Chip, Input, TextArea } from "@heroui/react";
import {
  ClipboardCheck,
  ExternalLink,
  KeyRound,
  PackageCheck,
  QrCode,
  ShoppingBag,
  Sparkles,
} from "lucide-react";
import { useMemo, useState } from "react";
import {
  buildT3LdxpFulfillmentActions,
  createT3LdxpPurchasePlan,
  markT3LdxpQrPaymentScanned,
  parseT3LdxpFulfillmentPrompt,
  recommendT3LdxpAiProducts,
  T3_LDXP_TEST_AMOUNT_CENTS,
  T3_LDXP_TEST_CATEGORY_LABEL,
  type T3LdxpPurchasePlan,
} from "../runtime/t3LdxpPurchaseAssistant";

export type T3LdxpPurchaseAssistantCardProps = {
  onNotice: (notice: string) => void;
  onOpenShop?: (url: string) => void | Promise<void>;
};

function formatPrice(cents: number) {
  return new Intl.NumberFormat("zh-CN", {
    currency: "CNY",
    style: "currency",
  }).format(cents / 100);
}

export function T3LdxpPurchaseAssistantCard({
  onNotice,
  onOpenShop,
}: T3LdxpPurchaseAssistantCardProps) {
  const [need, setNeed] = useState("访问测试店铺 ku0，选择 AI 充值分类，购买 0.1 的商品");
  const [budget, setBudget] = useState("0.1");
  const [selectedProductId, setSelectedProductId] = useState<string | null>(
    "ldxp-ku0-ai-recharge-0_1"
  );
  const [purchasePlan, setPurchasePlan] = useState<T3LdxpPurchasePlan | null>(null);
  const [fulfillmentPrompt, setFulfillmentPrompt] = useState("");
  const parsedFulfillment = useMemo(
    () => parseT3LdxpFulfillmentPrompt(fulfillmentPrompt),
    [fulfillmentPrompt]
  );
  const fulfillmentActions = useMemo(
    () => buildT3LdxpFulfillmentActions(parsedFulfillment),
    [parsedFulfillment]
  );
  const budgetCents = Math.round(Number(budget) * 100);
  const recommendations = useMemo(
    () =>
      recommendT3LdxpAiProducts({
        budgetCents: Number.isFinite(budgetCents) ? budgetCents : null,
        need,
      }).slice(0, 3),
    [budgetCents, need]
  );

  function createPlan() {
    try {
      const plan = createT3LdxpPurchasePlan({
        budgetCents: Number.isFinite(budgetCents) ? budgetCents : null,
        need,
        productId: selectedProductId,
      });
      setSelectedProductId(plan.product.id);
      setPurchasePlan(plan);
      onNotice(`已为 ldxp.cn 生成购买建议：${plan.product.label}。`);
      return plan;
    } catch (error) {
      onNotice(error instanceof Error ? error.message : "Unable to create ldxp.cn purchase plan.");
      return null;
    }
  }

  function confirmQrPayment() {
    if (!purchasePlan) {
      onNotice("先生成 ldxp.cn 购买建议，再确认扫码支付。");
      return;
    }
    setPurchasePlan(markT3LdxpQrPaymentScanned(purchasePlan));
    onNotice("已进入取货提示解析步骤。请粘贴 ldxp.cn 支付后页面提示。");
  }

  function openShop() {
    const plan = purchasePlan ?? createPlan();
    if (!plan) {
      return;
    }
    if (onOpenShop) {
      void onOpenShop(plan.checkoutUrl);
      return;
    }
    const launchUrl = new URL(window.location.href);
    launchUrl.search = "";
    launchUrl.hash = "";
    launchUrl.searchParams.set("hcbrowser", "1");
    launchUrl.searchParams.set("target", plan.checkoutUrl);
    launchUrl.searchParams.set("provider", "custom");
    launchUrl.searchParams.set("profile", "Current browser profile");
    launchUrl.searchParams.set("profileId", "current-browser");
    launchUrl.searchParams.set("appLabel", "ldxp.cn AI 充值");
    launchUrl.searchParams.set("ldxpAssistant", "1");
    window.open(launchUrl.toString(), "_blank", "popup,width=1180,height=860,noopener,noreferrer");
    onNotice("已在 T3 内置浏览器打开 ldxp.cn 测试店铺。付款请由用户扫码完成。");
  }

  const activeStage = purchasePlan?.stage ?? "selecting";

  return (
    <Card className="t3-ldxp-assistant" variant="secondary" aria-label="ldxp.cn AI purchase">
      <Card.Header className="t3-browser-card-header">
        <span>
          <ShoppingBag size={13} />
          ldxp.cn AI 购买助手
        </span>
        <Chip size="sm" variant="tertiary">
          {activeStage}
        </Chip>
      </Card.Header>
      <small>
        测试目标：店铺 ku0，分类 {T3_LDXP_TEST_CATEGORY_LABEL}，商品金额{" "}
        {formatPrice(T3_LDXP_TEST_AMOUNT_CENTS)}。内置浏览器会展示商品信息和付款码给用户支付。
      </small>
      <div className="t3-ldxp-flow" aria-label="ldxp.cn purchase flow">
        <span data-active={activeStage === "selecting"}>
          <Sparkles size={13} />
          选品
        </span>
        <span data-active={activeStage === "awaiting_qr_payment"}>
          <QrCode size={13} />
          扫码
        </span>
        <span data-active={activeStage === "awaiting_fulfillment_prompt"}>
          <PackageCheck size={13} />
          取货
        </span>
        <span data-active={parsedFulfillment.status === "redeem_ready"}>
          <KeyRound size={13} />
          兑换
        </span>
      </div>
      <label htmlFor="t3-ldxp-need">
        <span>用户需求</span>
        <TextArea
          id="t3-ldxp-need"
          value={need}
          onChange={(event) => setNeed(event.target.value)}
          aria-label="ldxp.cn AI purchase need"
          rows={3}
          variant="secondary"
        />
      </label>
      <label htmlFor="t3-ldxp-budget">
        <span>预算（元）</span>
        <Input
          id="t3-ldxp-budget"
          value={budget}
          onChange={(event) => setBudget(event.target.value)}
          aria-label="ldxp.cn purchase budget"
          inputMode="decimal"
          variant="secondary"
        />
      </label>
      <div className="t3-ldxp-recommendations" aria-label="ldxp.cn AI product recommendations">
        {recommendations.map((product) => (
          <button
            type="button"
            key={product.id}
            data-selected={selectedProductId === product.id}
            onClick={() => setSelectedProductId(product.id)}
          >
            <strong>{product.label}</strong>
            <small>{product.summary}</small>
            <span>{formatPrice(product.budgetCents)}</span>
          </button>
        ))}
      </div>
      {purchasePlan ? (
        <div className="t3-ldxp-plan" aria-label="ldxp.cn selected purchase plan">
          <strong>{purchasePlan.product.label}</strong>
          <small>{purchasePlan.product.riskNote}</small>
          <small>{purchasePlan.product.redeemHint}</small>
        </div>
      ) : null}
      <div className="t3-product-actions">
        <Button type="button" size="md" variant="primary" onPress={createPlan}>
          <Sparkles size={14} />
          生成建议
        </Button>
        <Button
          type="button"
          size="md"
          variant="outline"
          onPress={openShop}
          aria-disabled={!purchasePlan}
        >
          <ExternalLink size={14} />
          打开店铺
        </Button>
        <Button
          type="button"
          size="md"
          variant="outline"
          onPress={confirmQrPayment}
          aria-disabled={!purchasePlan}
        >
          <QrCode size={14} />
          已扫码支付
        </Button>
      </div>
      <label htmlFor="t3-ldxp-fulfillment">
        <span>支付后页面提示 / 取货页文本</span>
        <TextArea
          id="t3-ldxp-fulfillment"
          value={fulfillmentPrompt}
          onChange={(event) => setFulfillmentPrompt(event.target.value)}
          aria-label="ldxp.cn fulfillment page prompt"
          rows={5}
          variant="secondary"
        />
      </label>
      <div className="t3-ldxp-fulfillment" data-status={parsedFulfillment.status}>
        <strong>{parsedFulfillment.summary}</strong>
        {parsedFulfillment.orderId ? <span>订单：{parsedFulfillment.orderId}</span> : null}
        {parsedFulfillment.pickupCode ? <span>取货码：{parsedFulfillment.pickupCode}</span> : null}
        {parsedFulfillment.cardKeys.length > 0 ? (
          <span>卡密：{parsedFulfillment.cardKeys[0]}</span>
        ) : null}
      </div>
      <div className="t3-ldxp-actions" aria-label="ldxp.cn fulfillment actions">
        {fulfillmentActions.map((action) => (
          <span key={action}>
            <ClipboardCheck size={13} />
            {action}
          </span>
        ))}
      </div>
    </Card>
  );
}
