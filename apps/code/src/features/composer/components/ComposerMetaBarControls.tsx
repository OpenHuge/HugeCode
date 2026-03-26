import { Select, type SelectOption } from "../../../design-system";
import { Bot, BrainCog, Cpu, GitMerge, ListChecks } from "lucide-react";
import { useEffect } from "react";
import type { RefObject } from "react";
import type { ComposerExecutionMode, ComposerModelSelectionMode } from "../../../types";
import { joinClassNames } from "../../../utils/classNames";
import { ModelProviderPicker } from "../../models/components/ModelProviderPicker";
import type {
  ModelProviderOption,
  ProviderSelectableModel,
} from "../../models/utils/modelProviderSelection";
import * as controlStyles from "./ComposerMetaBarControls.styles.css";
import * as styles from "./ComposerMetaBar.styles.css";
import * as summaryStyles from "./ComposerMetaBarSummary.styles.css";

const EFFORT_MENU_MIN_WIDTH = 164;
const META_MENU_MAX_WIDTH = 260;
const COMPOSER_MENU_GAP = 2;
const DEFAULT_MODE_LABEL = "Chat";
const META_ICON_SIZE = 14;
const META_ICON_STROKE_WIDTH = 1.8;
const META_MODE_ICON_STROKE_WIDTH = 1.9;
const EXECUTION_TRIGGER_LABELS: Record<ComposerExecutionMode, string> = {
  runtime: "Runtime",
  hybrid: "Hybrid",
  "local-cli": "Codex CLI",
};
const EXECUTION_ICON_IDS: Record<ComposerExecutionMode, string> = {
  runtime: "runtime-host",
  hybrid: "hybrid-bridge",
  "local-cli": "codex",
};

