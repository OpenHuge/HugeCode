import { Button, Card, Chip, Input, TextArea } from "@heroui/react";
import {
  ClipboardCheck,
  CreditCard,
  KeyRound,
  PackageCheck,
  QrCode,
  ShoppingBag,
  Sparkles,
} from "lucide-react";
import { useMemo, useState } from "react";
import {
  buildT3LdxpEmbeddedCheckoutState,
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
};

function formatPrice(cents: number) {
  return new Intl.NumberFormat("zh-CN", {
    currency: "CNY",
    style: "currency",
  }).format(cents / 100);
}

export function T3LdxpPurchaseAssistantCard({ onNotice }: T3LdxpPurchaseAssistantCardProps) {
  const [need, setNeed] = useState("访问测试店铺 ku0，选择 AI 充值分类，购买 0.1 的商品");
  const [budget, setBudget] = useState("0.1");
  const [selectedProductId, setSelectedProductId] = useState<string | null>(
    "ldxp-ku0-ai-recharge-0_1"
  );
  const [purchasePlan, setPurchasePlan] = useState<T3LdxpPurchasePlan | null>(null);
  const [cashierPrompt, setCashierPrompt] = useState(
    "商品：AI 充值 0.1 测试商品\n金额：￥0.10\n付款码："
  );
  const [fulfillmentPrompt, setFulfillmentPrompt] = useState("");
  const parsedFulfillment = useMemo(
    () => parseT3LdxpFulfillmentPrompt(fulfillmentPrompt),
    [fulfillmentPrompt]
  );
  const checkoutState = useMemo(
    () =>
      purchasePlan
        ? buildT3LdxpEmbeddedCheckoutState({
            cashierPrompt,
            fulfillmentPrompt,
            plan: purchasePlan,
          })
        : null,
    [cashierPrompt, fulfillmentPrompt, purchasePlan]
  );
  const fulfillmentActions = useMemo(
    () => buildT3LdxpFulfillmentActions(checkoutState?.fulfillment ?? parsedFulfillment),
    [checkoutState, parsedFulfillment]
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
      onNotice(`已在程序内生成 ldxp.cn 订单草稿：${plan.product.label}。`);
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

  function prepareCashier() {
    const plan = purchasePlan ?? createPlan();
    if (!plan) {
      return;
    }
    setCashierPrompt(
      [
        `商品：${plan.product.label}`,
        `金额：${formatPrice(plan.product.budgetCents)}`,
        "付款码：",
      ].join("\n")
    );
    onNotice("已准备程序内收银信息。粘贴支付桥返回的付款码后，用户可在程序内确认付款。");
  }

  const activeStage = checkoutState?.plan.stage ?? purchasePlan?.stage ?? "selecting";
  const payment = checkoutState?.payment;
  const fulfillment = checkoutState?.fulfillment ?? parsedFulfillment;

  return (
    <Card className="t3-ldxp-assistant" variant="secondary" aria-label="账户充值">
      <Card.Header className="t3-browser-card-header">
        <span>
          <ShoppingBag size={13} />
          账户充值
        </span>
        <Chip size="sm" variant="tertiary">
          {activeStage}
        </Chip>
      </Card.Header>
      <small>
        测试目标：店铺 ku0，分类 {T3_LDXP_TEST_CATEGORY_LABEL}，商品金额{" "}
        {formatPrice(T3_LDXP_TEST_AMOUNT_CENTS)}
        。程序内只处理商品、付款码和取货提示，不在前端保存密钥。
      </small>
      <div className="t3-ldxp-flow" aria-label="ldxp.cn purchase flow">
        <span data-active={activeStage === "selecting"}>
          <Sparkles size={13} />
          选品
        </span>
        <span data-active={activeStage === "awaiting_qr_payment"}>
          <CreditCard size={13} />
          收银
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
          rows={2}
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
          生成订单
        </Button>
        <Button
          type="button"
          size="md"
          variant="outline"
          onPress={prepareCashier}
          aria-disabled={!purchasePlan}
        >
          <CreditCard size={14} />
          程序内收银
        </Button>
        <Button
          type="button"
          size="md"
          variant="outline"
          onPress={confirmQrPayment}
          aria-disabled={!purchasePlan}
        >
          <QrCode size={14} />
          已付款
        </Button>
      </div>
      <label htmlFor="t3-ldxp-cashier">
        <span>程序内收银提示 / 付款码</span>
        <TextArea
          id="t3-ldxp-cashier"
          value={cashierPrompt}
          onChange={(event) => setCashierPrompt(event.target.value)}
          aria-label="ldxp.cn cashier prompt"
          rows={3}
          variant="secondary"
        />
      </label>
      {payment ? (
        <div className="t3-ldxp-payment" data-ready={payment.status === "payment_code_ready"}>
          <strong>{payment.summary}</strong>
          {payment.amountCents ? <span>金额：{formatPrice(payment.amountCents)}</span> : null}
          {payment.productLabel ? <span>商品：{payment.productLabel}</span> : null}
          {payment.paymentCode ? <span>付款码：{payment.paymentCode}</span> : null}
        </div>
      ) : null}
      <label htmlFor="t3-ldxp-fulfillment">
        <span>支付后页面提示 / 取货页文本</span>
        <TextArea
          id="t3-ldxp-fulfillment"
          value={fulfillmentPrompt}
          onChange={(event) => setFulfillmentPrompt(event.target.value)}
          aria-label="ldxp.cn fulfillment page prompt"
          rows={3}
          variant="secondary"
        />
      </label>
      <div className="t3-ldxp-fulfillment" data-status={fulfillment.status}>
        <strong>{checkoutState?.summary ?? fulfillment.summary}</strong>
        {fulfillment.orderId ? <span>订单：{fulfillment.orderId}</span> : null}
        {fulfillment.pickupCode ? <span>取货码：{fulfillment.pickupCode}</span> : null}
        {fulfillment.cardKeys.length > 0 ? <span>卡密：{fulfillment.cardKeys[0]}</span> : null}
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
