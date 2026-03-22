import { getApprovalCommandInfo } from "../../../utils/approvalRules";
import { joinClassNames } from "../../../utils/classNames";
import type { ApprovalRequest } from "../../../types";
import {
  formatApprovalLabel,
  formatApprovalMethodLabel,
  getApprovalPresentationEntries,
  renderApprovalParamValue,
} from "../../messages/utils/approvalPresentation";
import * as styles from "./ComposerApprovalPanel.css";

type ComposerApprovalPanelProps = {
  request: ApprovalRequest;
};

export function ComposerApprovalPanel({ request }: ComposerApprovalPanelProps) {
  const commandInfo = getApprovalCommandInfo(request.params);
  const entries = getApprovalPresentationEntries(request);
  const summaryText = commandInfo
    ? `Agent wants to run: ${commandInfo.preview}`
    : "The agent requested a privileged runtime action.";

  return (
    <section className={styles.panel} aria-label="Pending approval">
      <div className={styles.header}>
        <span className={styles.badge}>Approval required</span>
        <span className={styles.pill}>{formatApprovalMethodLabel(request.method)}</span>
      </div>
      <div className={styles.title}>{summaryText}</div>
      <div className={styles.helper}>
        Resolve this privileged action from the composer so the active turn has one primary control
        surface.
      </div>
      {entries.length ? (
        <div className={styles.detailGrid}>
          {entries.map(([key, value]) => {
            const rendered = renderApprovalParamValue(key, value);
            return (
              <div key={key} className={styles.detailCard}>
                <div className={styles.detailLabel}>{formatApprovalLabel(key)}</div>
                <div
                  className={joinClassNames(
                    styles.detailValue,
                    rendered.isCode ? styles.codeValue : undefined
                  )}
                >
                  {rendered.text}
                </div>
              </div>
            );
          })}
        </div>
      ) : null}
      <div className={styles.footerNote}>
        The main composer draft below stays untouched while you approve or decline this action.
      </div>
    </section>
  );
}
