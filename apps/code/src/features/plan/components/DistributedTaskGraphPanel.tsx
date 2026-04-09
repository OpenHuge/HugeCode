import { useVirtualizer } from "@tanstack/react-virtual";
import SlidersHorizontal from "lucide-react/dist/esm/icons/sliders-horizontal";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  collectDistributedTaskGraphNodeDependencies,
  type DistributedTaskGraphNode,
  type DistributedTaskGraphSnapshot,
  groupDistributedTaskGraphNodesByBackend,
} from "../../../application/runtime/types/distributedTaskGraph";
import { Button, StatusBadge } from "../../../design-system";
import { joinClassNames } from "../../../utils/classNames";
import {
  InspectorSectionBody,
  InspectorSectionGroup,
  InspectorSectionHeader,
  RightPanelEmptyState,
} from "../../right-panel/RightPanelPrimitives";
import * as styles from "./DistributedTaskGraphPanel.css";
import { DistributedControlDrawer } from "./DistributedControlDrawer";
import {
  getDistributedTaskGraphStatusLabel,
  getDistributedTaskGraphStatusTone,
} from "./distributedTaskGraphStatus";

type DistributedTaskGraphPanelProps = {
  graph: DistributedTaskGraphSnapshot | null;
  capabilityEnabled: boolean;
  actionsEnabled?: boolean;
  retryEnabled?: boolean;
  disabledReason?: string | null;
  diagnosticsMessage?: string | null;
  onRetryNode?: (nodeId: string) => Promise<void>;
  onInterruptNode?: (nodeId: string) => Promise<void>;
  onInterruptSubtree?: (nodeId: string) => Promise<void>;
  onForceReroute?: (nodeId: string) => Promise<void>;
};

type GraphRow =
  | { kind: "group"; key: string; label: string; count: number }
  | { kind: "node"; key: string; node: DistributedTaskGraphNode };

function buildRows(graph: DistributedTaskGraphSnapshot | null): GraphRow[] {
  if (!graph) {
    return [];
  }
  const rows: GraphRow[] = [];
  const groups = groupDistributedTaskGraphNodesByBackend(graph.nodes);
  for (const group of groups) {
    rows.push({
      kind: "group",
      key: `group-${group.id}`,
      label: group.label,
      count: group.nodes.length,
    });
    for (const node of group.nodes) {
      rows.push({ kind: "node", key: `node-${node.id}`, node });
    }
  }
  return rows;
}

function syncVirtualRowOffset(node: HTMLDivElement | null, yOffset?: number) {
  if (!node) {
    return;
  }
  if (yOffset === undefined) {
    node.style.removeProperty("--distributed-task-graph-row-offset");
    return;
  }
  node.style.setProperty("--distributed-task-graph-row-offset", `${yOffset}px`);
}

