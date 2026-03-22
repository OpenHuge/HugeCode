import CircleAlert from "lucide-react/dist/esm/icons/circle-alert";
import PlugZap from "lucide-react/dist/esm/icons/plug-zap";
import { Button, Input } from "../../../design-system";
import type { StatusBadgeTone } from "../../../design-system";
import { joinClassNames } from "../../../utils/classNames";
import * as styles from "./HomeRuntimeNotice.css";

type HomeRuntimeNoticeProps = {
  state: "runtime" | "error" | "manual";
  title: string;
  tone: StatusBadgeTone;
  body: string;
  showLocalRuntimeEntry: boolean;
  runtimeTargetDraft: string;
  runtimeEndpointPreview: string;
  localRuntimeConnectError: string | null;
  isConnectingLocalRuntime: boolean;
  onRuntimeTargetDraftChange: (value: string) => void;
  onConnectRuntime: () => void | Promise<void>;
};

export function HomeRuntimeNotice({
  state,
  title,
  tone,
  body,
  showLocalRuntimeEntry,
  runtimeTargetDraft,
  runtimeEndpointPreview,
  localRuntimeConnectError,
  isConnectingLocalRuntime,
  onRuntimeTargetDraftChange,
  onConnectRuntime,
}: HomeRuntimeNoticeProps) {
  return (
    <div className={styles.root} data-state={state} data-testid="home-runtime-notice">
      <div className={styles.shell}>
        {state !== "manual" || body ? (
          <div className={styles.copy}>
            <div
              className={joinClassNames(
                styles.title,
                tone === "warning" && styles.titleWarning,
                tone === "error" && styles.titleError
              )}
              data-tone={tone}
            >
              {title}
            </div>
            {body ? <div className={styles.body}>{body}</div> : null}
          </div>
        ) : null}
        {showLocalRuntimeEntry ? (
          <div className={styles.connectionPanel}>
            <form
              className={styles.localForm}
              onSubmit={(event) => {
                event.preventDefault();
                void onConnectRuntime();
              }}
            >
              <div className={styles.localInline}>
                <Input
                  aria-label="Runtime target"
                  className={styles.targetControl}
                  fieldClassName={styles.targetField}
                  inputSize="sm"
                  value={runtimeTargetDraft}
                  onChange={(event) => {
                    onRuntimeTargetDraftChange(event.target.value);
                  }}
                  inputMode="text"
                  autoComplete="off"
                  placeholder="8788 or runtime.example.com:8788"
                  icon={PlugZap}
                />
                <Button
                  type="submit"
                  variant="secondary"
                  size="sm"
                  disabled={isConnectingLocalRuntime}
                >
                  {isConnectingLocalRuntime ? "Connecting..." : "Connect"}
                </Button>
              </div>
              <div className={styles.endpointPreview}>
                <code>{runtimeEndpointPreview}</code>
              </div>
            </form>
            {localRuntimeConnectError ? (
              <div className={styles.error} role="alert">
                <CircleAlert className={styles.errorIcon} aria-hidden />
                <div className={styles.errorCopy}>
                  <div className={styles.errorTitle}>Connection error</div>
                  <div className={styles.errorBody}>{localRuntimeConnectError}</div>
                </div>
              </div>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}
