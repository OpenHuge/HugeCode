import X from "lucide-react/dist/esm/icons/x";
import { Button, StatusBadge, type StatusBadgeTone } from "../../../design-system";

type SettingsModalHeaderProps = {
  title: string;
  subtitle: string;
  kicker?: string;
  contextLabel: string;
  contextTone?: StatusBadgeTone;
  activeLabel?: string | null;
  activeTone?: StatusBadgeTone;
  onClose?: (() => void) | null;
  closeLabel?: string;
};

export function SettingsModalHeader({
  title,
  subtitle,
  kicker = "Preferences",
  contextLabel,
  contextTone = "default",
  activeLabel = null,
  activeTone = "progress",
  onClose = null,
  closeLabel = "Close settings",
}: SettingsModalHeaderProps) {
  return (
    <div className="settings-titlebar">
      <div className="settings-header-copy">
        <div className="settings-kicker-row">
          <StatusBadge className="settings-kicker">{kicker}</StatusBadge>
          <StatusBadge className="settings-context-chip" tone={contextTone}>
            {contextLabel}
          </StatusBadge>
        </div>
        <div className="settings-title" id={onClose ? "settings-modal-title" : undefined}>
          {title}
        </div>
        <div className="settings-subtitle">{subtitle}</div>
      </div>
      {(activeLabel || onClose) && (
        <div className="settings-header-actions">
          {activeLabel ? (
            <StatusBadge className="settings-active-pill" tone={activeTone}>
              {activeLabel}
            </StatusBadge>
          ) : null}
          {onClose ? (
            <Button
              variant="ghost"
              size="icon"
              className="settings-close"
              onClick={onClose}
              aria-label={closeLabel}
            >
              <X aria-hidden />
            </Button>
          ) : null}
        </div>
      )}
    </div>
  );
}
