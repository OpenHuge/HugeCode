import CreditCard from "lucide-react/dist/esm/icons/credit-card";
import Settings from "lucide-react/dist/esm/icons/settings";
import User from "lucide-react/dist/esm/icons/user";
import { useCallback, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Avatar } from "../../../design-system";
import { PopoverMenuItem, PopoverSurface } from "../../../design-system";
import { WorkspaceMenuSection, WorkspaceSupportMeta } from "../../../design-system";
import type { AccountSnapshot } from "../../../types";
import { joinClassNames } from "../../../utils/classNames";
import type { CodexSection } from "../../settings/components/settingsTypes";
import type { AccountCenterState } from "../hooks/useAccountCenterState";
import { useDismissibleMenu } from "../hooks/useDismissibleMenu";
import * as styles from "./SidebarUserNav.css";

type SidebarUserNavProps = {
  accountInfo: AccountSnapshot | null;
  accountCenter: AccountCenterState;
  onOpenSettings: (section?: CodexSection) => void;
  onOpenDebug: () => void;
  showDebugButton: boolean;
  onSwitchAccount: () => void;
  onSelectLoggedInCodexAccount: (accountId: string) => Promise<void>;
  onCancelSwitchAccount: () => void;
  accountSwitching: boolean;
  accountSwitchError: string | null;
  usage: {
    usageTitle: string;
    sessionLabel: string;
    weeklyLabel: string;
    sessionPercent: number | null;
    weeklyPercent: number | null;
    sessionResetLabel: string | null;
    weeklyResetLabel: string | null;
    creditsLabel: string | null;
  };
};

type AccountSnapshotWithWorkspaceTitle = AccountSnapshot & {
  defaultChatgptWorkspaceTitle?: string | null;
};

function toDisplayLabel(value: string | null | undefined): string | null {
  const normalized = value?.trim();
  if (!normalized) {
    return null;
  }
  return normalized.replace(/(^|[\s_-])([a-z])/g, (_, prefix: string, letter: string) => {
    return `${prefix}${letter.toUpperCase()}`;
  });
}

function resolveAccountSecondaryLabel(accountInfo: AccountSnapshot | null): string {
  const workspaceTitle = (
    accountInfo as AccountSnapshotWithWorkspaceTitle | null
  )?.defaultChatgptWorkspaceTitle?.trim();
  if (workspaceTitle) {
    return workspaceTitle;
  }
  const normalizedEmail = accountInfo?.email?.trim().toLowerCase() ?? null;
  const candidates = [
    accountInfo?.displayName?.trim(),
    accountInfo?.externalAccountId?.trim(),
    accountInfo?.accountId?.trim(),
  ];
  const identityLabel =
    candidates.find(
      (value) => value && (!normalizedEmail || value.toLowerCase() !== normalizedEmail)
    ) ?? null;
  if (identityLabel) {
    return identityLabel;
  }
  const providerLabel = toDisplayLabel(accountInfo?.provider);
  if (providerLabel) {
    return providerLabel;
  }
  return accountInfo?.email?.trim() ? "Connected account" : "Not connected";
}

function resolveAccountPrimaryLabel(accountInfo: AccountSnapshot | null): string {
  const candidates = [
    accountInfo?.email?.trim(),
    accountInfo?.displayName?.trim(),
    accountInfo?.externalAccountId?.trim(),
    accountInfo?.accountId?.trim(),
  ];
  return (
    candidates.find((value): value is string => typeof value === "string" && value.length > 0) ?? ""
  );
}

function resolveDisconnectedSecondaryLabel(connectedAccountCount: number): string {
  if (connectedAccountCount > 0) {
    return connectedAccountCount === 1
      ? "1 Codex account ready"
      : `${connectedAccountCount} Codex accounts ready`;
  }
  return "No Codex account connected";
}

