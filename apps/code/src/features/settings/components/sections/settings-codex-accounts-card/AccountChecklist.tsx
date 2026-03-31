import type { OAuthAccountSummary } from "../../../../../application/runtime/ports/oauth";
import { Avatar } from "../../../../../design-system";
import { Text } from "../../../../../design-system";
import { providerMonogram } from "../settingsCodexAccountsCardUtils";
import * as controlStyles from "./CodexAccountControls.css";

type AccountChecklistProps = {
  accounts: OAuthAccountSummary[];
  selectedIds: string[];
  onToggle: (accountId: string, checked: boolean) => void;
  emptyLabel?: string;
};

export function AccountChecklist({
  accounts,
  selectedIds,
  onToggle,
  emptyLabel = "No accounts available",
}: AccountChecklistProps) {
  if (accounts.length === 0) {
    return <div className={controlStyles.emptyField}>{emptyLabel}</div>;
  }

  return (
    <div className="apm-checklist">
      {accounts.map((account) => {
        const isSelected = selectedIds.includes(account.accountId);
        const name = account.displayName?.trim() || account.email?.trim() || account.accountId;
        const email = account.email?.trim();
        const showSub = email && email !== name;

        return (
          <label key={account.accountId} className="apm-checklist-item">
            <input
              type="checkbox"
              checked={isSelected}
              onChange={(event) => onToggle(account.accountId, event.target.checked)}
            />
            <Avatar
              className="apm-checklist-avatar"
              size="sm"
              shape="rounded"
              aria-hidden="true"
              fallback={providerMonogram(name)}
            />
            <div className="apm-checklist-info">
              <Text
                as="span"
                className="apm-checklist-name"
                size="chrome"
                tone="strong"
                weight="medium"
              >
                {name}
              </Text>
              {showSub ? (
                <Text as="span" className="apm-checklist-sub" size="fine" tone="muted">
                  {email}
                </Text>
              ) : null}
            </div>
          </label>
        );
      })}
    </div>
  );
}
