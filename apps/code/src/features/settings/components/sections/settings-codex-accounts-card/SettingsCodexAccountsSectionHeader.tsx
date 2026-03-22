import X from "lucide-react/dist/esm/icons/x";
import { Button, IconButton, SectionHeader, Text } from "../../../../../design-system";
import * as styles from "./SettingsCodexAccountsSectionHeader.css";

type SettingsCodexAccountsSectionHeaderProps = {
  title: string;
  description: string;
  onRefresh: () => void;
  refreshing: boolean;
  onClose?: () => void;
};

export function SettingsCodexAccountsSectionHeader({
  title,
  description,
  onRefresh,
  refreshing,
  onClose,
}: SettingsCodexAccountsSectionHeaderProps) {
  return (
    <div className={styles.root}>
      <SectionHeader
        title={title}
        actions={
          <div className={styles.actions}>
            <Button variant="ghost" size="sm" onClick={onRefresh} disabled={refreshing}>
              {refreshing ? "Refreshing…" : "Refresh"}
            </Button>
            {onClose ? (
              <IconButton
                aria-label="Close section"
                icon={<X size={12} aria-hidden />}
                size="iconSm"
                variant="ghost"
                onClick={onClose}
              />
            ) : null}
          </div>
        }
      />
      <Text as="div" className={styles.description} size="fine" tone="muted">
        {description}
      </Text>
    </div>
  );
}
