export const SHELL_TABS = ["home", "workspaces", "missions", "review", "settings"] as const;

export type AppTab = (typeof SHELL_TABS)[number] | "codex";

export const SHELL_TAB_LABELS: Record<AppTab, string> = {
  codex: "Codex",
  home: "Home",
  workspaces: "Workspaces",
  missions: "Missions",
  review: "Review",
  settings: "Settings",
};
