import { describe, expect, it } from "vitest";
import {
  buildT3LdxpFulfillmentActions,
  createT3LdxpPurchasePlan,
  markT3LdxpQrPaymentScanned,
  parseT3LdxpFulfillmentPrompt,
  parseT3LdxpPaymentPrompt,
  recommendT3LdxpAiProducts,
  T3_LDXP_AI_SHOP_URL,
} from "./t3LdxpPurchaseAssistant";

describe("t3LdxpPurchaseAssistant", () => {
  it("recommends the ku0 AI recharge 0.1 test product from user intent", () => {
    const [recommendation] = recommendT3LdxpAiProducts({
      budgetCents: 10,
      need: "访问测试店铺 ku0，选择 AI 充值分类，购买 0.1 的商品",
    });

    expect(recommendation).toEqual(
      expect.objectContaining({
        checkoutUrl: expect.stringContaining(T3_LDXP_AI_SHOP_URL),
        id: "ldxp-ku0-ai-recharge-0_1",
      })
    );
  });

  it("creates a manual QR payment plan without payment credentials", () => {
    const plan = createT3LdxpPurchasePlan({
      budgetCents: 10,
      need: "买 AI 充值 0.1 测试商品",
    });

    expect(plan.stage).toBe("awaiting_qr_payment");
    expect(plan.checkoutUrl).toContain("https://pay.ldxp.cn/shop/ku0");
    expect(plan.product.categoryLabel).toBe("AI 充值");
    expect(plan.product.budgetCents).toBe(10);
    expect(JSON.stringify(plan)).not.toContain("password");
    expect(markT3LdxpQrPaymentScanned(plan).stage).toBe("awaiting_fulfillment_prompt");
  });

  it("parses cashier payment code details before asking the user to pay", () => {
    const parsed = parseT3LdxpPaymentPrompt(`
      商品：AI 充值 0.1 测试商品
      金额：￥0.10
      付款码：https://pay.ldxp.cn/cashier/qr/abc123
    `);

    expect(parsed).toEqual(
      expect.objectContaining({
        amountCents: 10,
        paymentCode: "https://pay.ldxp.cn/cashier/qr/abc123",
        productLabel: "AI 充值 0.1 测试商品",
        status: "payment_code_ready",
      })
    );
  });

  it("parses order, pickup, card key, and redemption clues from page prompts", () => {
    const parsed = parseT3LdxpFulfillmentPrompt(`
      支付成功，订单号：LDXP202604280001
      取货码：ABCD88
      卡密：AI-2026-CODE-88
      兑换地址：https://ldxp.cn/redeem
    `);

    expect(parsed).toEqual(
      expect.objectContaining({
        cardKeys: ["AI-2026-CODE-88"],
        orderId: "LDXP202604280001",
        pickupCode: "ABCD88",
        redeemUrls: ["https://ldxp.cn/redeem"],
        status: "redeem_ready",
      })
    );
    expect(buildT3LdxpFulfillmentActions(parsed)).toEqual(
      expect.arrayContaining([
        "Use order id LDXP202604280001 when the page asks for an order query.",
        "Use pickup code ABCD88 when the page asks for delivery proof.",
        "Open redemption page: https://ldxp.cn/redeem",
        "Redeem card key: AI-2026-CODE-88",
      ])
    );
  });

  it("returns a pickup-required state when payment page gives only delivery hints", () => {
    const parsed = parseT3LdxpFulfillmentPrompt(
      "付款后请到 https://pay.ldxp.cn/order 查询，输入订单编号 20260428ABCDEF 和取卡密码 KQ88"
    );

    expect(parsed.status).toBe("pickup_required");
    expect(parsed.pickupUrls).toEqual(["https://pay.ldxp.cn/order"]);
    expect(parsed.pickupCode).toBe("KQ88");
  });
});
