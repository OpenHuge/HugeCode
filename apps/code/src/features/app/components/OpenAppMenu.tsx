import { isDesktopHostRuntime } from "../../../application/runtime/ports/desktopHostCore";
import { revealItemInDir } from "../../../application/runtime/facades/desktopHostFacade";
import ChevronDown from "lucide-react/dist/esm/icons/chevron-down";
import { useMemo } from "react";
import { Select, type SelectOption, WorkspaceHeaderAction } from "../../../design-system";
import { openWorkspaceIn } from "../../../application/runtime/ports/desktopApps";
import { pushErrorToast } from "../../../application/runtime/ports/toasts";
import type { OpenAppTarget } from "../../../types";
import { writeSafeLocalStorageItem } from "../../../utils/safeLocalStorage";
import { DEFAULT_OPEN_APP_ID, DEFAULT_OPEN_APP_TARGETS, OPEN_APP_STORAGE_KEY } from "../constants";
import { resolveOpenAppGlyph } from "../utils/openAppGlyphs";
import { captureSentryException } from "../../shared/sentry";
import "./OpenAppMenu.css";

type OpenTarget = {
  id: string;
  label: string;
  target: OpenAppTarget;
};

type OpenAppMenuProps = {
  path: string;
  openTargets: OpenAppTarget[];
  selectedOpenAppId: string;
  onSelectOpenAppId: (id: string) => void;
  iconById?: Record<string, string>;
};

