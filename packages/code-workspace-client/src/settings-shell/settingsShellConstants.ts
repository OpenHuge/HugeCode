import type { CodexSection } from "./settingsShellTypes";

export const SETTINGS_SECTION_LABELS: Record<CodexSection, string> = {
  projects: "Projects",
  environments: "Environments",
  display: "Display & Sound",
  composer: "Composer",
  shortcuts: "Shortcuts",
  "open-apps": "Open in",
  git: "Git",
  server: "Server",
  codex: "Codex",
  features: "Features",
};

export const PRIMARY_SETTINGS_SECTIONS = [
  "projects",
  "display",
  "composer",
  "shortcuts",
  "git",
  "server",
  "codex",
] as const satisfies ReadonlyArray<CodexSection>;

export const ADVANCED_SETTINGS_SECTIONS = [
  "environments",
  "open-apps",
] as const satisfies ReadonlyArray<CodexSection>;

export const INTERNAL_SETTINGS_SECTIONS = [
  "features",
] as const satisfies ReadonlyArray<CodexSection>;
