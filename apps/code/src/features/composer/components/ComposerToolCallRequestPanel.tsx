import { Checkbox, Textarea } from "../../../design-system";
import { joinClassNames } from "../../../utils/classNames";
import { ComposerResolverPanel } from "./ComposerResolverPanel";
import * as styles from "./ComposerToolCallRequestPanel.css";

type ComposerToolCallRequestPanelProps = {
  toolName: string;
  callId: string;
  argumentsValue: unknown;
  outputText: string;
  success: boolean;
  onOutputChange: (value: string) => void;
  onSuccessChange: (value: boolean) => void;
};

export function ComposerToolCallRequestPanel({
  toolName,
  callId,
  argumentsValue,
  outputText,
  success,
  onOutputChange,
  onSuccessChange,
}: ComposerToolCallRequestPanelProps) {
  const argumentsText = (() => {
    try {
      return JSON.stringify(argumentsValue, null, 2);
    } catch {
      return String(argumentsValue ?? "");
    }
  })();

  return (
    <ComposerResolverPanel
      ariaLabel="Pending tool call"
      header={
        <div className={styles.header}>
          <span className={styles.badge}>Tool call requested</span>
          <span className={styles.pill}>{toolName}</span>
        </div>
      }
      title="Return output for this tool call from the composer."
      titleClassName={styles.title}
      helper="Keep the tool response in the same resolver surface so the timeline stays focused on the turn narrative."
      helperClassName={styles.helper}
    >
      <div className={styles.detailGrid}>
        <div className={styles.detailCard}>
          <div className={styles.detailLabel}>Tool</div>
          <div className={styles.detailValue}>{toolName}</div>
        </div>
        <div className={styles.detailCard}>
          <div className={styles.detailLabel}>Call ID</div>
          <div className={joinClassNames(styles.detailValue, styles.codeValue)}>{callId}</div>
        </div>
      </div>
      <pre className={styles.argsPreview}>{argumentsText}</pre>
      <Textarea
        className={styles.textarea}
        aria-label="Tool call output"
        placeholder="Tool output text"
        value={outputText}
        onChange={(event) => onOutputChange(event.target.value)}
        rows={4}
      />
      <Checkbox
        className={styles.checkboxRow}
        inputClassName={styles.checkbox}
        labelClassName={styles.checkboxTitle}
        label="Mark call successful"
        description="Uncheck this if the tool failed or should return an error outcome."
        checked={success}
        onCheckedChange={onSuccessChange}
      />
    </ComposerResolverPanel>
  );
}
