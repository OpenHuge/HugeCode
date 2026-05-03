import { Button, Card, Chip, Input, TextArea } from "@heroui/react";
import {
  ClipboardCheck,
  ExternalLink,
  Key,
  KeyRound,
  PackageCheck,
  ShieldCheck,
} from "lucide-react";
import type { T3ChatGptSessionAssessment } from "../runtime/t3ChatGptRechargeAssistant";

type T3ChatGptBrowserAssistantCardProps = {
  cdkCode: string;
  codexOAuthBusy: boolean;
  codexOAuthNotice: string | null;
  encryptedEnvelopeLabel: string;
  rechargeActions: readonly string[];
  sessionAssessment: T3ChatGptSessionAssessment;
  sessionText: string;
  vaultNotice: string | null;
  vaultPassphrase: string;
  onCdkCodeChange: (value: string) => void;
  onDecryptSession: () => void;
  onEncryptSession: () => void;
  onForgetSessionVault: () => void;
  onOpenChatGptHome: () => void;
  onOpenChatGptSession: () => void;
  onOpenCodexOAuthLogin: () => void;
  onSessionTextChange: (value: string) => void;
  onVaultPassphraseChange: (value: string) => void;
};

export function T3ChatGptBrowserAssistantCard({
  cdkCode,
  codexOAuthBusy,
  codexOAuthNotice,
  encryptedEnvelopeLabel,
  rechargeActions,
  sessionAssessment,
  sessionText,
  vaultNotice,
  vaultPassphrase,
  onCdkCodeChange,
  onDecryptSession,
  onEncryptSession,
  onForgetSessionVault,
  onOpenChatGptHome,
  onOpenChatGptSession,
  onOpenCodexOAuthLogin,
  onSessionTextChange,
  onVaultPassphraseChange,
}: T3ChatGptBrowserAssistantCardProps) {
  return (
    <Card
      className="browser-product-chatgpt-assistant"
      variant="secondary"
      aria-label="ChatGPT recharge assistant"
    >
      <Card.Header className="browser-product-card-header">
        <span>
          <Key size={14} />
          ChatGPT CDK 兑换检查
        </span>
        <Chip
          color={sessionAssessment.accountStatus === "free" ? "success" : "warning"}
          size="sm"
          variant="soft"
        >
          {sessionAssessment.accountStatus}
        </Chip>
      </Card.Header>
      <small>
        在同一浏览器会话里先打开 ChatGPT 确认登录，再打开 session 端点。粘贴 session JSON
        后仅解析登录和订阅状态；token、cookie、邮箱等敏感字段不会显示或保存。
      </small>
      <div className="browser-product-chatgpt-actions">
        <Button
          type="button"
          onPress={onOpenCodexOAuthLogin}
          size="md"
          variant="primary"
          aria-disabled={codexOAuthBusy}
        >
          <KeyRound size={15} />
          {codexOAuthBusy ? "连接中" : "本机浏览器登录内置 Codex"}
        </Button>
        <Button type="button" onPress={onOpenChatGptHome} size="md" variant="outline">
          <ExternalLink size={15} />
          打开 ChatGPT
        </Button>
        <Button type="button" onPress={onOpenChatGptSession} size="md" variant="outline">
          <ExternalLink size={15} />
          打开 session
        </Button>
      </div>
      {codexOAuthNotice ? (
        <div className="browser-product-chatgpt-status" data-status="connected">
          <ShieldCheck size={15} />
          <span>
            <strong>{codexOAuthNotice}</strong>
            <small>Runtime OAuth callback will store the Codex route in the account pool.</small>
          </span>
        </div>
      ) : null}
      <label htmlFor="browser-chatgpt-session">
        <span>session JSON（本地解析，敏感字段过滤）</span>
        <TextArea
          id="browser-chatgpt-session"
          value={sessionText}
          onChange={(event) => onSessionTextChange(event.target.value)}
          aria-label="ChatGPT session JSON"
          rows={6}
          variant="secondary"
        />
      </label>
      <label htmlFor="browser-chatgpt-vault-passphrase">
        <span>本地加密口令</span>
        <Input
          id="browser-chatgpt-vault-passphrase"
          value={vaultPassphrase}
          onChange={(event) => onVaultPassphraseChange(event.target.value)}
          aria-label="ChatGPT session vault passphrase"
          type="password"
          variant="secondary"
        />
      </label>
      <div className="browser-product-chatgpt-actions">
        <Button type="button" onPress={onEncryptSession} size="md" variant="outline">
          <Key size={15} />
          加密保存
        </Button>
        <Button type="button" onPress={onDecryptSession} size="md" variant="outline">
          <ShieldCheck size={15} />
          解密检查
        </Button>
        <Button type="button" onPress={onForgetSessionVault} size="md" variant="outline">
          <PackageCheck size={15} />
          移除本地密文
        </Button>
      </div>
      <div className="browser-product-chatgpt-vault" aria-label="ChatGPT session vault">
        <strong>{encryptedEnvelopeLabel}</strong>
        <small>
          {vaultNotice ??
            "Session plaintext is never written to localStorage; only the encrypted envelope is stored."}
        </small>
      </div>
      <div className="browser-product-chatgpt-status" data-status={sessionAssessment.accountStatus}>
        <ShieldCheck size={15} />
        <span>
          <strong>{sessionAssessment.safeSummary}</strong>
          <small>
            {sessionAssessment.hasSensitivePayload
              ? "Detected sensitive session fields and suppressed their values."
              : "No sensitive session field names detected in the pasted text."}
          </small>
        </span>
      </div>
      <label htmlFor="browser-chatgpt-cdk">
        <span>CDK 兑换码</span>
        <Input
          id="browser-chatgpt-cdk"
          value={cdkCode}
          onChange={(event) => onCdkCodeChange(event.target.value)}
          aria-label="ChatGPT CDK code"
          variant="secondary"
        />
      </label>
      <div className="browser-product-chatgpt-next" aria-label="ChatGPT recharge next">
        {rechargeActions.map((action) => (
          <span key={action}>
            <ClipboardCheck size={13} />
            {action}
          </span>
        ))}
      </div>
    </Card>
  );
}
