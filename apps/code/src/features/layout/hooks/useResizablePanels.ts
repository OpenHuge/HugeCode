import type { MouseEvent as ReactMouseEvent } from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  readSafeLocalStorageItem,
  writeSafeLocalStorageItem,
} from "../../../utils/safeLocalStorage";

const STORAGE_KEY_SIDEBAR = "codexmonitor.sidebarWidth";
const STORAGE_KEY_RIGHT_PANEL = "codexmonitor.rightPanelWidth";
const STORAGE_KEY_PLAN_PANEL = "codexmonitor.planPanelHeight";
const STORAGE_KEY_TERMINAL_PANEL = "codexmonitor.terminalPanelHeight";
const STORAGE_KEY_DEBUG_PANEL = "codexmonitor.debugPanelHeight";
const LIVE_RIGHT_PANEL_WIDTH_VAR = "--right-panel-width-live";
const MIN_SIDEBAR_WIDTH = 220;
const MAX_SIDEBAR_WIDTH = 420;
const MIN_RIGHT_PANEL_WIDTH = 320;
const MAX_RIGHT_PANEL_WIDTH = 440;
const MIN_PLAN_PANEL_HEIGHT = 140;
const MAX_PLAN_PANEL_HEIGHT = 420;
const MIN_TERMINAL_PANEL_HEIGHT = 140;
const MAX_TERMINAL_PANEL_HEIGHT = 480;
const MIN_DEBUG_PANEL_HEIGHT = 120;
const MAX_DEBUG_PANEL_HEIGHT = 420;
const DEFAULT_SIDEBAR_WIDTH = 260;
const DEFAULT_RIGHT_PANEL_WIDTH = 360;
const DEFAULT_PLAN_PANEL_HEIGHT = 220;
const DEFAULT_TERMINAL_PANEL_HEIGHT = 220;
const DEFAULT_DEBUG_PANEL_HEIGHT = 180;

type ResizeState = {
  type: "sidebar" | "right-panel" | "plan-panel" | "terminal-panel" | "debug-panel";
  startX: number;
  startY: number;
  startWidth: number;
  startHeight: number;
};

type PendingResizeUpdates = Partial<{
  sidebarWidth: number;
  rightPanelWidth: number;
  planPanelHeight: number;
  terminalPanelHeight: number;
  debugPanelHeight: number;
}>;

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function readStoredWidth(key: string, fallback: number, min: number, max: number) {
  const safeFallback = clamp(fallback, min, max);
  if (typeof window === "undefined") {
    return safeFallback;
  }
  const raw = readSafeLocalStorageItem(key);
  if (!raw) {
    return safeFallback;
  }
  const parsed = Number(raw);
  if (!Number.isFinite(parsed)) {
    return safeFallback;
  }
  return clamp(parsed, min, max);
}

