import { Button, Chip, Input } from "@heroui/react";
import {
  CheckCircle2,
  Circle,
  Download,
  ExternalLink,
  PackageCheck,
  ShieldCheck,
} from "lucide-react";
import { useMemo, useState } from "react";
import type { T3BrowserLoginStatePreflightResult } from "../runtime/t3BrowserStaticData";
import {
  T3_DELIVERY_SERVICE,
  type T3DeliveryArtifactUpload,
  type T3DeliveryProjection,
  type T3DeliveryService,
} from "../runtime/t3DeliveryService";

type T3OperatorWorkspacePanelProps = {
  accountImportCode: string;
  busy: boolean;
  deliveryService?: T3DeliveryService;
  loginStateStatus: T3BrowserLoginStatePreflightResult["status"];
  notice: string | null;
  onAccountImportCodeChange: (value: string) => void;
  onCheckLoginState: () => Promise<T3BrowserLoginStatePreflightResult>;
  onExportAccountFile: () => Promise<T3DeliveryArtifactUpload | null>;
  onNotice: (notice: string) => void;
  onOpenChatGptCapture: () => void;
};

function statusLabel(projection: T3DeliveryProjection | null) {
  return projection?.status ?? "draft";
}

function statusColor(projection: T3DeliveryProjection | null) {
  if (projection?.status === "exported") {
    return "success" as const;
  }
  if (projection?.status === "prepared") {
    return "warning" as const;
  }
  if (
    projection?.status === "expired" ||
    projection?.status === "failed" ||
    projection?.status === "fileUnavailable" ||
    projection?.status === "revoked" ||
    projection?.status === "unavailable"
  ) {
    return "danger" as const;
  }
  return "default" as const;
}

function deliveryStepClassName(done: boolean, ready = false) {
  if (done) {
    return "t3-operator-workspace-step done";
  }
  return ready ? "t3-operator-workspace-step ready" : "t3-operator-workspace-step";
}

