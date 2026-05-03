import { Button, Card, Chip } from "@heroui/react";
import {
  CheckCircle2,
  Clock3,
  Crown,
  KeyRound,
  ShieldCheck,
  ShoppingBag,
  Sparkles,
  Zap,
} from "lucide-react";
import { useState } from "react";

export type T3AccountRentalAssistantCardProps = {
  onNotice: (notice: string) => void;
};

type T3StaticRentalAccount = {
  authConfigured: boolean;
  id: string;
  label: string;
  multiplier: string;
  signal: string;
  suitability: string;
  summary: string;
};

const STATIC_RENTAL_ACCOUNTS: readonly T3StaticRentalAccount[] = [
  {
    authConfigured: false,
    id: "pro-20x",
    label: "Pro 20x",
    multiplier: "20x",
    signal: "高优先级",
    suitability: "更适合代码密集型任务、长上下文推理和重度工作流。",
    summary: "高倍率 Pro 账户，适合更重的模型和代码任务。",
  },
  {
    authConfigured: false,
    id: "pro-5x",
    label: "Pro 5x",
    multiplier: "5x",
    signal: "轻量稳定",
    suitability: "更适合日常使用、轻量验证和低压力切换。",
    summary: "轻量 Pro 账户，适合日常任务和低压使用。",
  },
];

export function T3AccountRentalAssistantCard({ onNotice }: T3AccountRentalAssistantCardProps) {
  const [rentedAccountId, setRentedAccountId] = useState<string | null>(null);

  function rentAccount(account: T3StaticRentalAccount) {
    setRentedAccountId(account.id);
    onNotice(
      account.authConfigured
        ? `已租用 ${account.label}。`
        : `${account.label} 已选中，等待导入 auth.json 后可完成交付。`
    );
  }

  return (
    <Card className="t3-account-rental" variant="secondary" aria-label="账户池管理">
      <Card.Header className="t3-browser-card-header">
        <div className="t3-account-rental-title">
          <strong>
            <ShoppingBag size={13} />
            账户池管理
          </strong>
        </div>
        <em className="t3-account-rental-count">{STATIC_RENTAL_ACCOUNTS.length} 个内置账户</em>
      </Card.Header>
      <div className="t3-account-rental-intro">
        <p>
          选择内置静态账户后一键租用。这个界面只展示账户级别能力和状态，不直接暴露 auth.json 内容。
        </p>
        <div className="t3-account-rental-highlights" aria-label="账户摘要">
          <span>
            <ShieldCheck size={13} />
            先选账户
          </span>
          <span>
            <Zap size={13} />
            一键租用
          </span>
          <span>
            <Clock3 size={13} />
            auth.json 待接入
          </span>
        </div>
      </div>
      <div className="t3-account-rental-section-title">账户列表</div>
      <div className="t3-account-rental-list" aria-label="账户列表">
        {STATIC_RENTAL_ACCOUNTS.map((account) => {
          const rented = rentedAccountId === account.id;
          return (
            <article key={account.id} data-rented={rented}>
              <div className="t3-account-rental-row">
                <span className="t3-account-rental-icon">
                  <Crown size={15} />
                </span>
                <div className="t3-account-rental-account-copy">
                  <div className="t3-account-rental-account-topline">
                    <strong>{account.label}</strong>
                    <Chip size="sm" variant="tertiary">
                      {account.signal}
                    </Chip>
                  </div>
                  <small>{account.summary}</small>
                </div>
                <em>{account.multiplier}</em>
              </div>
              <div className="t3-account-rental-copy">{account.suitability}</div>
              <div className="t3-account-rental-meta">
                <span data-ready={account.authConfigured}>
                  {account.authConfigured ? <CheckCircle2 size={13} /> : <Clock3 size={13} />}
                  {account.authConfigured ? "auth.json 已配置" : "auth.json 待提供"}
                </span>
                <span>
                  <Sparkles size={13} />
                  静态内置
                </span>
              </div>
              <Button
                type="button"
                size="md"
                variant={rented ? "secondary" : "primary"}
                onPress={() => rentAccount(account)}
              >
                {rented ? <CheckCircle2 size={14} /> : <Sparkles size={14} />}
                {rented ? "已租用" : "一键租用"}
              </Button>
            </article>
          );
        })}
      </div>
      <div className="t3-account-rental-footer">
        <KeyRound size={13} />
        <span>等你提供 auth.json 后，我再把账户导入流程接上。</span>
      </div>
    </Card>
  );
}
