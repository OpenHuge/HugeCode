import { type DragEvent, useMemo, useState } from "react";
import type { ConversationItem, ThreadTokenUsage, TurnPlan } from "../../../types";
import { Checkbox } from "../../../design-system";
import { PanelFrame, PanelHeader, PanelMeta } from "../../../design-system";
import { type PanelTabId, PanelTabs } from "../../layout/components/PanelTabs";
import type { ThreadStatusSummary } from "../../threads/utils/threadExecutionState";
import {
  ATLAS_DETAIL_LEVELS,
  ATLAS_DRIVER_PRESETS,
  type AtlasDetailLevel,
  type AtlasDriverId,
  type AtlasLongTermMemoryDigest,
  type AtlasPresetId,
  buildAtlasDriverSummaries,
  DEFAULT_ATLAS_DRIVER_ORDER,
  normalizeAtlasDriverOrder,
  resolveAtlasPresetId,
} from "../utils/atlasContext";
import "./AtlasPanel.global.css";

type AtlasPanelProps = {
  filePanelMode: PanelTabId;
  onFilePanelModeChange: (mode: PanelTabId) => void;
  activeItems: ConversationItem[];
  activePlan: TurnPlan | null;
  activeTokenUsage: ThreadTokenUsage | null;
  activeThreadStatus: ThreadStatusSummary | null;
  activeTurnId: string | null;
  activeThreadId: string | null;
  enabled: boolean;
  detailLevel: AtlasDetailLevel;
  driverOrder: string[];
  longTermMemoryDigest: AtlasLongTermMemoryDigest | null;
  onEnabledChange: (enabled: boolean) => void;
  onDetailLevelChange: (detailLevel: AtlasDetailLevel) => void;
  onDriverOrderChange: (order: string[]) => void;
};

const DETAIL_LEVEL_LABELS: Record<AtlasDetailLevel, string> = {
  concise: "Concise",
  balanced: "Balanced",
  detailed: "Detailed",
};

