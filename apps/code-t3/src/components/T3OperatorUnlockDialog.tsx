import { Button, Card, Input } from "@heroui/react";
import { KeyRound, ShieldCheck, X } from "lucide-react";
import type { FormEvent, KeyboardEvent } from "react";
import { useState } from "react";

type T3OperatorUnlockDialogProps = {
  open: boolean;
  onClose: () => void;
  onUnlock: (password: string) => boolean;
};

export function T3OperatorUnlockDialog({ open, onClose, onUnlock }: T3OperatorUnlockDialogProps) {
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  function submitUnlock(event?: FormEvent<HTMLFormElement>) {
    event?.preventDefault();
    if (onUnlock(password)) {
      setPassword("");
      setError(null);
      return;
    }
    setError("生产端本地密码不正确。");
  }
  function submitUnlockFromPasswordKey(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key !== "Enter") {
      return;
    }
    event.preventDefault();
    submitUnlock();
  }

  if (!open) {
    return null;
  }
  return (
    <div className="t3-operator-unlock-backdrop" role="presentation">
      <Card
        className="t3-operator-unlock-dialog"
        role="dialog"
        aria-modal="true"
        aria-label="生产端本地解锁"
        variant="secondary"
      >
        <Card.Header className="t3-browser-card-header">
          <span>
            <ShieldCheck size={14} />
            生产端本地解锁
          </span>
          <Button type="button" aria-label="关闭生产端解锁" isIconOnly size="sm" onPress={onClose}>
            <X size={14} />
          </Button>
        </Card.Header>
        <form className="t3-operator-unlock-form" onSubmit={submitUnlock}>
          <p>本地密码只解锁生产方界面，不代表后端授权、订单权限或账号池权限。</p>
          <Input
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            onKeyDown={submitUnlockFromPasswordKey}
            aria-label="生产端本地密码"
            placeholder="生产端本地密码"
            type="password"
            variant="secondary"
          />
          {error ? <small className="t3-operator-unlock-error">{error}</small> : null}
          <Button type="submit" variant="primary">
            <KeyRound size={14} />
            解锁生产工作台
          </Button>
        </form>
      </Card>
    </div>
  );
}
