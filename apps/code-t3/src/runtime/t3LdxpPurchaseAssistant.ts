export type T3LdxpPurchaseStage =
  | "selecting"
  | "awaiting_qr_payment"
  | "awaiting_fulfillment_prompt"
  | "redeem_ready";

export type T3LdxpAiProduct = {
  budgetCents: number;
  categoryLabel: string;
  checkoutUrl: string;
  fitKeywords: readonly string[];
  id: string;
  label: string;
  redeemHint: string;
  riskNote: string;
  summary: string;
};

export type T3LdxpPurchasePlan = {
  checkoutUrl: string;
  createdAt: number;
  id: string;
  product: T3LdxpAiProduct;
  stage: T3LdxpPurchaseStage;
  userNeed: string;
};

export type T3LdxpEmbeddedCheckoutState = {
  fulfillment: T3LdxpFulfillmentPrompt;
  payment: T3LdxpPaymentPrompt;
  plan: T3LdxpPurchasePlan;
  readyForUserPayment: boolean;
  summary: string;
};

export type T3LdxpFulfillmentPrompt = {
  cardKeys: readonly string[];
  orderId: string | null;
  pickupCode: string | null;
  pickupUrls: readonly string[];
  redeemUrls: readonly string[];
  status: "awaiting_page_prompt" | "pickup_required" | "redeem_ready";
  summary: string;
};

export type T3LdxpPaymentPrompt = {
  amountCents: number | null;
  paymentCode: string | null;
  paymentUrls: readonly string[];
  productLabel: string | null;
  status: "awaiting_payment_code" | "payment_code_ready";
  summary: string;
};

export const T3_LDXP_TEST_SHOP_SLUG = "ku0";
export const T3_LDXP_TEST_CATEGORY_LABEL = "AI 充值";
export const T3_LDXP_TEST_AMOUNT_CENTS = 10;
export const T3_LDXP_AI_SHOP_URL = `https://pay.ldxp.cn/shop/${T3_LDXP_TEST_SHOP_SLUG}`;

const PRODUCT_CATALOG: readonly T3LdxpAiProduct[] = [
  {
    budgetCents: T3_LDXP_TEST_AMOUNT_CENTS,
    categoryLabel: T3_LDXP_TEST_CATEGORY_LABEL,
    checkoutUrl: T3_LDXP_AI_SHOP_URL,
    fitKeywords: ["0.1", "测试", "ai 充值", "充值", "低价", "test", "trial"],
    id: "ldxp-ku0-ai-recharge-0_1",
    label: "AI 充值 0.1 测试商品",
    redeemHint: "支付后按测试店铺页面提示进入取货页，读取卡密或兑换链接。",
    riskNote: "测试购买金额为 0.1 元；付款码必须来自 ldxp.cn 页面，应用不生成或代付。",
    summary: "用于真实流程验证的 ldxp.cn ku0 店铺 AI 充值分类 0.1 元商品。",
  },
  {
    budgetCents: 2990,
    categoryLabel: T3_LDXP_TEST_CATEGORY_LABEL,
    checkoutUrl: T3_LDXP_AI_SHOP_URL,
    fitKeywords: ["写代码", "编程", "codex", "claude", "chatgpt", "开发", "coding", "code"],
    id: "ldxp-ai-coding",
    label: "AI 编程优先",
    redeemHint: "优先选择有明确兑换链接或卡密格式的商品，兑换后再绑定到 HugeCode 路由。",
    riskNote: "确认商品说明包含有效期、并发限制和是否允许 API/CLI 使用。",
    summary: "面向代码助手、模型额度和开发工作流，优先保障稳定性与可兑换性。",
  },
  {
    budgetCents: 3990,
    categoryLabel: T3_LDXP_TEST_CATEGORY_LABEL,
    checkoutUrl: T3_LDXP_AI_SHOP_URL,
    fitKeywords: ["画图", "图片", "视频", "设计", "creative", "image", "video"],
    id: "ldxp-ai-creative",
    label: "AI 创作套餐",
    redeemHint: "支付后检查页面是否给出平台兑换入口、账号使用说明或一次性卡密。",
    riskNote: "创作类商品常有地区、设备或账号限制，按页面说明先完成兑换再使用。",
    summary: "面向图片、视频、设计素材生成，适合需要创作额度的场景。",
  },
  {
    budgetCents: 5990,
    categoryLabel: T3_LDXP_TEST_CATEGORY_LABEL,
    checkoutUrl: T3_LDXP_AI_SHOP_URL,
    fitKeywords: ["团队", "多人", "长期", "稳定", "team", "multi", "month"],
    id: "ldxp-ai-team",
    label: "团队稳定使用",
    redeemHint: "优先选择页面写清楚取货码、售后联系方式和多席位兑换方式的商品。",
    riskNote: "团队采购前先确认退款、补发、掉线和账号安全条款。",
    summary: "适合多人或长期使用，重视可追踪取货和售后路径。",
  },
];

