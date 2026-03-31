import ChevronDown from "lucide-react/dist/esm/icons/chevron-down";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { OAuthAccountSummary } from "../../../../../application/runtime/ports/oauth";
import { Button, PopoverSurface } from "../../../../../design-system";
import { AccountChecklist } from "./AccountChecklist";
import * as controlStyles from "./CodexAccountControls.css";

type PoolMemberSelectorProps = {
  memberAccountIds: string[];
  providerAccounts: OAuthAccountSummary[];
  onChange: (nextIds: string[]) => void;
  disabled?: boolean;
};

export function PoolMemberSelector({
  memberAccountIds,
  providerAccounts,
  onChange,
  disabled,
}: PoolMemberSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const [popoverPos, setPopoverPos] = useState({ top: 0, left: 0, width: 300 });

  useEffect(() => {
    if (isOpen && triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect();
      setPopoverPos({
        top: rect.bottom + 4,
        left: rect.left,
        width: Math.max(rect.width, 300),
      });

      const onClickOutside = (event: MouseEvent) => {
        const targetNode = event.target as Node | null;
        if (
          targetNode &&
          !triggerRef.current?.contains(targetNode) &&
          !popoverRef.current?.contains(targetNode)
        ) {
          setIsOpen(false);
        }
      };

      window.addEventListener("mousedown", onClickOutside);
      return () => window.removeEventListener("mousedown", onClickOutside);
    }

    return undefined;
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen || !popoverRef.current) {
      return;
    }
    popoverRef.current.style.setProperty("--apm-popover-top", `${popoverPos.top}px`);
    popoverRef.current.style.setProperty("--apm-popover-left", `${popoverPos.left}px`);
    popoverRef.current.style.setProperty("--apm-popover-width", `${popoverPos.width}px`);
  }, [isOpen, popoverPos]);

  const count = memberAccountIds.length;
  const label = count === 0 ? "No members" : `${count} member${count !== 1 ? "s" : ""}`;

  return (
    <>
      <Button
        ref={triggerRef}
        type="button"
        variant="ghost"
        size="sm"
        className={controlStyles.triggerButton}
        disabled={disabled}
        onClick={() => setIsOpen(!isOpen)}
        aria-label={`Select pool members. ${label}`}
      >
        <span className={controlStyles.triggerButtonLabel}>{label}</span>
        <ChevronDown size={14} className={controlStyles.triggerButtonIcon} aria-hidden />
      </Button>
      {isOpen &&
        createPortal(
          <div className={controlStyles.popoverWrapper} ref={popoverRef}>
            <PopoverSurface className={controlStyles.popoverContent}>
              <AccountChecklist
                accounts={providerAccounts}
                selectedIds={memberAccountIds}
                onToggle={(accountId, checked) => {
                  if (checked) {
                    onChange([...memberAccountIds, accountId]);
                  } else {
                    onChange(memberAccountIds.filter((id) => id !== accountId));
                  }
                }}
              />
            </PopoverSurface>
          </div>,
          document.body
        )}
    </>
  );
}
