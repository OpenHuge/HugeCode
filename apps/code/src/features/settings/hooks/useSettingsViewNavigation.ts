import { useCallback, useEffect, useState } from "react";
import type { CodexSection } from "../components/settingsTypes";
import { SETTINGS_MOBILE_BREAKPOINT_PX } from "../components/settingsViewConstants";
import { isNarrowSettingsViewport } from "../components/settingsViewHelpers";

type MediaQueryListCompat = {
  matches: boolean;
  addEventListener?: (type: "change", listener: () => void) => void;
  removeEventListener?: (type: "change", listener: () => void) => void;
  addListener?: (listener: () => void) => void;
  removeListener?: (listener: () => void) => void;
};

type UseSettingsViewNavigationParams = {
  initialSection?: CodexSection;
};

export const useSettingsViewNavigation = ({ initialSection }: UseSettingsViewNavigationParams) => {
  const [activeSection, setActiveSection] = useState<CodexSection>("projects");
  const [isNarrowViewport, setIsNarrowViewport] = useState(() => isNarrowSettingsViewport());
  const [showMobileDetail, setShowMobileDetail] = useState(Boolean(initialSection));

  useEffect(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
      return;
    }
    let query: MediaQueryListCompat | null = null;
    try {
      query = window.matchMedia(
        `(max-width: ${SETTINGS_MOBILE_BREAKPOINT_PX}px)`
      ) as MediaQueryListCompat | null;
    } catch {
      return;
    }
    if (!query || typeof query.matches !== "boolean") {
      return;
    }
    const applyViewportState = () => {
      setIsNarrowViewport(query.matches);
    };
    applyViewportState();
    const addEventListener = query.addEventListener;
    const removeEventListener = query.removeEventListener;
    if (typeof addEventListener === "function" && typeof removeEventListener === "function") {
      addEventListener.call(query, "change", applyViewportState);
      return () => {
        removeEventListener.call(query, "change", applyViewportState);
      };
    }
    const addListener = query.addListener;
    const removeListener = query.removeListener;
    if (typeof addListener === "function" && typeof removeListener === "function") {
      addListener.call(query, applyViewportState);
      return () => {
        removeListener.call(query, applyViewportState);
      };
    }
    return;
  }, []);

  const useMobileMasterDetail = isNarrowViewport;

  useEffect(() => {
    if (useMobileMasterDetail) {
      return;
    }
    setShowMobileDetail(false);
  }, [useMobileMasterDetail]);

  useEffect(() => {
    if (initialSection) {
      setActiveSection(initialSection);
      if (useMobileMasterDetail) {
        setShowMobileDetail(true);
      }
    }
  }, [initialSection, useMobileMasterDetail]);

  const handleSelectSection = useCallback(
    (section: CodexSection) => {
      setActiveSection(section);
      if (useMobileMasterDetail) {
        setShowMobileDetail(true);
      }
    },
    [useMobileMasterDetail]
  );

  return {
    activeSection,
    showMobileDetail,
    setShowMobileDetail,
    useMobileMasterDetail,
    handleSelectSection,
  };
};
