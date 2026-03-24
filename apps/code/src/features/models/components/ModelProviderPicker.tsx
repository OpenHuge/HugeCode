import Check from "lucide-react/dist/esm/icons/check";
import ChevronDown from "lucide-react/dist/esm/icons/chevron-down";
import ChevronRight from "lucide-react/dist/esm/icons/chevron-right";
import Sparkles from "lucide-react/dist/esm/icons/sparkles";
import Bot from "lucide-react/dist/esm/icons/bot";
import { useEffect, useMemo, useRef, useState } from "react";
import { PopoverSurface } from "../../../design-system";
import { useDismissibleMenu } from "../../app/hooks/useDismissibleMenu";
import { joinClassNames } from "../../../utils/classNames";
import type { ComposerModelSelectionMode } from "../../../types";
import {
  buildProviderModelEntries,
  type ModelProviderOption,
  type ProviderSelectableModel,
} from "../utils/modelProviderSelection";
import * as styles from "./ModelProviderPicker.css";

function CodexMark({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M8.25 7.5 5 12l3.25 4.5"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M15.75 7.5 19 12l-3.25 4.5"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="m10.5 16.75 3-9.5"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function ProviderGlyph({
  providerId,
  className,
}: {
  providerId: string | null | undefined;
  className?: string;
}) {
  switch ((providerId ?? "").trim().toLowerCase()) {
    case "codex":
      return <CodexMark className={className} />;
    case "claude":
      return <Sparkles className={className} size={14} strokeWidth={1.8} aria-hidden />;
    default:
      return <Bot className={className} size={14} strokeWidth={1.8} aria-hidden />;
  }
}

function resolveActiveProviderId<TModel extends ProviderSelectableModel>(
  providerOptions: ReadonlyArray<ModelProviderOption<TModel>>,
  selectedProviderId: string | null
): string | null {
  if (selectedProviderId) {
    const selectedOption = providerOptions.find((option) => option.id === selectedProviderId);
    if (selectedOption) {
      return selectedOption.id;
    }
  }
  return (
    providerOptions.find((providerOption) => providerOption.hasAvailableModels)?.id ??
    providerOptions[0]?.id ??
    null
  );
}

function resolveSelectedModel<TModel extends ProviderSelectableModel>(
  providerOptions: ReadonlyArray<ModelProviderOption<TModel>>,
  selectedModelId: string | null
): TModel | null {
  if (!selectedModelId) {
    return null;
  }
  for (const providerOption of providerOptions) {
    const matchedModel = providerOption.models.find(
      (model) => model.id === selectedModelId || model.model === selectedModelId
    );
    if (matchedModel) {
      return matchedModel;
    }
  }
  return null;
}

function resolveExecutionBadgeLabel(
  executionKind: ProviderSelectableModel["executionKind"]
): string | null {
  if (executionKind === "local") {
    return "Local";
  }
  if (executionKind === "cloud") {
    return "Cloud";
  }
  return null;
}

function resolveReadinessBadgeLabel(
  readinessKind: ProviderSelectableModel["providerReadinessKind"],
  available: boolean | undefined
): string | null {
  if (readinessKind === "not_authenticated") {
    return "Needs login";
  }
  if (readinessKind === "not_installed" || readinessKind === "unsupported_platform") {
    return "Unavailable";
  }
  if (available === false || readinessKind === "degraded") {
    return "Unavailable";
  }
  if (readinessKind === "ready") {
    return "Ready";
  }
  return null;
}

type ModelProviderPickerProps<TModel extends ProviderSelectableModel = ProviderSelectableModel> = {
  ariaLabel: string;
  providerOptions: ReadonlyArray<ModelProviderOption<TModel>>;
  selectionMode?: ComposerModelSelectionMode;
  selectedProviderId: string | null;
  selectedModelId: string | null;
  onSelectProvider?: (providerId: string) => void;
  onSelectModel: (modelId: string) => void;
  disabled?: boolean;
  fullWidth?: boolean;
  className?: string;
  triggerClassName?: string;
};

export function ModelProviderPicker<TModel extends ProviderSelectableModel>({
  ariaLabel,
  providerOptions,
  selectionMode = "manual",
  selectedProviderId,
  selectedModelId,
  onSelectProvider,
  onSelectModel,
  disabled = false,
  fullWidth = false,
  className,
  triggerClassName,
}: ModelProviderPickerProps<TModel>) {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [activeProviderId, setActiveProviderId] = useState<string | null>(() =>
    resolveActiveProviderId(providerOptions, selectedProviderId)
  );

  useDismissibleMenu({
    isOpen,
    containerRef: rootRef,
    onClose: () => setIsOpen(false),
  });

  useEffect(() => {
    if (isOpen) {
      return;
    }
    setActiveProviderId(resolveActiveProviderId(providerOptions, selectedProviderId));
  }, [isOpen, providerOptions, selectedProviderId]);

  useEffect(() => {
    const resolvedActiveProviderId = resolveActiveProviderId(providerOptions, activeProviderId);
    if (resolvedActiveProviderId !== activeProviderId) {
      setActiveProviderId(resolvedActiveProviderId);
    }
  }, [activeProviderId, providerOptions]);

  const selectedProvider =
    providerOptions.find((providerOption) => providerOption.id === selectedProviderId) ?? null;
  const selectedModel = useMemo(
    () => resolveSelectedModel(providerOptions, selectedModelId),
    [providerOptions, selectedModelId]
  );
  const currentProvider = selectedProvider ?? providerOptions[0] ?? null;
  const activeProvider =
    providerOptions.find((providerOption) => providerOption.id === activeProviderId) ??
    currentProvider;
  const activeProviderModels = useMemo(() => {
    const dedupedModels = buildProviderModelEntries(activeProvider?.models ?? [], selectedModelId);
    const availableModels = dedupedModels.filter((model) => model.available !== false);
    const visibleModels = availableModels.length > 0 ? availableModels : dedupedModels;
    if (selectedModel && !visibleModels.some((model) => model.id === selectedModel.id)) {
      return [selectedModel, ...visibleModels];
    }
    return visibleModels;
  }, [activeProvider, selectedModel, selectedModelId]);

  const triggerLabel =
    selectedModel?.displayName?.trim() ||
    selectedModel?.model ||
    currentProvider?.label ||
    "Choose model";
  const triggerTitle =
    currentProvider && selectedModel
      ? `${currentProvider.label} · ${selectedModel.displayName?.trim() || selectedModel.model}`
      : triggerLabel;

  return (
    <div
      ref={rootRef}
      className={joinClassNames(
        styles.root,
        fullWidth ? styles.rootWidth.full : styles.rootWidth.auto,
        className
      )}
    >
      <button
        type="button"
        aria-label={ariaLabel}
        aria-haspopup="menu"
        aria-expanded={isOpen}
        data-ui-select-trigger
        data-state={isOpen ? "open" : "closed"}
        className={joinClassNames(styles.trigger, triggerClassName)}
        disabled={disabled || providerOptions.length === 0}
        title={triggerTitle}
        onClick={() => {
          if (disabled || providerOptions.length === 0) {
            return;
          }
          setIsOpen((current) => !current);
        }}
      >
        <span className={styles.triggerBody}>
          <span className={styles.triggerIcon} aria-hidden>
            <ProviderGlyph
              providerId={currentProvider?.id ?? null}
              className={styles.triggerIcon}
            />
          </span>
          <span className={styles.triggerLabel}>{triggerLabel}</span>
          <span className={styles.triggerCaret} aria-hidden>
            <ChevronDown size={14} strokeWidth={1.8} />
          </span>
        </span>
      </button>
      {isOpen ? (
        <div className={styles.overlay}>
          <PopoverSurface
            className={joinClassNames(styles.panel, styles.providerPanel)}
            role="menu"
            aria-label={`${ariaLabel} providers`}
          >
            <div className={styles.list}>
              {providerOptions.map((providerOption) => {
                const isActive = providerOption.id === activeProvider?.id;
                return (
                  <button
                    key={providerOption.id}
                    type="button"
                    role="menuitem"
                    className={joinClassNames(styles.item, isActive && styles.itemActive)}
                    disabled={!providerOption.hasAvailableModels}
                    onMouseEnter={() => setActiveProviderId(providerOption.id)}
                    onFocus={() => setActiveProviderId(providerOption.id)}
                    onClick={() => {
                      setActiveProviderId(providerOption.id);
                      if (onSelectProvider) {
                        onSelectProvider(providerOption.id);
                      }
                      if (selectionMode === "auto") {
                        setIsOpen(false);
                      }
                    }}
                  >
                    <span className={styles.itemIcon} aria-hidden>
                      <ProviderGlyph providerId={providerOption.id} className={styles.itemIcon} />
                    </span>
                    <span className={styles.itemText}>
                      <span className={styles.itemLabel}>{providerOption.label}</span>
                      <span className={styles.itemMetaRow}>
                        {resolveExecutionBadgeLabel(providerOption.executionKind) ? (
                          <span className={styles.itemBadge}>
                            {resolveExecutionBadgeLabel(providerOption.executionKind)}
                          </span>
                        ) : null}
                        {resolveReadinessBadgeLabel(
                          providerOption.readinessKind,
                          providerOption.hasAvailableModels
                        ) ? (
                          <span className={styles.itemBadgeMuted}>
                            {resolveReadinessBadgeLabel(
                              providerOption.readinessKind,
                              providerOption.hasAvailableModels
                            )}
                          </span>
                        ) : null}
                      </span>
                    </span>
                    <span className={styles.itemAffordance} aria-hidden>
                      <ChevronRight size={12} strokeWidth={1.8} />
                    </span>
                  </button>
                );
              })}
            </div>
          </PopoverSurface>
          <PopoverSurface
            className={joinClassNames(styles.panel, styles.modelPanel)}
            role="menu"
            aria-label={`${activeProvider?.label ?? "Selected"} models`}
          >
            <div className={styles.list}>
              {activeProviderModels.map((model) => {
                const isSelected = model.id === selectedModelId || model.model === selectedModelId;
                return (
                  <button
                    key={model.id}
                    type="button"
                    role="menuitemradio"
                    aria-checked={isSelected}
                    className={joinClassNames(styles.item, isSelected && styles.itemSelected)}
                    disabled={model.available === false}
                    onClick={() => {
                      onSelectModel(model.id);
                      setIsOpen(false);
                    }}
                    title={model.providerReadinessMessage ?? undefined}
                  >
                    <span className={styles.itemIcon} aria-hidden>
                      {isSelected ? <Check size={14} strokeWidth={2} /> : null}
                    </span>
                    <span className={styles.itemText}>
                      <span className={styles.itemLabel}>
                        {model.displayName?.trim() || model.model}
                      </span>
                      <span className={styles.itemMetaRow}>
                        {resolveExecutionBadgeLabel(model.executionKind) ? (
                          <span className={styles.itemBadge}>
                            {resolveExecutionBadgeLabel(model.executionKind)}
                          </span>
                        ) : null}
                        {resolveReadinessBadgeLabel(
                          model.providerReadinessKind,
                          model.available
                        ) ? (
                          <span className={styles.itemBadgeMuted}>
                            {resolveReadinessBadgeLabel(
                              model.providerReadinessKind,
                              model.available
                            )}
                          </span>
                        ) : null}
                      </span>
                    </span>
                    <span className={styles.itemAffordance} aria-hidden />
                  </button>
                );
              })}
            </div>
          </PopoverSurface>
        </div>
      ) : null}
    </div>
  );
}
