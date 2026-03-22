export type SettingsSection =
  | "projects"
  | "environments"
  | "display"
  | "composer"
  | "shortcuts"
  | "open-apps"
  | "git"
  | "server";

export type CodexSection = SettingsSection | "codex" | "features";

export type SettingsShellFraming = {
  kickerLabel: string;
  contextLabel: string;
  title: string;
  subtitle: string;
};
