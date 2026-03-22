import { useCallback, useEffect, useState } from "react";
import {
  readSafeLocalStorageItem,
  removeSafeLocalStorageItem,
  writeSafeLocalStorageItem,
} from "../../../utils/safeLocalStorage";

const SIDEBAR_COLLAPSED_KEY = "codexmonitor.sidebarCollapsed";
const RIGHT_RAIL_COLLAPSED_KEY = "codexmonitor.rightRailCollapsed";
const LEGACY_CONTEXT_RAIL_COLLAPSED_KEY = "codexmonitor.contextRailCollapsed";
const LEGACY_RIGHT_PANEL_COLLAPSED_KEY = "codexmonitor.rightPanelCollapsed";

type UseSidebarTogglesOptions = {
  isCompact: boolean;
};

function readStoredBool(key: string, fallback = false) {
  if (typeof window === "undefined") {
    return fallback;
  }
  const value = readSafeLocalStorageItem(key);
  if (value == null) {
    return fallback;
  }
  return value === "true";
}

function readStoredBoolWithLegacyFallback(primaryKey: string, legacyKey: string, fallback = false) {
  if (typeof window === "undefined") {
    return fallback;
  }
  const primaryValue = readSafeLocalStorageItem(primaryKey);
  if (primaryValue != null) {
    return primaryValue === "true";
  }
  const legacyValue = readSafeLocalStorageItem(legacyKey);
  if (legacyValue != null) {
    return legacyValue === "true";
  }
  return fallback;
}

export function useSidebarToggles({ isCompact }: UseSidebarTogglesOptions) {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() =>
    readStoredBool(SIDEBAR_COLLAPSED_KEY, false)
  );
  const [rightPanelCollapsed, setRightPanelCollapsed] = useState(() =>
    readStoredBoolWithLegacyFallback(
      RIGHT_RAIL_COLLAPSED_KEY,
      LEGACY_CONTEXT_RAIL_COLLAPSED_KEY,
      readStoredBool(LEGACY_RIGHT_PANEL_COLLAPSED_KEY, false)
    )
  );

  useEffect(() => {
    writeSafeLocalStorageItem(SIDEBAR_COLLAPSED_KEY, String(sidebarCollapsed));
  }, [sidebarCollapsed]);

  useEffect(() => {
    writeSafeLocalStorageItem(RIGHT_RAIL_COLLAPSED_KEY, String(rightPanelCollapsed));
    removeSafeLocalStorageItem(LEGACY_CONTEXT_RAIL_COLLAPSED_KEY);
    removeSafeLocalStorageItem(LEGACY_RIGHT_PANEL_COLLAPSED_KEY);
  }, [rightPanelCollapsed]);

  const allowCollapse = !isCompact;

  const collapseSidebar = useCallback(() => {
    if (allowCollapse) {
      setSidebarCollapsed(true);
    }
  }, [allowCollapse]);

  const expandSidebar = useCallback(() => {
    if (allowCollapse) {
      setSidebarCollapsed(false);
    }
  }, [allowCollapse]);

  const collapseRightPanel = useCallback(() => {
    if (!isCompact) {
      setRightPanelCollapsed(true);
    }
  }, [isCompact]);

  const expandRightPanel = useCallback(() => {
    if (!isCompact) {
      setRightPanelCollapsed(false);
    }
  }, [isCompact]);

  return {
    sidebarCollapsed,
    rightPanelCollapsed,
    collapseSidebar,
    expandSidebar,
    collapseRightPanel,
    expandRightPanel,
  };
}