export function T3OperatorWorkspacePanel({
  accountImportCode,
  busy,
  deliveryService = T3_DELIVERY_SERVICE,
  loginStateStatus,
  notice,
  onAccountImportCodeChange,
  onCheckLoginState,
  onExportAccountFile,
  onNotice,
  onOpenChatGptCapture,
}: T3OperatorWorkspacePanelProps) {
  const [deliveryProjection, setDeliveryProjection] = useState<T3DeliveryProjection | null>(null);
  const [deliveryBusy, setDeliveryBusy] = useState(false);
  const fileUnlockCodeReady = accountImportCode.trim().length >= 8;
  const loginReady = loginStateStatus === "loggedIn";
  const prepared = deliveryProjection?.status === "prepared";
  const exported = deliveryProjection?.status === "exported";
  const readyToExport =
    prepared && Boolean(deliveryProjection.deliveryId) && loginReady && fileUnlockCodeReady;
  const exportEnabled = readyToExport && !busy;
  const deliveryStatus = useMemo(() => statusLabel(deliveryProjection), [deliveryProjection]);

  async function onPrepareDelivery() {
    setDeliveryBusy(true);
    try {
      const preflight = await onCheckLoginState();
      if (preflight.status !== "loggedIn") {
        throw new Error(preflight.summary);
      }
      const projection = await deliveryService.prepare({ provider: "chatgpt" });
      setDeliveryProjection(projection);
      if (projection.browserFileUnlockCode) {
        onAccountImportCodeChange(projection.browserFileUnlockCode);
      }
      if (projection.status !== "prepared" && projection.status !== "exported") {
        onNotice(projection.summary);
        return;
      }
      onNotice(projection.summary);
    } catch (error) {
      onNotice(error instanceof Error ? error.message : "Unable to prepare delivery.");
    } finally {
      setDeliveryBusy(false);
    }
  }

  async function onExportPreparedDelivery() {
    if (!deliveryProjection?.deliveryId || !exportEnabled) {
      return;
    }
    setDeliveryBusy(true);
    try {
      const artifact = await onExportAccountFile();
      if (!artifact) {
        throw new Error("Local browser account export did not produce an artifact witness.");
      }
      const projection = await deliveryService.uploadArtifact({
        artifact,
        deliveryId: deliveryProjection.deliveryId,
      });
      setDeliveryProjection(projection);
      onNotice(projection.summary);
    } catch (error) {
      onNotice(error instanceof Error ? error.message : "Unable to submit export witness.");
    } finally {
      setDeliveryBusy(false);
    }
  }

  return (
    <section className="t3-operator-workspace-panel" aria-label="生产工作台">
      <header className="t3-browser-card-header">
        <span>
          <ShieldCheck size={14} />
          生产工作台
        </span>
        <Chip color={statusColor(deliveryProjection)} size="sm" variant="soft">
          {deliveryStatus}
        </Chip>
      </header>
      <p>
        交付事实源留给后端合龙；当前前端只消费 adapter projection、检查登录态并登记非敏感 witness。
      </p>
      <div className="t3-operator-workspace-steps" aria-label="生产交付状态">
        <article className={deliveryStepClassName(loginReady)}>
          {loginReady ? <CheckCircle2 size={15} /> : <Circle size={15} />}
          <span>
            <strong>已登录</strong>
            <small>{loginReady ? "ChatGPT 登录态已确认" : "先打开 ChatGPT 捕获"}</small>
          </span>
        </article>
        <article className={deliveryStepClassName(prepared || exported, loginReady)}>
          {prepared || exported ? <CheckCircle2 size={15} /> : <Circle size={15} />}
          <span>
            <strong>已准备</strong>
            <small>
              {prepared || exported
                ? "adapter prepared 投影已返回"
                : deliveryProjection
                  ? "adapter 未返回可导出投影"
                  : "登录后点击准备交付"}
            </small>
          </span>
        </article>
        <article className={deliveryStepClassName(exported, readyToExport)}>
          {exported ? <CheckCircle2 size={15} /> : <Circle size={15} />}
          <span>
            <strong>可导出</strong>
            <small>
              {exported
                ? "加密交付物已上传"
                : readyToExport
                  ? "文件解锁码已就绪，可以上传"
                  : "等待 prepared 与文件解锁码"}
            </small>
          </span>
        </article>
        <article className={deliveryStepClassName(exported)}>
          {exported ? <CheckCircle2 size={15} /> : <Circle size={15} />}
          <span>
            <strong>已导出</strong>
            <small>{exported ? "后端投影已接受上传与 witness" : "上传完成后显示完成态"}</small>
          </span>
        </article>
      </div>
      <div className="t3-operator-workspace-actions">
        <Button type="button" onPress={onOpenChatGptCapture} isDisabled={busy || deliveryBusy}>
          <ExternalLink size={14} />
          打开 ChatGPT 捕获
        </Button>
        <Button
          type="button"
          onPress={() => void onPrepareDelivery()}
          isDisabled={busy || deliveryBusy}
          variant="outline"
        >
          <PackageCheck size={14} />
          准备交付
        </Button>
        <label className="t3-operator-workspace-file-code" htmlFor="t3-browser-file-unlock-code">
          <span>文件解锁码</span>
          <Input
            id="t3-browser-file-unlock-code"
            value={accountImportCode}
            onChange={(event) => onAccountImportCodeChange(event.target.value)}
            aria-label="文件解锁码"
            placeholder="输入后端返回的文件解锁码"
            type="password"
            variant="secondary"
          />
          <small>这是 `.hcbrowser` 文件解锁码，不是客户激活码。</small>
        </label>
        <Button
          type="button"
          onPress={() => void onExportPreparedDelivery()}
          aria-disabled={!exportEnabled || deliveryBusy}
          isDisabled={!exportEnabled || deliveryBusy}
          variant="primary"
        >
          <Download size={14} />
          上传 .hcbrowser 并登记 witness
        </Button>
      </div>
      {deliveryProjection ? (
        <dl className="t3-operator-workspace-facts">
          <div>
            <dt>deliveryId</dt>
            <dd>{deliveryProjection.deliveryId ?? "后端未接入"}</dd>
          </div>
          <div>
            <dt>fileHash</dt>
            <dd>{deliveryProjection.fileHash ?? "待导出"}</dd>
          </div>
          <div>
            <dt>兑换码</dt>
            <dd>{deliveryProjection.activationCode ?? "后端未返回"}</dd>
          </div>
          <div>
            <dt>文件解锁材料</dt>
            <dd>{deliveryProjection.browserFileUnlockCode ? "后端投影已承载" : "后端未返回"}</dd>
          </div>
          <div>
            <dt>服务状态</dt>
            <dd>{deliveryProjection.entitlementSummary ?? "等待后端状态投影"}</dd>
          </div>
        </dl>
      ) : null}
      {notice ? <small>{notice}</small> : null}
    </section>
  );
}
