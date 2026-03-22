import { Select, type SelectOption } from "../../../design-system";
import { Bot, BrainCog, Cpu, GitMerge, ListChecks, Zap } from "lucide-react";
import { useEffect } from "react";
import type { RefObject } from "react";
import type { ComposerExecutionMode } from "../../../types";
import { joinClassNames } from "../../../utils/classNames";
import * as controlStyles from "./ComposerMetaBarControls.styles.css";
import * as styles from "./ComposerMetaBar.styles.css";
import * as summaryStyles from "./ComposerMetaBarSummary.styles.css";

const MODEL_MENU_MIN_WIDTH = 208;
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

function OpenAiMark({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      preserveAspectRatio="xMidYMid"
      viewBox="0 0 256 260"
      fill="currentColor"
      aria-hidden
    >
      <title>OpenAI</title>
      <path d="M239.184 106.203a64.716 64.716 0 0 0-5.576-53.103C219.452 28.459 191 15.784 163.213 21.74A65.586 65.586 0 0 0 52.096 45.22a64.716 64.716 0 0 0-43.23 31.36c-14.31 24.602-11.061 55.634 8.033 76.74a64.665 64.665 0 0 0 5.525 53.102c14.174 24.65 42.644 37.324 70.446 31.36a64.72 64.72 0 0 0 48.754 21.744c28.481.025 53.714-18.361 62.414-45.481a64.767 64.767 0 0 0 43.229-31.36c14.137-24.558 10.875-55.423-8.083-76.483Zm-97.56 136.338a48.397 48.397 0 0 1-31.105-11.255l1.535-.87 51.67-29.825a8.595 8.595 0 0 0 4.247-7.367v-72.85l21.845 12.636c.218.111.37.32.409.563v60.367c-.056 26.818-21.783 48.545-48.601 48.601Zm-104.466-44.61a48.345 48.345 0 0 1-5.781-32.589l1.534.921 51.722 29.826a8.339 8.339 0 0 0 8.441 0l63.181-36.425v25.221a.87.87 0 0 1-.358.665l-52.335 30.184c-23.257 13.398-52.97 5.431-66.404-17.803ZM23.549 85.38a48.499 48.499 0 0 1 25.58-21.333v61.39a8.288 8.288 0 0 0 4.195 7.316l62.874 36.272-21.845 12.636a.819.819 0 0 1-.767 0L41.353 151.53c-23.211-13.454-31.171-43.144-17.804-66.405v.256Zm179.466 41.695-63.08-36.63L161.73 77.86a.819.819 0 0 1 .768 0l52.233 30.184a48.6 48.6 0 0 1-7.316 87.635v-61.391a8.544 8.544 0 0 0-4.4-7.213Zm21.742-32.69-1.535-.922-51.619-30.081a8.39 8.39 0 0 0-8.492 0L99.98 99.808V74.587a.716.716 0 0 1 .307-.665l52.233-30.133a48.652 48.652 0 0 1 72.236 50.391v.205ZM88.061 139.097l-21.845-12.585a.87.87 0 0 1-.41-.614V65.685a48.652 48.652 0 0 1 79.757-37.346l-1.535.87-51.67 29.825a8.595 8.595 0 0 0-4.246 7.367l-.051 72.697Zm11.868-25.58 28.138-16.217 28.188 16.218v32.434l-28.086 16.218-28.188-16.218-.052-32.434Z" />
    </svg>
  );
}

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
  modelSelectOptions: SelectOption[];
  selectedModelId: string | null;
  onSelectModel: (id: string) => void;
  effortSelectOptions: SelectOption[];
  selectedEffort: string | null;
  onSelectEffort: (effort: string) => void;
  fastModeEnabled?: boolean;
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
  modelSelectOptions,
  selectedModelId,
  onSelectModel,
  effortSelectOptions,
  selectedEffort,
  onSelectEffort,
  fastModeEnabled = false,
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
          "composer-select-wrap composer-select-wrap--model"
        )}
        data-ds-select-anchor
        data-ui-select-anchor
      >
        <span className={joinClassNames(styles.selectCaption, "composer-select-caption")}>
          Model
        </span>
        <span
          className={joinClassNames(
            styles.icon,
            styles.iconModel,
            "composer-icon composer-icon--model"
          )}
          data-fast-speed-enabled={fastModeEnabled ? "true" : "false"}
          aria-hidden
        >
          {fastModeEnabled ? (
            <Zap
              className={joinClassNames(styles.iconGraphic, styles.iconGraphicModel)}
              size={META_ICON_SIZE}
              strokeWidth={META_MODE_ICON_STROKE_WIDTH}
              aria-hidden
            />
          ) : (
            <OpenAiMark className={joinClassNames(styles.iconGraphic, styles.iconGraphicModel)} />
          )}
        </span>
        <Select
          className={joinClassNames(
            styles.selectControl,
            styles.selectControlWidth.model,
            "composer-select-control composer-select-control--model"
          )}
          triggerDensity="compact"
          triggerClassName={joinClassNames(styles.selectTrigger, "composer-select-trigger")}
          menuClassName={joinClassNames(styles.selectMenu, "composer-select-menu")}
          optionClassName={joinClassNames(styles.selectOption, "composer-select-option")}
          menuWidthMode="trigger"
          minMenuWidth={MODEL_MENU_MIN_WIDTH}
          maxMenuWidth={META_MENU_MAX_WIDTH}
          menuGap={COMPOSER_MENU_GAP}
          ariaLabel="Model"
          options={modelSelectOptions}
          value={selectedModelId}
          onValueChange={onSelectModel}
          disabled={disabled}
          placeholder="No models"
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