export function useResizablePanels() {
  const [sidebarWidth, setSidebarWidth] = useState(() =>
    readStoredWidth(
      STORAGE_KEY_SIDEBAR,
      DEFAULT_SIDEBAR_WIDTH,
      MIN_SIDEBAR_WIDTH,
      MAX_SIDEBAR_WIDTH
    )
  );
  const [rightPanelWidth, setRightPanelWidth] = useState(() =>
    readStoredWidth(
      STORAGE_KEY_RIGHT_PANEL,
      DEFAULT_RIGHT_PANEL_WIDTH,
      MIN_RIGHT_PANEL_WIDTH,
      MAX_RIGHT_PANEL_WIDTH
    )
  );
  const [planPanelHeight, setPlanPanelHeight] = useState(() =>
    readStoredWidth(
      STORAGE_KEY_PLAN_PANEL,
      DEFAULT_PLAN_PANEL_HEIGHT,
      MIN_PLAN_PANEL_HEIGHT,
      MAX_PLAN_PANEL_HEIGHT
    )
  );
  const [terminalPanelHeight, setTerminalPanelHeight] = useState(() =>
    readStoredWidth(
      STORAGE_KEY_TERMINAL_PANEL,
      DEFAULT_TERMINAL_PANEL_HEIGHT,
      MIN_TERMINAL_PANEL_HEIGHT,
      MAX_TERMINAL_PANEL_HEIGHT
    )
  );
  const [debugPanelHeight, setDebugPanelHeight] = useState(() =>
    readStoredWidth(
      STORAGE_KEY_DEBUG_PANEL,
      DEFAULT_DEBUG_PANEL_HEIGHT,
      MIN_DEBUG_PANEL_HEIGHT,
      MAX_DEBUG_PANEL_HEIGHT
    )
  );
  const resizeRef = useRef<ResizeState | null>(null);
  const sidebarWidthRef = useRef(sidebarWidth);
  const rightPanelWidthRef = useRef(rightPanelWidth);
  const planPanelHeightRef = useRef(planPanelHeight);
  const terminalPanelHeightRef = useRef(terminalPanelHeight);
  const debugPanelHeightRef = useRef(debugPanelHeight);
  const pendingResizeUpdatesRef = useRef<PendingResizeUpdates>({});
  const resizeAnimationFrameRef = useRef<number | null>(null);
  const rightPanelLiveWidthRef = useRef<number | null>(null);

  const clearLiveRightPanelWidth = useCallback(() => {
    if (typeof document === "undefined") {
      return;
    }
    document.documentElement.style.removeProperty(LIVE_RIGHT_PANEL_WIDTH_VAR);
    rightPanelLiveWidthRef.current = null;
  }, []);

  const setLiveRightPanelWidth = useCallback((value: number) => {
    if (typeof document === "undefined") {
      return;
    }
    if (rightPanelLiveWidthRef.current === value) {
      return;
    }
    rightPanelLiveWidthRef.current = value;
    document.documentElement.style.setProperty(LIVE_RIGHT_PANEL_WIDTH_VAR, `${value}px`);
  }, []);

  const applyPendingResizeUpdates = useCallback(() => {
    const pending = pendingResizeUpdatesRef.current;
    pendingResizeUpdatesRef.current = {};

    if (pending.sidebarWidth !== undefined && pending.sidebarWidth !== sidebarWidthRef.current) {
      sidebarWidthRef.current = pending.sidebarWidth;
      setSidebarWidth(pending.sidebarWidth);
    }
    if (
      pending.rightPanelWidth !== undefined &&
      pending.rightPanelWidth !== rightPanelWidthRef.current
    ) {
      rightPanelWidthRef.current = pending.rightPanelWidth;
      setRightPanelWidth(pending.rightPanelWidth);
    }
    if (
      pending.planPanelHeight !== undefined &&
      pending.planPanelHeight !== planPanelHeightRef.current
    ) {
      planPanelHeightRef.current = pending.planPanelHeight;
      setPlanPanelHeight(pending.planPanelHeight);
    }
    if (
      pending.terminalPanelHeight !== undefined &&
      pending.terminalPanelHeight !== terminalPanelHeightRef.current
    ) {
      terminalPanelHeightRef.current = pending.terminalPanelHeight;
      setTerminalPanelHeight(pending.terminalPanelHeight);
    }
    if (
      pending.debugPanelHeight !== undefined &&
      pending.debugPanelHeight !== debugPanelHeightRef.current
    ) {
      debugPanelHeightRef.current = pending.debugPanelHeight;
      setDebugPanelHeight(pending.debugPanelHeight);
    }
  }, []);

  const flushPendingResizeUpdates = useCallback(() => {
    if (resizeAnimationFrameRef.current !== null) {
      window.cancelAnimationFrame(resizeAnimationFrameRef.current);
      resizeAnimationFrameRef.current = null;
    }
    applyPendingResizeUpdates();
  }, [applyPendingResizeUpdates]);

  const queueResizeUpdate = useCallback(
    (key: keyof PendingResizeUpdates, value: number) => {
      pendingResizeUpdatesRef.current[key] = value;
      if (resizeAnimationFrameRef.current !== null) {
        return;
      }
      resizeAnimationFrameRef.current = window.requestAnimationFrame(() => {
        resizeAnimationFrameRef.current = null;
        applyPendingResizeUpdates();
      });
    },
    [applyPendingResizeUpdates]
  );

  const persistResizeValue = useCallback((type: ResizeState["type"]) => {
    if (type === "sidebar") {
      writeSafeLocalStorageItem(STORAGE_KEY_SIDEBAR, String(sidebarWidthRef.current));
      return;
    }
    if (type === "right-panel") {
      writeSafeLocalStorageItem(STORAGE_KEY_RIGHT_PANEL, String(rightPanelWidthRef.current));
      return;
    }
    if (type === "plan-panel") {
      writeSafeLocalStorageItem(STORAGE_KEY_PLAN_PANEL, String(planPanelHeightRef.current));
      return;
    }
    if (type === "terminal-panel") {
      writeSafeLocalStorageItem(STORAGE_KEY_TERMINAL_PANEL, String(terminalPanelHeightRef.current));
      return;
    }
    writeSafeLocalStorageItem(STORAGE_KEY_DEBUG_PANEL, String(debugPanelHeightRef.current));
  }, []);

  useEffect(() => {
    sidebarWidthRef.current = sidebarWidth;
  }, [sidebarWidth]);

  useEffect(() => {
    rightPanelWidthRef.current = rightPanelWidth;
  }, [rightPanelWidth]);

  useEffect(() => {
    planPanelHeightRef.current = planPanelHeight;
  }, [planPanelHeight]);

  useEffect(() => {
    terminalPanelHeightRef.current = terminalPanelHeight;
  }, [terminalPanelHeight]);

  useEffect(() => {
    debugPanelHeightRef.current = debugPanelHeight;
  }, [debugPanelHeight]);

  useEffect(() => {
    function handleMouseMove(event: MouseEvent) {
      if (!resizeRef.current) {
        return;
      }
      if (resizeRef.current.type === "sidebar") {
        const delta = event.clientX - resizeRef.current.startX;
        const next = clamp(
          resizeRef.current.startWidth + delta,
          MIN_SIDEBAR_WIDTH,
          MAX_SIDEBAR_WIDTH
        );
        queueResizeUpdate("sidebarWidth", next);
      } else if (resizeRef.current.type === "right-panel") {
        const delta = event.clientX - resizeRef.current.startX;
        const next = clamp(
          resizeRef.current.startWidth - delta,
          MIN_RIGHT_PANEL_WIDTH,
          MAX_RIGHT_PANEL_WIDTH
        );
        setLiveRightPanelWidth(next);
      } else if (resizeRef.current.type === "plan-panel") {
        const delta = event.clientY - resizeRef.current.startY;
        const next = clamp(
          resizeRef.current.startHeight - delta,
          MIN_PLAN_PANEL_HEIGHT,
          MAX_PLAN_PANEL_HEIGHT
        );
        queueResizeUpdate("planPanelHeight", next);
      } else if (resizeRef.current.type === "terminal-panel") {
        const delta = event.clientY - resizeRef.current.startY;
        const next = clamp(
          resizeRef.current.startHeight - delta,
          MIN_TERMINAL_PANEL_HEIGHT,
          MAX_TERMINAL_PANEL_HEIGHT
        );
        queueResizeUpdate("terminalPanelHeight", next);
      } else {
        const delta = event.clientY - resizeRef.current.startY;
        const next = clamp(
          resizeRef.current.startHeight - delta,
          MIN_DEBUG_PANEL_HEIGHT,
          MAX_DEBUG_PANEL_HEIGHT
        );
        queueResizeUpdate("debugPanelHeight", next);
      }
    }

    function handleMouseUp() {
      const currentResizeState = resizeRef.current;
      if (!currentResizeState) {
        return;
      }
      flushPendingResizeUpdates();
      if (currentResizeState.type === "right-panel") {
        const next = rightPanelLiveWidthRef.current;
        if (next !== null && next !== rightPanelWidthRef.current) {
          rightPanelWidthRef.current = next;
          setRightPanelWidth(next);
        }
        clearLiveRightPanelWidth();
      }
      persistResizeValue(currentResizeState.type);
      resizeRef.current = null;
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
      delete document.body.dataset.resizing;
    }

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
    window.addEventListener("blur", handleMouseUp);
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
      window.removeEventListener("blur", handleMouseUp);
      if (resizeAnimationFrameRef.current !== null) {
        window.cancelAnimationFrame(resizeAnimationFrameRef.current);
        resizeAnimationFrameRef.current = null;
      }
      pendingResizeUpdatesRef.current = {};
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
      delete document.body.dataset.resizing;
      clearLiveRightPanelWidth();
    };
  }, [
    clearLiveRightPanelWidth,
    flushPendingResizeUpdates,
    persistResizeValue,
    queueResizeUpdate,
    setLiveRightPanelWidth,
  ]);

  const onSidebarResizeStart = useCallback((event: ReactMouseEvent) => {
    resizeRef.current = {
      type: "sidebar",
      startX: event.clientX,
      startY: event.clientY,
      startWidth: sidebarWidthRef.current,
      startHeight: planPanelHeightRef.current,
    };
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
    document.body.dataset.resizing = "sidebar";
  }, []);

  const onRightPanelResizeStart = useCallback(
    (event: ReactMouseEvent) => {
      clearLiveRightPanelWidth();
      resizeRef.current = {
        type: "right-panel",
        startX: event.clientX,
        startY: event.clientY,
        startWidth: rightPanelWidthRef.current,
        startHeight: planPanelHeightRef.current,
      };
      document.body.style.cursor = "col-resize";
      document.body.style.userSelect = "none";
      document.body.dataset.resizing = "right-panel";
    },
    [clearLiveRightPanelWidth]
  );

  const onPlanPanelResizeStart = useCallback((event: ReactMouseEvent) => {
    resizeRef.current = {
      type: "plan-panel",
      startX: event.clientX,
      startY: event.clientY,
      startWidth: rightPanelWidthRef.current,
      startHeight: planPanelHeightRef.current,
    };
    document.body.style.cursor = "row-resize";
    document.body.style.userSelect = "none";
    document.body.dataset.resizing = "plan-panel";
  }, []);

  const onTerminalPanelResizeStart = useCallback((event: ReactMouseEvent) => {
    resizeRef.current = {
      type: "terminal-panel",
      startX: event.clientX,
      startY: event.clientY,
      startWidth: rightPanelWidthRef.current,
      startHeight: terminalPanelHeightRef.current,
    };
    document.body.style.cursor = "row-resize";
    document.body.style.userSelect = "none";
    document.body.dataset.resizing = "terminal-panel";
  }, []);

  const onDebugPanelResizeStart = useCallback((event: ReactMouseEvent) => {
    resizeRef.current = {
      type: "debug-panel",
      startX: event.clientX,
      startY: event.clientY,
      startWidth: rightPanelWidthRef.current,
      startHeight: debugPanelHeightRef.current,
    };
    document.body.style.cursor = "row-resize";
    document.body.style.userSelect = "none";
    document.body.dataset.resizing = "debug-panel";
  }, []);

  return {
    sidebarWidth,
    rightPanelWidth,
    planPanelHeight,
    terminalPanelHeight,
    debugPanelHeight,
    onSidebarResizeStart,
    onRightPanelResizeStart,
    onPlanPanelResizeStart,
    onTerminalPanelResizeStart,
    onDebugPanelResizeStart,
  };
}