function normalizeText(value: string) {
  return value.trim().replace(/\s+/gu, " ");
}

function normalizeBudgetCents(value: number | null | undefined) {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) {
    return null;
  }
  return Math.round(value);
}

function createLocalId(prefix: string) {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function scoreProduct(product: T3LdxpAiProduct, need: string, budgetCents: number | null) {
  const normalizedNeed = need.toLowerCase();
  const keywordScore = product.fitKeywords.reduce(
    (score, keyword) => (normalizedNeed.includes(keyword.toLowerCase()) ? score + 4 : score),
    0
  );
  const budgetScore =
    budgetCents === null
      ? 1
      : product.budgetCents <= budgetCents
        ? 3
        : Math.max(0, 2 - Math.ceil((product.budgetCents - budgetCents) / 1000));
  return keywordScore + budgetScore;
}

export function listT3LdxpAiProducts() {
  return [...PRODUCT_CATALOG];
}

export function recommendT3LdxpAiProducts(input: {
  budgetCents?: number | null;
  need: string;
}): T3LdxpAiProduct[] {
  const need = normalizeText(input.need);
  const budgetCents = normalizeBudgetCents(input.budgetCents);
  return [...PRODUCT_CATALOG].sort((left, right) => {
    const scoreDelta =
      scoreProduct(right, need, budgetCents) - scoreProduct(left, need, budgetCents);
    return scoreDelta === 0 ? left.budgetCents - right.budgetCents : scoreDelta;
  });
}

export function createT3LdxpPurchasePlan(input: {
  budgetCents?: number | null;
  need: string;
  productId?: string | null;
}): T3LdxpPurchasePlan {
  const userNeed = normalizeText(input.need);
  if (!userNeed) {
    throw new Error("Describe what AI product the user needs before creating an ldxp.cn plan.");
  }
  const recommendedProducts = recommendT3LdxpAiProducts({
    budgetCents: input.budgetCents,
    need: userNeed,
  });
  const preferredProduct =
    recommendedProducts.find((product) => product.id === input.productId) ?? recommendedProducts[0];
  if (!preferredProduct) {
    throw new Error("No ldxp.cn AI product recommendation is available.");
  }
  return {
    checkoutUrl: preferredProduct.checkoutUrl,
    createdAt: Date.now(),
    id: createLocalId("ldxp-order-draft"),
    product: preferredProduct,
    stage: "awaiting_qr_payment",
    userNeed,
  };
}

export function buildT3LdxpEmbeddedCheckoutState(input: {
  cashierPrompt: string;
  fulfillmentPrompt: string;
  plan: T3LdxpPurchasePlan;
}): T3LdxpEmbeddedCheckoutState {
  const payment = parseT3LdxpPaymentPrompt(input.cashierPrompt);
  const fulfillment = parseT3LdxpFulfillmentPrompt(input.fulfillmentPrompt);
  return {
    fulfillment,
    payment,
    plan: {
      ...input.plan,
      stage:
        fulfillment.status === "redeem_ready"
          ? "redeem_ready"
          : payment.status === "payment_code_ready"
            ? "awaiting_qr_payment"
            : input.plan.stage,
    },
    readyForUserPayment: payment.status === "payment_code_ready",
    summary:
      fulfillment.status === "redeem_ready"
        ? "Delivery details are ready inside the app."
        : payment.status === "payment_code_ready"
          ? "Payment code is ready. User can pay without opening the shop page."
          : "Waiting for cashier details from the configured ldxp checkout bridge.",
  };
}

export function markT3LdxpQrPaymentScanned(plan: T3LdxpPurchasePlan): T3LdxpPurchasePlan {
  return {
    ...plan,
    stage: "awaiting_fulfillment_prompt",
  };
}

function unique(values: Iterable<string>) {
  return Array.from(new Set(Array.from(values, (value) => value.trim()).filter(Boolean)));
}

function extractFirst(text: string, patterns: readonly RegExp[]) {
  for (const pattern of patterns) {
    const match = pattern.exec(text);
    const value = match?.[1]?.trim();
    if (value) {
      return value;
    }
  }
  return null;
}

function extractUrls(text: string) {
  return unique(text.match(/https?:\/\/[^\s"'<>，。；]+/giu) ?? []);
}

function parseAmountCents(text: string) {
  const match =
    /(?:金额|实付|应付|价格|price|amount)\s*[:：]?\s*(?:¥|￥|RMB|CNY)?\s*(\d+(?:\.\d{1,2})?)/iu.exec(
      text
    ) ?? /(?:¥|￥)\s*(\d+(?:\.\d{1,2})?)/iu.exec(text);
  const amount = match?.[1] ? Number(match[1]) : null;
  if (amount === null || !Number.isFinite(amount)) {
    return null;
  }
  return Math.round(amount * 100);
}

function extractPaymentCode(text: string) {
  return extractFirst(text, [
    /(?:付款码|支付码|支付口令|二维码内容|qr(?:\s*code)?)\s*[:：]\s*([A-Za-z0-9:/?&=._%-]{6,})/iu,
    /(?:pay(?:ment)?\s*(?:code|url))\s*[:：]\s*([A-Za-z0-9:/?&=._%-]{6,})/iu,
  ]);
}

export function parseT3LdxpPaymentPrompt(text: string): T3LdxpPaymentPrompt {
  const prompt = normalizeText(text);
  const paymentUrls = extractUrls(prompt).filter((url) =>
    /pay|cashier|checkout|qrcode|qr|wxp|alipay|ldxp/iu.test(url)
  );
  const paymentCode = extractPaymentCode(prompt) ?? paymentUrls[0] ?? null;
  const productLabel = extractFirst(prompt, [
    /(?:商品|商品名称|产品|product)\s*[:：]\s*(.{2,80}?)(?=\s*(?:金额|实付|应付|价格|付款码|支付码|二维码|$))/iu,
    /(AI\s*充值[^，。；\n]{0,40})/iu,
  ]);
  const amountCents = parseAmountCents(prompt);
  const status = paymentCode ? "payment_code_ready" : "awaiting_payment_code";
  return {
    amountCents,
    paymentCode,
    paymentUrls,
    productLabel,
    status,
    summary: paymentCode
      ? "Payment code detected. Tell the user to pay this code, then continue with fulfillment."
      : "Paste the ldxp.cn cashier text, QR payload, or payment-code prompt.",
  };
}

function extractCardKeys(text: string) {
  const labelledKeys = Array.from(
    text.matchAll(
      /(?:卡密|兑换码|激活码|密钥|code|key)\s*[:：]\s*([A-Za-z0-9][A-Za-z0-9._-]{5,})/giu
    ),
    (match) => match[1] ?? ""
  );
  const standaloneKeys = Array.from(
    text.matchAll(/\b[A-Z0-9]{4}(?:-[A-Z0-9]{4,}){1,5}\b/giu),
    (match) => match[0]
  );
  const candidates = unique([...labelledKeys, ...standaloneKeys])
    .filter((value) => !/^https?:\/\//iu.test(value))
    .sort((left, right) => right.length - left.length);
  return candidates.filter(
    (candidate, index) =>
      !candidates
        .slice(0, index)
        .some((longerCandidate) => longerCandidate.toLowerCase().includes(candidate.toLowerCase()))
  );
}

export function parseT3LdxpFulfillmentPrompt(text: string): T3LdxpFulfillmentPrompt {
  const prompt = normalizeText(text);
  if (!prompt) {
    return {
      cardKeys: [],
      orderId: null,
      pickupCode: null,
      pickupUrls: [],
      redeemUrls: [],
      status: "awaiting_page_prompt",
      summary: "Paste the paid ldxp.cn page prompt, order page text, or delivery message.",
    };
  }
  const urls = extractUrls(prompt);
  const orderId = extractFirst(prompt, [
    /(?:订单号|订单编号|订单|order(?:\s*(?:id|no|number))?)\s*[:：#]?\s*([A-Za-z0-9_-]{6,})/iu,
    /\b(LDXP[A-Za-z0-9_-]{4,})\b/iu,
  ]);
  const pickupCode = extractFirst(prompt, [
    /(?:取货码|提取码|查询密码|取卡密码|取货密码)\s*[:：]?\s*([A-Za-z0-9_-]{4,})/iu,
    /(?:凭证|凭据)\s*[:：]?\s*([A-Za-z0-9_-]{4,})/iu,
  ]);
  const cardKeys = extractCardKeys(prompt);
  const redeemUrls = urls.filter((url) =>
    /redeem|exchange|activate|兑换|激活|kami|card/iu.test(url)
  );
  const pickupUrls = urls.filter((url) => !redeemUrls.includes(url));
  const status =
    cardKeys.length > 0 || redeemUrls.length > 0
      ? "redeem_ready"
      : orderId || pickupCode || pickupUrls.length > 0
        ? "pickup_required"
        : "awaiting_page_prompt";
  return {
    cardKeys,
    orderId,
    pickupCode,
    pickupUrls,
    redeemUrls,
    status,
    summary:
      status === "redeem_ready"
        ? "Card key or redemption entry detected. Redeem according to the page order."
        : status === "pickup_required"
          ? "Pickup clues detected. Open the pickup page and use the order or pickup code."
          : "No usable pickup or redemption clue was detected yet.",
  };
}

export function buildT3LdxpFulfillmentActions(prompt: T3LdxpFulfillmentPrompt): string[] {
  if (prompt.status === "awaiting_page_prompt") {
    return ["Paste the paid order page text or delivery prompt from ldxp.cn."];
  }
  const actions: string[] = [];
  if (prompt.pickupUrls.length > 0) {
    actions.push(`Open pickup page: ${prompt.pickupUrls[0]}`);
  }
  if (prompt.orderId) {
    actions.push(`Use order id ${prompt.orderId} when the page asks for an order query.`);
  }
  if (prompt.pickupCode) {
    actions.push(`Use pickup code ${prompt.pickupCode} when the page asks for delivery proof.`);
  }
  if (prompt.redeemUrls.length > 0) {
    actions.push(`Open redemption page: ${prompt.redeemUrls[0]}`);
  }
  if (prompt.cardKeys.length > 0) {
    actions.push(`Redeem card key: ${prompt.cardKeys[0]}`);
  }
  if (actions.length === 0) {
    actions.push("Follow the latest ldxp.cn page prompt and paste the next page text here.");
  }
  return actions;
}
