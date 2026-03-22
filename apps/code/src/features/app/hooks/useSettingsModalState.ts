import { useCallback, useState } from "react";
import { preloadSettingsView } from "../../settings/components/settingsViewLoader";
import type { CodexSection } from "../../settings/components/settingsTypes";

export type SettingsSection = CodexSection;

const SETTINGS_SECTION_VALUES: ReadonlySet<SettingsSection> = new Set<SettingsSection>([
  "projects",
  "environments",
  "display",
  "composer",
  "shortcuts",
  "open-apps",
  "git",
  "server",
  "codex",
  "features",
]);

function normalizeSettingsSection(section: unknown): SettingsSection | null {
  if (typeof section !== "string") {
    return null;
  }
  return SETTINGS_SECTION_VALUES.has(section as SettingsSection)
    ? (section as SettingsSection)
    : null;
}

export function useSettingsModalState() {
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settingsSection, setSettingsSection] = useState<SettingsSection | null>(null);

  const openSettings = useCallback((section?: SettingsSection) => {
    const normalizedSection = normalizeSettingsSection(section);
    void preloadSettingsView();
    setSettingsSection((currentSection) => normalizedSection ?? currentSection ?? null);
    setSettingsOpen(true);
  }, []);

  const closeSettings = useCallback(() => {
    setSettingsOpen(false);
    setSettingsSection(null);
  }, []);

  return {
    settingsOpen,
    settingsSection,
    openSettings,
    closeSettings,
    setSettingsOpen,
    setSettingsSection,
  };
}
