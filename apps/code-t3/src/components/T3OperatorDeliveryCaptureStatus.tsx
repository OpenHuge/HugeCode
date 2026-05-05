import { Button } from "@heroui/react";
import { ShieldCheck } from "lucide-react";
import { useEffect, useState } from "react";
import { checkT3BrowserChatGptLoginState } from "../runtime/t3BrowserStaticData";

type T3OperatorDeliveryCaptureStatusProps = {
  activeTabUrl: string;
  enabled: boolean;
  onCloseWindow: () => void;
  onOpenChatGpt: () => void;
};

export function T3OperatorDeliveryCaptureStatus({
  activeTabUrl,
  enabled,
  onCloseWindow,
  onOpenChatGpt,
}: T3OperatorDeliveryCaptureStatusProps) {
  const [captureStatus, setCaptureStatus] = useState<
    "checking" | "detected" | "idle" | "notLoggedIn"
  >("idle");
  const [captureNotice, setCaptureNotice] = useState<string | null>(null);

  useEffect(() => {
    if (!enabled || !activeTabUrl.includes("chatgpt.com")) {
      return;
    }
    let mounted = true;
    setCaptureStatus("checking");
    void checkT3BrowserChatGptLoginState()
      .then((result) => {
        if (!mounted) {
          return;
        }
        setCaptureStatus(result.status === "loggedIn" ? "detected" : "notLoggedIn");
        setCaptureNotice(
          result.status === "loggedIn"
            ? "已检测到 ChatGPT 登录态，可以关闭浏览器，返回生产端继续准备交付。HugeCode 只确认 session 可用于本地导出，不读取账号密码。"
            : result.summary
        );
      })
      .catch((nextError) => {
        if (mounted) {
          setCaptureStatus("notLoggedIn");
          setCaptureNotice(
            nextError instanceof Error ? nextError.message : "Unable to check ChatGPT login state."
          );
        }
      });
    return () => {
      mounted = false;
    };
  }, [activeTabUrl, enabled]);

  if (!enabled) {
    return null;
  }
  return (
    <>
      <div className="browser-product-operator-capture" role="status">
        <ShieldCheck size={14} />
        <span>
          {captureStatus === "detected"
            ? "ChatGPT 登录态已检测"
            : captureStatus === "checking"
              ? "正在检测 ChatGPT 登录态"
              : "生产捕获模式"}
        </span>
        <Button
          type="button"
          size="sm"
          variant={captureStatus === "detected" ? "primary" : "outline"}
          onPress={captureStatus === "detected" ? onCloseWindow : onOpenChatGpt}
        >
          {captureStatus === "detected" ? "返回生产工作台" : "打开 ChatGPT"}
        </Button>
      </div>
      {captureNotice ? (
        <div className="browser-product-operator-capture-overlay">
          <strong>{captureStatus === "detected" ? "登录态确认完成" : "继续完成登录"}</strong>
          <p>{captureNotice}</p>
          {captureStatus === "detected" ? (
            <Button type="button" onPress={onCloseWindow} variant="primary">
              返回生产工作台
            </Button>
          ) : null}
        </div>
      ) : null}
    </>
  );
}