export function OpenAppMenu({
  path,
  openTargets,
  selectedOpenAppId,
  onSelectOpenAppId,
  iconById = {},
}: OpenAppMenuProps) {
  const desktopOpenSupported = isDesktopHostRuntime();
  const availableTargets = openTargets.length > 0 ? openTargets : DEFAULT_OPEN_APP_TARGETS;
  const openAppId = useMemo(
    () => availableTargets.find((target) => target.id === selectedOpenAppId)?.id,
    [availableTargets, selectedOpenAppId]
  );
  const resolvedOpenAppId = openAppId ?? availableTargets[0]?.id ?? DEFAULT_OPEN_APP_ID;

  const resolvedOpenTargets = useMemo<OpenTarget[]>(
    () =>
      availableTargets.map((target) => ({
        id: target.id,
        label: target.label,
        target,
      })),
    [availableTargets]
  );

  const fallbackOpenAppTarget: OpenAppTarget = DEFAULT_OPEN_APP_TARGETS.find(
    (target) => target.id === DEFAULT_OPEN_APP_ID
  ) ??
    DEFAULT_OPEN_APP_TARGETS[0] ?? {
      id: DEFAULT_OPEN_APP_ID,
      label: "VS Code",
      kind: "app",
      appName: "Visual Studio Code",
      command: null,
      args: [],
    };
  const fallbackTarget: OpenTarget = {
    id: DEFAULT_OPEN_APP_ID,
    label:
      DEFAULT_OPEN_APP_TARGETS.find((target) => target.id === DEFAULT_OPEN_APP_ID)?.label ??
      DEFAULT_OPEN_APP_TARGETS[0]?.label ??
      "Open",
    target: fallbackOpenAppTarget,
  };
  const selectedOpenTarget =
    resolvedOpenTargets.find((target) => target.id === resolvedOpenAppId) ??
    resolvedOpenTargets[0] ??
    fallbackTarget;

  const reportOpenError = (error: unknown, target: OpenTarget) => {
    const message = error instanceof Error ? error.message : String(error);
    captureSentryException(error, {
      tags: {
        feature: "open-app-menu",
      },
      extra: {
        path,
        targetId: target.id,
        targetKind: target.target.kind,
        targetAppName: target.target.appName ?? null,
        targetCommand: target.target.command ?? null,
      },
    });
    pushErrorToast({
      title: "Couldn’t open workspace",
      message,
    });
  };

  const resolveAppName = (target: OpenTarget) => (target.target.appName ?? "").trim();
  const resolveCommand = (target: OpenTarget) => (target.target.command ?? "").trim();
  const canOpenTarget = (target: OpenTarget) => {
    if (!desktopOpenSupported) {
      return false;
    }
    if (target.target.kind === "finder") {
      return true;
    }
    if (target.target.kind === "command") {
      return Boolean(resolveCommand(target));
    }
    return Boolean(resolveAppName(target));
  };
  const editorOptions = useMemo<SelectOption[]>(
    () =>
      resolvedOpenTargets.map((target) => ({
        value: target.id,
        label: target.label,
        disabled: !canOpenTarget(target),
        leading: resolveOpenAppGlyph(target.target, {
          className: "open-app-icon open-app-icon--menu",
          iconById,
        }),
      })),
    [iconById, resolvedOpenTargets]
  );
  const targetById = useMemo(
    () => new Map(resolvedOpenTargets.map((target) => [target.id, target])),
    [resolvedOpenTargets]
  );

  const openWithTarget = async (target: OpenTarget) => {
    try {
      if (target.target.kind === "finder") {
        if (isDesktopHostRuntime()) {
          await revealItemInDir(path);
        } else {
          await openWorkspaceIn(path, {});
        }
        return;
      }
      if (target.target.kind === "command") {
        const command = resolveCommand(target);
        if (!command) {
          return;
        }
        await openWorkspaceIn(path, {
          command,
          args: target.target.args,
        });
        return;
      }
      const appName = resolveAppName(target);
      if (!appName) {
        return;
      }
      await openWorkspaceIn(path, {
        appName,
        args: target.target.args,
      });
    } catch (error) {
      reportOpenError(error, target);
    }
  };

  const handleOpen = async () => {
    if (!selectedOpenTarget || !canOpenTarget(selectedOpenTarget)) {
      return;
    }
    await openWithTarget(selectedOpenTarget);
  };

  const handleSelectOpenTarget = async (target: OpenTarget) => {
    if (!canOpenTarget(target)) {
      return;
    }
    onSelectOpenAppId(target.id);
    writeSafeLocalStorageItem(OPEN_APP_STORAGE_KEY, target.id);
    await openWithTarget(target);
  };

  const selectedCanOpen = canOpenTarget(selectedOpenTarget);
  const openLabel = selectedCanOpen
    ? `Open in ${selectedOpenTarget.label}`
    : !desktopOpenSupported
      ? "Open in is unavailable outside desktop host runtime"
      : selectedOpenTarget.target.kind === "command"
        ? "Set command in Settings"
        : "Set app name in Settings";

  return (
    <div className="open-app-menu">
      <div className={`open-app-button${selectedCanOpen ? "" : " is-disabled"}`}>
        <WorkspaceHeaderAction
          onClick={handleOpen}
          disabled={!selectedCanOpen}
          data-desktop-drag-region="false"
          aria-label={`Open in ${selectedOpenTarget.label}`}
          title={openLabel}
          segment="single"
        >
          <span className="open-app-label">
            {resolveOpenAppGlyph(selectedOpenTarget.target, {
              className: "open-app-icon open-app-icon--trigger",
              iconById,
            })}
            {selectedOpenTarget.label}
          </span>
        </WorkspaceHeaderAction>
        <Select
          className="open-app-picker"
          menuClassName="open-app-dropdown"
          optionClassName="open-app-option"
          triggerDensity="compact"
          menuWidthMode="content"
          minMenuWidth={160}
          menuGap={8}
          ariaLabel="Select editor"
          options={editorOptions}
          value={resolvedOpenAppId}
          onValueChange={(id) => {
            const target = targetById.get(id);
            if (!target) {
              return;
            }
            void handleSelectOpenTarget(target);
          }}
          renderTrigger={({
            ref,
            triggerProps,
            open,
            caret: _caret,
            selectionLabel: _selectionLabel,
            selectedOptions: _selectedOptions,
            hasSelection: _hasSelection,
          }) => (
            <WorkspaceHeaderAction
              {...triggerProps}
              ref={ref}
              className="open-app-picker-trigger"
              data-desktop-drag-region="false"
              title="Select editor"
              active={open}
              segment="icon"
              icon={<ChevronDown size={16} aria-hidden />}
            />
          )}
        />
      </div>
    </div>
  );
}