export function SidebarUserNav({
  accountInfo,
  accountCenter,
  onOpenSettings,
  onOpenDebug,
  showDebugButton,
  onSwitchAccount,
  onSelectLoggedInCodexAccount,
  onCancelSwitchAccount,
  accountSwitching,
  accountSwitchError,
  usage,
}: SidebarUserNavProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [showLoggedInAccountChooser, setShowLoggedInAccountChooser] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const buttonRef = useRef<HTMLButtonElement | null>(null);
  const primeSettingsView = useCallback(() => {
    void import("../../settings/components/settingsViewLoader").then((module) => {
      return module.preloadSettingsView();
    });
  }, []);
  const closeMenuAndRun = useCallback((action: () => void) => {
    if (typeof window === "undefined") {
      setIsOpen(false);
      action();
      return;
    }
    window.setTimeout(() => {
      setIsOpen(false);
      action();
    }, 0);
  }, []);

  useDismissibleMenu({
    isOpen,
    containerRef: menuRef,
    additionalRefs: [buttonRef],
    onClose: () => setIsOpen(false),
  });

  const sessionProgressRef = useRef<HTMLDivElement | null>(null);
  const weeklyProgressRef = useRef<HTMLDivElement | null>(null);

  useLayoutEffect(() => {
    if (isOpen) {
      if (sessionProgressRef.current && usage.sessionPercent !== null) {
        sessionProgressRef.current.style.setProperty(
          "--progress-width",
          `${usage.sessionPercent}%`
        );
      }
      if (weeklyProgressRef.current && usage.weeklyPercent !== null) {
        weeklyProgressRef.current.style.setProperty("--progress-width", `${usage.weeklyPercent}%`);
      }
    }
  }, [isOpen, usage.sessionPercent, usage.weeklyPercent]);

  const connectedCodexAccounts = accountCenter.codex.connectedAccounts;
  const hasConnectedCodexAccounts = connectedCodexAccounts.length > 0;
  const accountIdentity = resolveAccountPrimaryLabel(accountInfo);
  const hasActiveAccount = accountIdentity.length > 0;
  const triggerPrimaryLabel = hasActiveAccount
    ? accountIdentity
    : hasConnectedCodexAccounts
      ? "Choose account"
      : "Connect account";
  const accountSummary = hasActiveAccount
    ? resolveAccountSecondaryLabel(accountInfo)
    : resolveDisconnectedSecondaryLabel(connectedCodexAccounts.length);
  const accountSummaryTitle = accountSummary;
  const primaryUsage =
    usage.sessionPercent !== null
      ? {
          label: usage.sessionLabel,
          percent: usage.sessionPercent,
          progressRef: sessionProgressRef,
          indicatorClassName: joinClassNames(
            "usage-progress-indicator",
            "usage-progress-indicator--session",
            styles.usageProgressIndicator
          ),
        }
      : usage.weeklyPercent !== null
        ? {
            label: usage.weeklyLabel,
            percent: usage.weeklyPercent,
            progressRef: weeklyProgressRef,
            indicatorClassName: joinClassNames(
              "usage-progress-indicator",
              "usage-progress-indicator--weekly",
              styles.usageProgressIndicator,
              styles.usageProgressIndicatorWeekly
            ),
          }
        : null;
  const secondaryUsageLabel =
    usage.sessionPercent !== null && usage.weeklyPercent !== null
      ? `${usage.weeklyLabel} ${usage.weeklyPercent}%`
      : null;
  const usageMetaLabels = [
    primaryUsage?.label === usage.sessionLabel ? usage.sessionResetLabel : usage.weeklyResetLabel,
    secondaryUsageLabel,
    usage.creditsLabel,
  ].filter((value): value is string => typeof value === "string" && value.trim().length > 0);
  const hasUsageValues = usage.sessionPercent !== null || usage.weeklyPercent !== null;
  const currentProjectWorkspaceAccountPlan = accountInfo?.planType?.trim() || "Free";
  const currentProjectWorkspaceAccountLabel =
    accountInfo?.email?.trim() ||
    accountInfo?.displayName?.trim() ||
    accountInfo?.accountId?.trim() ||
    "Not connected";
  const isSwitchingLoggedInAccount = accountCenter.codex.defaultRouteBusyAccountId !== null;
  const accountSelectionError = accountSwitchError ?? accountCenter.error;
  const triggerState = hasActiveAccount
    ? "connected"
    : hasConnectedCodexAccounts
      ? "available"
      : "disconnected";

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        className={joinClassNames("sidebar-user-nav", styles.nav)}
        onClick={() => {
          setIsOpen(!isOpen);
        }}
        aria-label="User menu"
        aria-expanded={isOpen}
        data-open={isOpen ? "true" : "false"}
        data-account-state={triggerState}
      >
        <Avatar
          className={joinClassNames("sidebar-user-avatar", styles.avatar)}
          size="sm"
          shape="circle"
          aria-hidden="true"
        >
          <User size={16} />
        </Avatar>
        <div className={joinClassNames("sidebar-user-info", styles.info)}>
          <div className={joinClassNames("sidebar-user-name", styles.name)}>
            {triggerPrimaryLabel}
          </div>
          <div
            className={joinClassNames("sidebar-user-workspace", styles.workspace)}
            title={accountSummaryTitle}
          >
            <Settings
              size={12}
              aria-hidden
              className={joinClassNames("sidebar-user-workspace-icon", styles.workspaceIcon)}
            />
            <span className={joinClassNames("sidebar-user-workspace-text", styles.workspaceText)}>
              {accountSummary}
            </span>
          </div>
        </div>
      </button>

      {isOpen &&
        createPortal(
          <div
            className={joinClassNames("sidebar-user-menu-wrapper", styles.menuWrapper)}
            ref={menuRef}
          >
            <PopoverSurface className={joinClassNames("sidebar-user-menu", styles.menu)}>
              <WorkspaceMenuSection
                label="Current project workspace Codex route"
                description="Account routing stays at the project level, separate from ChatGPT workspace membership."
              >
                <div className={joinClassNames("sidebar-account-card", styles.accountCard)}>
                  <div
                    className={joinClassNames(
                      "sidebar-account-card-header",
                      styles.accountCardHeader
                    )}
                  >
                    <div
                      className={joinClassNames(
                        "sidebar-account-card-title",
                        styles.accountCardTitle
                      )}
                    >
                      {currentProjectWorkspaceAccountLabel}
                    </div>
                    <WorkspaceSupportMeta
                      className={joinClassNames(
                        "sidebar-account-card-badge",
                        styles.accountCardBadge
                      )}
                      label={`Plan ${currentProjectWorkspaceAccountPlan}`}
                    />
                  </div>
                  <div
                    className={joinClassNames("sidebar-account-card-meta", styles.accountCardMeta)}
                  >
                    {accountInfo?.requiresOpenaiAuth
                      ? "OpenAI auth required for Codex login"
                      : "This is the Codex account currently routed into the active project workspace."}
                  </div>
                  {accountSelectionError ? (
                    <div
                      className={joinClassNames(
                        "sidebar-account-card-error",
                        styles.accountCardError
                      )}
                    >
                      {accountSelectionError}
                    </div>
                  ) : null}
                  {accountSwitching ? (
                    <div
                      className={joinClassNames(
                        "sidebar-account-card-actions",
                        styles.accountCardActions
                      )}
                    >
                      <div
                        className={joinClassNames(
                          "sidebar-account-card-status",
                          styles.accountCardStatus
                        )}
                      >
                        Switching the routed Codex account for this project workspace
                      </div>
                      <button
                        type="button"
                        className={joinClassNames(
                          "sidebar-account-inline-action",
                          styles.accountInlineAction
                        )}
                        onClick={() => {
                          onCancelSwitchAccount();
                        }}
                        aria-label="Cancel project workspace Codex account switch"
                      >
                        Cancel switch
                      </button>
                    </div>
                  ) : (
                    <>
                      <button
                        type="button"
                        className={joinClassNames(
                          "sidebar-account-primary-action",
                          styles.accountPrimaryAction
                        )}
                        onClick={() => {
                          setShowLoggedInAccountChooser((value) => !value);
                        }}
                        aria-expanded={showLoggedInAccountChooser}
                        aria-controls="sidebar-codex-account-chooser"
                      >
                        Switch Codex account
                      </button>
                      {showLoggedInAccountChooser ? (
                        <div
                          id="sidebar-codex-account-chooser"
                          className={joinClassNames(
                            "sidebar-account-chooser",
                            styles.accountChooser
                          )}
                        >
                          <div
                            className={joinClassNames(
                              "sidebar-account-chooser-label",
                              styles.accountChooserLabel
                            )}
                          >
                            Choose from logged-in Codex accounts
                          </div>
                          <div
                            className={joinClassNames(
                              "sidebar-account-chooser-hint",
                              styles.accountChooserHint
                            )}
                          >
                            Project workspace routing is separate from ChatGPT workspace membership.
                            Manage ChatGPT workspaces in Accounts &amp; Billing.
                          </div>
                          {hasConnectedCodexAccounts ? (
                            <div
                              className={joinClassNames(
                                "sidebar-account-chooser-list",
                                styles.accountChooserList
                              )}
                            >
                              {connectedCodexAccounts.map((account) => {
                                const isCurrentProjectWorkspaceAccount =
                                  account.accountId === accountInfo?.accountId;
                                const isBusy =
                                  accountCenter.codex.defaultRouteBusyAccountId ===
                                  account.accountId;
                                return (
                                  <button
                                    key={account.accountId}
                                    type="button"
                                    className={joinClassNames(
                                      "sidebar-account-choice",
                                      styles.accountChoice
                                    )}
                                    onClick={() => {
                                      void Promise.resolve(
                                        onSelectLoggedInCodexAccount(account.accountId)
                                      )
                                        .then(() => {
                                          setShowLoggedInAccountChooser(false);
                                        })
                                        .catch(() => {
                                          // Account center owns user-facing error state.
                                        });
                                    }}
                                    disabled={isSwitchingLoggedInAccount}
                                    aria-label={`Use logged-in Codex account ${account.label}`}
                                  >
                                    <span
                                      className={joinClassNames(
                                        "sidebar-account-choice-main",
                                        styles.accountChoiceMain
                                      )}
                                    >
                                      <span
                                        className={joinClassNames(
                                          "sidebar-account-choice-title",
                                          styles.accountChoiceTitle
                                        )}
                                      >
                                        {account.label}
                                      </span>
                                      <span
                                        className={joinClassNames(
                                          "sidebar-account-choice-meta",
                                          styles.accountChoiceMeta
                                        )}
                                      >
                                        {isCurrentProjectWorkspaceAccount
                                          ? "Current project workspace route"
                                          : account.isDefaultRoute
                                            ? "Global default Codex route"
                                            : "Logged-in Codex account"}
                                      </span>
                                    </span>
                                    <span
                                      className={joinClassNames(
                                        "sidebar-account-choice-badges",
                                        styles.accountChoiceBadges
                                      )}
                                    >
                                      {account.isDefaultRoute ? (
                                        <WorkspaceSupportMeta
                                          className={joinClassNames(
                                            "sidebar-account-choice-badge",
                                            styles.accountChoiceBadge
                                          )}
                                          label="Default"
                                        />
                                      ) : null}
                                      {isCurrentProjectWorkspaceAccount ? (
                                        <WorkspaceSupportMeta
                                          className={joinClassNames(
                                            "sidebar-account-choice-badge",
                                            styles.accountChoiceBadge
                                          )}
                                          tone="progress"
                                          label="Current project route"
                                        />
                                      ) : null}
                                      {isBusy ? (
                                        <WorkspaceSupportMeta
                                          className={joinClassNames(
                                            "sidebar-account-choice-badge",
                                            styles.accountChoiceBadge
                                          )}
                                          tone="warning"
                                          label="Switching"
                                        />
                                      ) : null}
                                    </span>
                                  </button>
                                );
                              })}
                            </div>
                          ) : (
                            <div
                              className={joinClassNames(
                                "sidebar-account-chooser-empty",
                                styles.accountChooserEmpty
                              )}
                            >
                              No logged-in Codex accounts are available yet.
                            </div>
                          )}
                          <div
                            className={joinClassNames(
                              "sidebar-account-chooser-actions",
                              styles.accountChooserActions
                            )}
                          >
                            <button
                              type="button"
                              className={joinClassNames(
                                "sidebar-account-inline-action",
                                styles.accountInlineAction
                              )}
                              onClick={() => {
                                onSwitchAccount();
                              }}
                            >
                              Sign in another account
                            </button>
                          </div>
                        </div>
                      ) : null}
                    </>
                  )}
                </div>
              </WorkspaceMenuSection>

              <WorkspaceMenuSection label={usage.usageTitle}>
                <div
                  className={joinClassNames("sidebar-user-menu-usage", "fa-duotone", styles.usage)}
                >
                  {primaryUsage ? (
                    <div className={joinClassNames("usage-item", styles.usageItem)}>
                      <div className={joinClassNames("usage-row", styles.usageRow)}>
                        <span>{primaryUsage.label}</span>
                        <span>{primaryUsage.percent}%</span>
                      </div>
                      <div
                        className={joinClassNames("usage-progress", styles.usageProgress)}
                        data-progress={primaryUsage.percent}
                        ref={primaryUsage.progressRef}
                      >
                        <div
                          className={primaryUsage.indicatorClassName}
                          aria-label={primaryUsage.label}
                        />
                      </div>
                    </div>
                  ) : null}
                  {!hasUsageValues ? (
                    <div
                      className={joinClassNames("sidebar-user-menu-usage-empty", styles.usageEmpty)}
                    >
                      Usage data unavailable.
                    </div>
                  ) : null}
                  {usageMetaLabels.length > 0 ? (
                    <div
                      className={joinClassNames("sidebar-user-menu-usage-meta", styles.usageMeta)}
                    >
                      {usageMetaLabels.map((label) => (
                        <WorkspaceSupportMeta
                          key={label}
                          className={joinClassNames(
                            "sidebar-user-menu-usage-meta-line",
                            styles.usageMetaLine
                          )}
                          label={label}
                        />
                      ))}
                    </div>
                  ) : null}
                </div>
              </WorkspaceMenuSection>

              <PopoverMenuItem
                onClick={() => {
                  closeMenuAndRun(() => onOpenSettings("codex"));
                }}
                onPointerEnter={primeSettingsView}
                onFocus={primeSettingsView}
                icon={<CreditCard size={14} />}
                aria-label="Manage Accounts & Billing"
              >
                Manage Accounts & Billing
              </PopoverMenuItem>

              <div className={joinClassNames("sidebar-menu-divider", styles.divider)} />

              <PopoverMenuItem
                onClick={() => {
                  closeMenuAndRun(() => onOpenSettings());
                }}
                onPointerEnter={primeSettingsView}
                onFocus={primeSettingsView}
                icon={<Settings size={14} />}
                aria-label="Open settings"
              >
                Settings
              </PopoverMenuItem>

              {showDebugButton ? (
                <PopoverMenuItem
                  onClick={() => {
                    closeMenuAndRun(() => onOpenDebug());
                  }}
                  icon={<Settings size={14} />}
                  aria-label="Open debug log"
                >
                  Debug Log
                </PopoverMenuItem>
              ) : null}
            </PopoverSurface>
          </div>,
          document.body
        )}
    </>
  );
}