export function DistributedTaskGraphPanel({
  graph,
  capabilityEnabled,
  actionsEnabled = false,
  retryEnabled = false,
  disabledReason = null,
  diagnosticsMessage = null,
  onRetryNode,
  onInterruptNode,
  onInterruptSubtree,
  onForceReroute,
}: DistributedTaskGraphPanelProps) {
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const virtualContainerRef = useRef<HTMLDivElement | null>(null);
  const [selectedNode, setSelectedNode] = useState<DistributedTaskGraphNode | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const rows = useMemo(() => buildRows(graph), [graph]);
  const hasRows = rows.length > 0;
  const largeGraph = rows.length > 60;

  const rowVirtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: (index) => {
      const row = rows[index];
      return row?.kind === "group" ? 30 : 40;
    },
    overscan: 10,
  });
  const virtualHeight = rowVirtualizer.getTotalSize();

  useEffect(() => {
    if (!virtualContainerRef.current) {
      return;
    }
    virtualContainerRef.current.style.setProperty(
      "--distributed-task-graph-virtual-height",
      `${virtualHeight}px`
    );
  }, [virtualHeight]);

  if (!capabilityEnabled) {
    return null;
  }

  const summary = graph?.summary;
  const totalNodes = summary?.totalNodes ?? graph?.nodes.length ?? 0;
  const runningNodes =
    summary?.runningNodes ?? graph?.nodes.filter((node) => node.status === "running").length ?? 0;
  const failedNodes =
    summary?.failedNodes ?? graph?.nodes.filter((node) => node.status === "failed").length ?? 0;

  const renderRow = (row: GraphRow, yOffset?: number) => {
    if (row.kind === "group") {
      return (
        <div
          key={row.key}
          ref={(node) => {
            syncVirtualRowOffset(node, yOffset);
          }}
          className={joinClassNames(
            styles.groupRowBase,
            yOffset === undefined ? undefined : styles.absoluteRow
          )}
        >
          <span>{row.label}</span>
          <span>{row.count}</span>
        </div>
      );
    }

    const dependencies = collectDistributedTaskGraphNodeDependencies(row.node);

    return (
      <div
        key={row.key}
        ref={(node) => {
          syncVirtualRowOffset(node, yOffset);
        }}
        className={joinClassNames(
          styles.nodeRowBase,
          yOffset === undefined ? undefined : styles.absoluteRow
        )}
      >
        <div className={styles.nodeMain}>
          <div className={styles.nodeTitle}>{row.node.title}</div>
          <div className={styles.nodeMeta}>
            <StatusBadge tone={getDistributedTaskGraphStatusTone(row.node.status)}>
              {getDistributedTaskGraphStatusLabel(row.node.status)}
            </StatusBadge>
            <span className={styles.metaToken}>
              {row.node.backendLabel ?? row.node.backendId ?? "unassigned"}
            </span>
            {row.node.queueDepth !== null && row.node.queueDepth !== undefined ? (
              <span className={styles.metaToken}>Queue {row.node.queueDepth}</span>
            ) : null}
            {dependencies.length > 0 ? (
              <span className={styles.metaToken}>Depends {dependencies.length}</span>
            ) : null}
          </div>
        </div>
        <Button
          variant="ghost"
          size="sm"
          className={styles.nodeControl}
          aria-label={`Open controls for ${row.node.title}`}
          onClick={() => {
            setSelectedNode(row.node);
            setDrawerOpen(true);
          }}
        >
          <SlidersHorizontal size={14} aria-hidden />
        </Button>
      </div>
    );
  };

  return (
    <InspectorSectionGroup data-testid="distributed-task-graph-panel">
      <InspectorSectionHeader
        title="Distributed Task Graph"
        subtitle="Runtime-level task placement grouped by backend."
        actions={
          <div className={styles.summaryActions}>
            <StatusBadge>Total {totalNodes}</StatusBadge>
            <StatusBadge tone={runningNodes > 0 ? "progress" : "default"}>
              Running {runningNodes}
            </StatusBadge>
            <StatusBadge tone={failedNodes > 0 ? "error" : "default"}>
              Failed {failedNodes}
            </StatusBadge>
          </div>
        }
      />
      <InspectorSectionBody>
        {largeGraph ? (
          <div className={styles.hint} data-testid="distributed-task-graph-virtualized-hint">
            Large graph detected. Virtualized grouped list is active.
          </div>
        ) : null}
        {diagnosticsMessage ? (
          <div className={styles.warning} data-testid="distributed-task-graph-warning">
            {diagnosticsMessage}
          </div>
        ) : null}

        {!hasRows ? (
          <RightPanelEmptyState
            title="No distributed task graph"
            body="No distributed subtask graph available yet."
          />
        ) : (
          <div
            ref={scrollRef}
            className={joinClassNames(
              styles.listShell,
              largeGraph ? styles.largeList : styles.compactList
            )}
          >
            {largeGraph ? (
              <div ref={virtualContainerRef} className={styles.virtualList}>
                {rowVirtualizer.getVirtualItems().map((virtualRow) => {
                  const row = rows[virtualRow.index];
                  if (!row) {
                    return null;
                  }
                  return renderRow(row, virtualRow.start);
                })}
              </div>
            ) : (
              <div className={styles.staticList}>{rows.map((row) => renderRow(row))}</div>
            )}
          </div>
        )}

        <DistributedControlDrawer
          node={selectedNode}
          isOpen={drawerOpen}
          actionsEnabled={actionsEnabled}
          disabledReason={disabledReason}
          onClose={() => {
            setDrawerOpen(false);
          }}
          onRetryNode={retryEnabled ? onRetryNode : undefined}
          onInterruptNode={onInterruptNode}
          onInterruptSubtree={onInterruptSubtree}
          onForceReroute={onForceReroute}
        />
      </InspectorSectionBody>
    </InspectorSectionGroup>
  );
}