function CodexMark({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden>
      <title>Codex</title>
      <path
        d="M8.25 7.5 5 12l3.25 4.5"
        stroke="currentColor"
        strokeWidth={META_ICON_STROKE_WIDTH}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M15.75 7.5 19 12l-3.25 4.5"
        stroke="currentColor"
        strokeWidth={META_ICON_STROKE_WIDTH}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="m10.5 16.75 3-9.5"
        stroke="currentColor"
        strokeWidth={META_ICON_STROKE_WIDTH}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function ExecutionModeIcon({ mode }: { mode: ComposerExecutionMode }) {
  if (mode === "local-cli") {
    return <CodexMark className={styles.iconGraphic} />;
  }
  if (mode === "hybrid") {
    return (
      <GitMerge
        className={styles.iconGraphic}
        size={META_ICON_SIZE}
        strokeWidth={META_ICON_STROKE_WIDTH}
        aria-hidden
      />
    );
  }
  return (
    <Cpu
      className={styles.iconGraphic}
      size={META_ICON_SIZE}
      strokeWidth={META_ICON_STROKE_WIDTH}
      aria-hidden
    />
  );
}

type ComposerMetaBarControlsProps = {
  controlsRef: RefObject<HTMLDivElement | null>;
  disabled: boolean;
  modelSelectionMode: ComposerModelSelectionMode;
  providerOptions: ModelProviderOption<ProviderSelectableModel>[];
  selectedProviderId: string | null;
  onSelectAutoRoute?: (providerId: string | null) => void;
  onSelectModelSelectionMode: (mode: ComposerModelSelectionMode) => void;
  onSelectProvider: (providerId: string) => void;
  selectedModelId: string | null;
  onSelectModel: (id: string) => void;
  effortSelectOptions: SelectOption[];
  selectedEffort: string | null;
  onSelectEffort: (effort: string) => void;
  reasoningSupported: boolean;
  shouldShowExecutionControl: boolean;
  executionSelectOptions: SelectOption[];
  selectedExecutionMode: ComposerExecutionMode;
  onSelectExecutionMode: (mode: ComposerExecutionMode) => void;
  shouldShowRemoteBackendControl: boolean;
  remoteBackendSelectOptions: SelectOption[];
  selectedRemoteBackendId: string | null;
  onSelectRemoteBackendId?: (backendId: string | null) => void;
  isPlanActive: boolean;
  planModeLabel: string;
  planModeAvailable: boolean;
  onSelectChatMode: () => void;
  onSelectPlanMode: () => void;
};

function formatExecutionSelectionLabel(selectedOptions: SelectOption[]): string {
  const selectedOption = selectedOptions[0];
  if (!selectedOption) {
    return EXECUTION_TRIGGER_LABELS.runtime;
  }
  return (
    EXECUTION_TRIGGER_LABELS[selectedOption.value as ComposerExecutionMode] ?? selectedOption.label
  );
}

export function ComposerMetaBarControls({
  controlsRef,
  disabled,
  modelSelectionMode,
  providerOptions,
  selectedProviderId,
  onSelectAutoRoute,
  onSelectModelSelectionMode,
  onSelectProvider,
  selectedModelId,
  onSelectModel,
  effortSelectOptions,
  selectedEffort,
  onSelectEffort,
  reasoningSupported,
  shouldShowExecutionControl,
  executionSelectOptions,
  selectedExecutionMode,
  onSelectExecutionMode,
  shouldShowRemoteBackendControl,
  remoteBackendSelectOptions,
  selectedRemoteBackendId,
  onSelectRemoteBackendId,
  isPlanActive,
  planModeLabel,
  planModeAvailable,
  onSelectChatMode,
  onSelectPlanMode,
}: ComposerMetaBarControlsProps) {
  const activeModeLabel = isPlanActive ? planModeLabel : DEFAULT_MODE_LABEL;
  const nextModeLabel = isPlanActive ? DEFAULT_MODE_LABEL : planModeLabel;

  const handleModeToggle = () => {
    if (disabled || !planModeAvailable) {
      return;
    }
    if (isPlanActive) {
      onSelectChatMode();
      return;
    }
    onSelectPlanMode();
  };

  useEffect(() => {
    const controlsRoot = controlsRef.current;
    if (!controlsRoot) {
      return;
    }

    const handleWrapPointerDown = (event: PointerEvent) => {
      if (disabled) {
        return;
      }
      const target = event.target as HTMLElement | null;
      if (!target) {
        return;
      }
      if (target.closest("[data-ui-select-menu]")) {
        return;
      }
      const wrap = target.closest<HTMLElement>(".composer-select-wrap[data-ui-select-anchor]");
      if (!wrap || !controlsRoot.contains(wrap) || target.closest("[data-ui-select-trigger]")) {
        return;
      }
      const trigger = wrap.querySelector<HTMLButtonElement>("[data-ui-select-trigger]");
      if (!trigger || trigger.disabled) {
        return;
      }
      event.preventDefault();
      trigger.focus();
      trigger.click();
    };

    controlsRoot.addEventListener("pointerdown", handleWrapPointerDown);
    return () => {
      controlsRoot.removeEventListener("pointerdown", handleWrapPointerDown);
    };
  }, [controlsRef, disabled]);

  return (
    <div
      className={joinClassNames(
        summaryStyles.controlCluster,
        summaryStyles.controlClusterGrow,
        "composer-meta"
      )}
      ref={controlsRef}
    >
      <button
        type="button"
        className={joinClassNames(controlStyles.modeToggle, "composer-mode-toggle")}
        aria-label={activeModeLabel}
        aria-pressed={isPlanActive}
        disabled={disabled}
        title={
          planModeAvailable ? `Switch to ${nextModeLabel.toLowerCase()} mode` : activeModeLabel
        }
        onClick={handleModeToggle}
      >
        {isPlanActive ? (
          <ListChecks
            className={controlStyles.modeToggleIcon}
            size={META_ICON_SIZE}
            strokeWidth={META_MODE_ICON_STROKE_WIDTH}
            aria-hidden
          />
        ) : (
          <Bot
            className={controlStyles.modeToggleIcon}
            size={META_ICON_SIZE}
            strokeWidth={META_MODE_ICON_STROKE_WIDTH}
            aria-hidden
          />
        )}
        <span className={controlStyles.modeToggleLabel}>{activeModeLabel}</span>
      </button>
      <div
        className={joinClassNames(
          styles.selectWrap,
          "composer-select-wrap composer-select-wrap--model-provider"
        )}
        data-ds-select-anchor
        data-ui-select-anchor
      >
        <span className={joinClassNames(styles.selectCaption, "composer-select-caption")}>
          Provider / Model
        </span>
        <ModelProviderPicker
          ariaLabel="Model"
          providerOptions={providerOptions}
          selectionMode={modelSelectionMode}
          selectedProviderId={selectedProviderId}
          onSelectAutoRoute={
            onSelectAutoRoute
              ? onSelectAutoRoute
              : (providerId) => {
                  if (providerId) {
                    onSelectProvider(providerId);
                  }
                  onSelectModelSelectionMode("auto");
                }
          }
          onSelectProvider={onSelectProvider}
          selectedModelId={selectedModelId}
          onSelectModel={onSelectModel}
          disabled={disabled}
          className={joinClassNames(
            styles.selectControl,
            styles.selectControlWidth.model,
            "composer-select-control composer-select-control--model-provider"
          )}
          triggerClassName={joinClassNames(styles.selectTrigger, "composer-select-trigger")}
        />
      </div>
      <div
        className={joinClassNames(
          styles.selectWrap,
          "composer-select-wrap composer-select-wrap--effort"
        )}
        data-ds-select-anchor
        data-ui-select-anchor
      >
        <span className={joinClassNames(styles.selectCaption, "composer-select-caption")}>
          Reasoning
        </span>
        <span
          className={joinClassNames(
            styles.icon,
            styles.iconEffort,
            "composer-icon composer-icon--effort"
          )}
          aria-hidden
        >
          <BrainCog
            className={styles.iconGraphic}
            size={META_ICON_SIZE}
            strokeWidth={META_ICON_STROKE_WIDTH}
          />
        </span>
        <Select
          className={joinClassNames(
            styles.selectControl,
            styles.selectControlWidth.effort,
            "composer-select-control composer-select-control--effort"
          )}
          triggerDensity="compact"
          triggerClassName={joinClassNames(styles.selectTrigger, "composer-select-trigger")}
          menuClassName={joinClassNames(styles.selectMenu, "composer-select-menu")}
          optionClassName={joinClassNames(styles.selectOption, "composer-select-option")}
          menuWidthMode="trigger"
          minMenuWidth={EFFORT_MENU_MIN_WIDTH}
          maxMenuWidth={META_MENU_MAX_WIDTH}
          menuGap={COMPOSER_MENU_GAP}
          ariaLabel="Thinking mode"
          options={effortSelectOptions}
          value={selectedEffort}
          onValueChange={onSelectEffort}
          disabled={disabled || !reasoningSupported}
          placeholder="Default"
        />
      </div>
      {shouldShowExecutionControl ? (
        <div
          className={joinClassNames(
            styles.selectWrap,
            "composer-select-wrap composer-select-wrap--execution"
          )}
          data-ds-select-anchor
          data-ui-select-anchor
        >
          <span className={joinClassNames(styles.selectCaption, "composer-select-caption")}>
            Execution
          </span>
          <span
            className={joinClassNames(styles.icon, "composer-icon composer-icon--execution")}
            data-execution-mode={selectedExecutionMode}
            data-execution-icon={EXECUTION_ICON_IDS[selectedExecutionMode]}
            aria-hidden
          >
            <ExecutionModeIcon mode={selectedExecutionMode} />
          </span>
          <Select
            className={joinClassNames(
              styles.selectControl,
              styles.selectControlWidth.execution,
              "composer-select-control composer-select-control--execution"
            )}
            triggerDensity="compact"
            triggerClassName={joinClassNames(styles.selectTrigger, "composer-select-trigger")}
            menuClassName={joinClassNames(
              styles.selectMenu,
              styles.selectMenuWidth.execution,
              "composer-select-menu"
            )}
            optionClassName={joinClassNames(styles.selectOption, "composer-select-option")}
            menuWidthMode="content"
            maxMenuWidth={META_MENU_MAX_WIDTH}
            minMenuWidth={188}
            menuGap={COMPOSER_MENU_GAP}
            ariaLabel="Execution path"
            options={executionSelectOptions}
            formatSelectionLabel={formatExecutionSelectionLabel}
            value={selectedExecutionMode}
            onValueChange={(value) => {
              if (!value) {
                return;
              }
              onSelectExecutionMode(value as ComposerExecutionMode);
            }}
            disabled={disabled}
            placeholder="Runtime"
          />
        </div>
      ) : null}
      {shouldShowRemoteBackendControl ? (
        <div
          className={joinClassNames(
            styles.selectWrap,
            "composer-select-wrap composer-select-wrap--remote-backend"
          )}
          data-ds-select-anchor
          data-ui-select-anchor
        >
          <span className={joinClassNames(styles.selectCaption, "composer-select-caption")}>
            Remote backend
          </span>
          <span className={joinClassNames(styles.icon, "composer-icon")} aria-hidden>
            <svg className={styles.iconGraphic} viewBox="0 0 24 24" fill="none">
              <title>Remote backend</title>
              <path
                d="M5 8.5h14M5 15.5h14M8 5.5h8M8 18.5h8"
                stroke="currentColor"
                strokeWidth={META_ICON_STROKE_WIDTH}
                strokeLinecap="round"
              />
              <path
                d="M6.5 12h11"
                stroke="currentColor"
                strokeWidth={META_ICON_STROKE_WIDTH}
                strokeLinecap="round"
              />
            </svg>
          </span>
          <Select
            className={joinClassNames(
              styles.selectControl,
              styles.selectControlWidth.execution,
              "composer-select-control composer-select-control--remote-backend"
            )}
            triggerDensity="compact"
            triggerClassName={joinClassNames(styles.selectTrigger, "composer-select-trigger")}
            menuClassName={joinClassNames(
              styles.selectMenu,
              styles.selectMenuWidth.execution,
              "composer-select-menu"
            )}
            optionClassName={joinClassNames(styles.selectOption, "composer-select-option")}
            menuWidthMode="content"
            maxMenuWidth={META_MENU_MAX_WIDTH}
            minMenuWidth={188}
            menuGap={COMPOSER_MENU_GAP}
            ariaLabel="Remote backend"
            options={remoteBackendSelectOptions}
            value={selectedRemoteBackendId}
            onValueChange={onSelectRemoteBackendId}
            disabled={disabled || !onSelectRemoteBackendId}
            placeholder="Default"
          />
        </div>
      ) : null}
    </div>
  );
}
