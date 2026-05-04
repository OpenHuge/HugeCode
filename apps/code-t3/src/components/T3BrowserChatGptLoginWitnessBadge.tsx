import { Button } from "@heroui/react";
import { ShieldCheck } from "lucide-react";
import { useMemo, useState } from "react";
import {
  buildT3BrowserChatGptLoginWitness,
  buildVerifiedT3BrowserChatGptLoginWitness,
  readT3BrowserImportedDataReadyFlag,
  writeT3BrowserChatGptLoginWitness,
  type T3BrowserChatGptLoginWitness,
} from "../runtime/t3BrowserLoginWitness";
import type { BrowserChromeSnapshot } from "../runtime/t3BrowserChromeBridge";

type T3BrowserChatGptLoginWitnessBadgeProps = {
  snapshot: BrowserChromeSnapshot;
  targetUrl: string;
};

function isChatGptUrl(url: string) {
  try {
    return new URL(url).hostname === "chatgpt.com";
  } catch {
    return false;
  }
}

export function T3BrowserChatGptLoginWitnessBadge({
  snapshot,
  targetUrl,
}: T3BrowserChatGptLoginWitnessBadgeProps) {
  const [manualWitness, setManualWitness] = useState<T3BrowserChatGptLoginWitness | null>(null);
  const showWitness =
    isChatGptUrl(targetUrl) && readT3BrowserImportedDataReadyFlag(window.localStorage);
  const computedWitness = useMemo(
    () =>
      showWitness
        ? buildT3BrowserChatGptLoginWitness({
            importReady: true,
            snapshot,
            targetUrl,
          })
        : null,
    [showWitness, snapshot, targetUrl]
  );
  const witness = manualWitness ?? computedWitness;
  if (!witness) {
    return null;
  }
  function recordManualWitness() {
    const verifiedWitness = buildVerifiedT3BrowserChatGptLoginWitness({
      snapshot,
      targetUrl,
    });
    writeT3BrowserChatGptLoginWitness(window.localStorage, verifiedWitness);
    setManualWitness(verifiedWitness);
  }
  return (
    <div
      className="browser-product-login-witness"
      data-status={witness.status}
      title={witness.summary}
    >
      <ShieldCheck size={14} />
      <span>{witness.status}</span>
      {witness.status !== "VERIFIED" ? (
        <Button type="button" size="sm" variant="ghost" onPress={recordManualWitness}>
          Record witness
        </Button>
      ) : null}
    </div>
  );
}
