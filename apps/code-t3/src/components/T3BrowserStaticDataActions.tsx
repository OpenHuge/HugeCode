import { Button, Input } from "@heroui/react";
import { Download, LogIn, ShieldCheck } from "lucide-react";
import {
  canExportT3P0BrowserAccountData,
  readT3P0RuntimeRoleMode,
} from "../runtime/t3P0RuntimeRole";

type T3BrowserStaticDataActionsProps = {
  busy: boolean;
  accountImportCode: string;
  loginStateStatus: "loggedIn" | "notLoggedIn" | "unknown";
  onAccountImportCodeChange: (value: string) => void;
  onCheckLoginState: () => void;
  onExport: () => void;
  onOpenChatGpt: () => void;
};

export function T3BrowserStaticDataActions({
  busy,
  accountImportCode,
  loginStateStatus,
  onAccountImportCodeChange,
  onCheckLoginState,
  onExport,
  onOpenChatGpt,
}: T3BrowserStaticDataActionsProps) {
  const canExportAccountData = canExportT3P0BrowserAccountData(readT3P0RuntimeRoleMode());
  const importCodeReady = accountImportCode.trim().length >= 8;
  return (
    <div className="t3-browser-static-data-actions">
      <Button
        type="button"
        onPress={() => {
          if (!busy) {
            onOpenChatGpt();
          }
        }}
        aria-disabled={busy}
        isDisabled={busy}
        size="sm"
        variant="outline"
      >
        <LogIn size={13} />
        Open ChatGPT
      </Button>
      {canExportAccountData ? (
        <>
          <Input
            className="t3-browser-account-import-code"
            value={accountImportCode}
            onChange={(event) => onAccountImportCodeChange(event.target.value)}
            aria-label="文件解锁码"
            placeholder="输入文件解锁码"
            type="password"
            variant="secondary"
          />
          <Button
            type="button"
            onPress={() => {
              if (!busy) {
                onCheckLoginState();
              }
            }}
            aria-disabled={busy}
            isDisabled={busy}
            size="sm"
            variant="outline"
          >
            <ShieldCheck size={13} />
            {loginStateStatus === "loggedIn" ? "Login ready" : "Check login"}
          </Button>
          <Button
            type="button"
            onPress={() => {
              if (!busy && loginStateStatus === "loggedIn" && importCodeReady) {
                onExport();
              }
            }}
            aria-disabled={busy || loginStateStatus !== "loggedIn" || !importCodeReady}
            isDisabled={busy || loginStateStatus !== "loggedIn" || !importCodeReady}
            size="sm"
            variant="outline"
          >
            <Download size={13} />
            Export account file
          </Button>
        </>
      ) : null}
    </div>
  );
}