export function AtlasPanel({
  filePanelMode,
  onFilePanelModeChange,
  activeItems,
  activePlan,
  activeTokenUsage,
  activeThreadStatus,
  activeTurnId,
  activeThreadId,
  enabled,
  detailLevel,
  driverOrder,
  longTermMemoryDigest,
  onEnabledChange,
  onDetailLevelChange,
  onDriverOrderChange,
}: AtlasPanelProps) {
  const [draggingId, setDraggingId] = useState<AtlasDriverId | null>(null);
  const [dropTargetId, setDropTargetId] = useState<AtlasDriverId | null>(null);
  const editable = Boolean(activeThreadId);

  const normalizedOrder = useMemo(() => normalizeAtlasDriverOrder(driverOrder), [driverOrder]);
  const activePresetId = useMemo(() => resolveAtlasPresetId(normalizedOrder), [normalizedOrder]);

  const summaries = useMemo(
    () =>
      buildAtlasDriverSummaries({
        order: normalizedOrder,
        items: activeItems,
        plan: activePlan,
        tokenUsage: activeTokenUsage,
        threadStatus: activeThreadStatus,
        activeTurnId,
        detailLevel,
        longTermMemoryDigest,
      }),
    [
      activeItems,
      activePlan,
      activeTokenUsage,
      activeThreadStatus,
      activeTurnId,
      detailLevel,
      longTermMemoryDigest,
      normalizedOrder,
    ]
  );

  const moveDriver = (id: AtlasDriverId, direction: -1 | 1) => {
    if (!editable) {
      return;
    }
    const current = normalizeAtlasDriverOrder(normalizedOrder);
    const index = current.indexOf(id);
    if (index < 0) {
      return;
    }
    const nextIndex = index + direction;
    if (nextIndex < 0 || nextIndex >= current.length) {
      return;
    }
    const [entry] = current.splice(index, 1);
    current.splice(nextIndex, 0, entry);
    onDriverOrderChange(current);
  };

  const handleDragStart = (event: DragEvent<HTMLDivElement>, id: AtlasDriverId) => {
    if (!editable) {
      return;
    }
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", id);
    setDraggingId(id);
  };

  const handleDragOver = (event: DragEvent<HTMLDivElement>, id: AtlasDriverId) => {
    if (!editable) {
      return;
    }
    event.preventDefault();
    if (dropTargetId !== id) {
      setDropTargetId(id);
    }
  };

  const handleDrop = (event: DragEvent<HTMLDivElement>, targetId: AtlasDriverId) => {
    if (!editable) {
      return;
    }
    event.preventDefault();
    const sourceId = event.dataTransfer.getData("text/plain") as AtlasDriverId;
    const next = reorderDriverOrder(normalizedOrder, sourceId, targetId);
    if (next) {
      onDriverOrderChange(next);
    }
    setDraggingId(null);
    setDropTargetId(null);
  };

  const handleDragEnd = () => {
    setDraggingId(null);
    setDropTargetId(null);
  };
  const handleEnabledChange = (nextEnabled: boolean) => {
    if (!editable) {
      return;
    }
    onEnabledChange(nextEnabled);
  };
  const handleDetailLevelChange = (nextDetailLevel: AtlasDetailLevel) => {
    if (!editable) {
      return;
    }
    onDetailLevelChange(nextDetailLevel);
  };
  const applyOrderAndEnable = (nextOrder: readonly string[]) => {
    if (!editable) {
      return;
    }
    const normalizedNextOrder = normalizeAtlasDriverOrder(nextOrder);
    if (!isSameDriverOrder(normalizedOrder, normalizedNextOrder)) {
      onDriverOrderChange(normalizedNextOrder);
    }
    if (!enabled) {
      onEnabledChange(true);
    }
  };
  const handlePresetClick = (presetId: AtlasPresetId) => {
    if (!editable) {
      return;
    }
    const preset = ATLAS_DRIVER_PRESETS.find((candidate) => candidate.id === presetId);
    if (!preset) {
      return;
    }
    if (activePresetId === presetId && enabled) {
      return;
    }
    applyOrderAndEnable(preset.order);
  };
  const handleResetDefault = () => {
    if (!editable) {
      return;
    }
    if (isSameDriverOrder(normalizedOrder, DEFAULT_ATLAS_DRIVER_ORDER) && enabled) {
      return;
    }
    applyOrderAndEnable(DEFAULT_ATLAS_DRIVER_ORDER);
  };

  return (
    <PanelFrame className="atlas-panel">
      <PanelHeader className="git-panel-header">
        <PanelTabs active={filePanelMode} onSelect={onFilePanelModeChange} />
        <PanelMeta className="atlas-panel-meta">
          <span className="atlas-panel-meta-text">
            {editable
              ? "Drag to reorder context priorities"
              : "Select a thread to customize priorities"}
          </span>
          <Checkbox
            label="Inject context"
            className="atlas-panel-toggle"
            inputClassName="atlas-panel-toggle-input"
            labelClassName="atlas-panel-toggle-label"
            checked={enabled}
            disabled={!editable}
            onCheckedChange={handleEnabledChange}
          />
        </PanelMeta>
      </PanelHeader>
      <div className="atlas-panel-scroll">
        <div className="atlas-panel-presets" role="toolbar" aria-label="Atlas presets">
          <div className="atlas-panel-preset-group">
            {ATLAS_DRIVER_PRESETS.map((preset) => {
              const selected = activePresetId === preset.id;
              return (
                <button
                  key={preset.id}
                  type="button"
                  className={`atlas-panel-preset${selected ? " is-active" : ""}`}
                  onClick={() => handlePresetClick(preset.id)}
                  disabled={!editable}
                  aria-pressed={selected}
                  title={preset.description}
                >
                  {preset.label}
                </button>
              );
            })}
          </div>
          <div className="atlas-panel-detail-group">
            {ATLAS_DETAIL_LEVELS.map((level) => {
              const selected = level === detailLevel;
              return (
                <button
                  key={level}
                  type="button"
                  className={`atlas-panel-detail${selected ? " is-active" : ""}`}
                  onClick={() => handleDetailLevelChange(level)}
                  disabled={!editable}
                  aria-pressed={selected}
                >
                  {DETAIL_LEVEL_LABELS[level]}
                </button>
              );
            })}
          </div>
          <button
            type="button"
            className="atlas-panel-reset"
            onClick={handleResetDefault}
            disabled={!editable}
          >
            Reset Default
          </button>
        </div>
        {summaries.map((entry, index) => {
          const isDragging = draggingId === entry.id;
          const isDropTarget = dropTargetId === entry.id;
          return (
            /* oxlint-disable-next-line jsx-a11y/no-static-element-interactions -- drag-and-drop rows rely on pointer DnD semantics. */
            <div
              key={entry.id}
              className={`atlas-driver-row${editable ? " is-editable" : ""}${isDragging ? " is-dragging" : ""}${
                isDropTarget ? " is-drop-target" : ""
              }`}
              draggable={editable}
              onDragStart={(event) => handleDragStart(event, entry.id)}
              onDragOver={(event) => handleDragOver(event, entry.id)}
              onDrop={(event) => handleDrop(event, entry.id)}
              onDragEnd={handleDragEnd}
              data-driver-id={entry.id}
            >
              <div className="atlas-driver-header">
                <span className="atlas-driver-position" aria-hidden>
                  {index + 1}.
                </span>
                <span className="atlas-driver-title">{entry.label}</span>
                <span className="atlas-driver-controls">
                  <button
                    type="button"
                    className="atlas-driver-control"
                    aria-label={`Move ${entry.label} up`}
                    onClick={() => moveDriver(entry.id, -1)}
                    disabled={!editable || index === 0}
                  >
                    ↑
                  </button>
                  <button
                    type="button"
                    className="atlas-driver-control"
                    aria-label={`Move ${entry.label} down`}
                    onClick={() => moveDriver(entry.id, 1)}
                    disabled={!editable || index === summaries.length - 1}
                  >
                    ↓
                  </button>
                </span>
              </div>
              <div className="atlas-driver-summary">{entry.summary}</div>
            </div>
          );
        })}
        {summaries.length === 0 ? (
          <div className="atlas-panel-empty">No Atlas drivers available.</div>
        ) : null}
      </div>
    </PanelFrame>
  );
}

function reorderDriverOrder(
  order: readonly string[],
  sourceId: AtlasDriverId,
  targetId: AtlasDriverId
): AtlasDriverId[] | null {
  if (!sourceId || !targetId || sourceId === targetId) {
    return null;
  }
  const normalized = normalizeAtlasDriverOrder(order);
  const fromIndex = normalized.indexOf(sourceId);
  const toIndex = normalized.indexOf(targetId);
  if (fromIndex < 0 || toIndex < 0) {
    return null;
  }
  const next = [...normalized];
  const [entry] = next.splice(fromIndex, 1);
  const insertionIndex = fromIndex < toIndex ? toIndex - 1 : toIndex;
  next.splice(insertionIndex, 0, entry);
  return next;
}

function isSameDriverOrder(left: readonly string[], right: readonly string[]): boolean {
  if (left.length !== right.length) {
    return false;
  }
  for (let index = 0; index < left.length; index += 1) {
    if (left[index] !== right[index]) {
      return false;
    }
  }
  return true;
}
