import type { ComponentType } from "react";
import type { SettingsViewProps } from "./SettingsView";

type SettingsViewModule = {
  SettingsView: ComponentType<SettingsViewProps>;
};

let settingsViewModulePromise: Promise<{
  default: SettingsViewModule["SettingsView"];
}> | null = null;

export function loadSettingsView() {
  settingsViewModulePromise ??= import("./SettingsView").then((module) => ({
    default: module.SettingsView,
  }));
  return settingsViewModulePromise;
}

export function preloadSettingsView() {
  return loadSettingsView();
}
