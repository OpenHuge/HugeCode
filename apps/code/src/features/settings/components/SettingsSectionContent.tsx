import { Suspense, lazy, type ComponentProps, type ReactNode } from "react";
import type { CodexSection } from "@ku0/code-workspace-client/settings-shell";
import type { SettingsComposerSection } from "./sections/SettingsComposerSection";
import type { SettingsDisplaySection } from "./sections/SettingsDisplaySection";
import type { SettingsEnvironmentsSection } from "./sections/SettingsEnvironmentsSection";
import type { SettingsFeaturesSection } from "./sections/SettingsFeaturesSection";
import type { SettingsGitSection } from "./sections/SettingsGitSection";
import type { SettingsOpenAppsSection } from "./sections/SettingsOpenAppsSection";
import type { SettingsProjectsSection } from "./sections/SettingsProjectsSection";
import type { SettingsShortcutsSection } from "./sections/SettingsShortcutsSection";
import { SettingsCodexSection } from "./sections/SettingsCodexSection";
import { SettingsServerSection } from "./sections/SettingsServerSection";

const LazySettingsComposerSection = lazy(async () => {
  const module = await import("./sections/SettingsComposerSection");
  return { default: module.SettingsComposerSection };
});

const LazySettingsDisplaySection = lazy(async () => {
  const module = await import("./sections/SettingsDisplaySection");
  return { default: module.SettingsDisplaySection };
});

const LazySettingsEnvironmentsSection = lazy(async () => {
  const module = await import("./sections/SettingsEnvironmentsSection");
  return { default: module.SettingsEnvironmentsSection };
});

const LazySettingsFeaturesSection = lazy(async () => {
  const module = await import("./sections/SettingsFeaturesSection");
  return { default: module.SettingsFeaturesSection };
});

const LazySettingsGitSection = lazy(async () => {
  const module = await import("./sections/SettingsGitSection");
  return { default: module.SettingsGitSection };
});

const LazySettingsOpenAppsSection = lazy(async () => {
  const module = await import("./sections/SettingsOpenAppsSection");
  return { default: module.SettingsOpenAppsSection };
});

const LazySettingsProjectsSection = lazy(async () => {
  const module = await import("./sections/SettingsProjectsSection");
  return { default: module.SettingsProjectsSection };
});

const LazySettingsShortcutsSection = lazy(async () => {
  const module = await import("./sections/SettingsShortcutsSection");
  return { default: module.SettingsShortcutsSection };
});

type SettingsSectionContentProps = {
  activeSection: CodexSection;
  projectsSectionProps: ComponentProps<typeof SettingsProjectsSection>;
  environmentsSectionProps: ComponentProps<typeof SettingsEnvironmentsSection>;
  displaySectionProps: ComponentProps<typeof SettingsDisplaySection>;
  composerSectionProps: ComponentProps<typeof SettingsComposerSection>;
  shortcutsSectionProps: ComponentProps<typeof SettingsShortcutsSection>;
  openAppsSectionProps: ComponentProps<typeof SettingsOpenAppsSection>;
  gitSectionProps: ComponentProps<typeof SettingsGitSection>;
  serverSectionProps: ComponentProps<typeof SettingsServerSection>;
  codexSectionProps: ComponentProps<typeof SettingsCodexSection>;
  featuresSectionProps: ComponentProps<typeof SettingsFeaturesSection>;
};

export function SettingsSectionContent({
  activeSection,
  projectsSectionProps,
  environmentsSectionProps,
  displaySectionProps,
  composerSectionProps,
  shortcutsSectionProps,
  openAppsSectionProps,
  gitSectionProps,
  serverSectionProps,
  codexSectionProps,
  featuresSectionProps,
}: SettingsSectionContentProps) {
  let sectionContent: ReactNode = null;

  switch (activeSection) {
    case "projects":
      sectionContent = <LazySettingsProjectsSection {...projectsSectionProps} />;
      break;
    case "environments":
      sectionContent = <LazySettingsEnvironmentsSection {...environmentsSectionProps} />;
      break;
    case "display":
      sectionContent = <LazySettingsDisplaySection {...displaySectionProps} />;
      break;
    case "composer":
      sectionContent = <LazySettingsComposerSection {...composerSectionProps} />;
      break;
    case "shortcuts":
      sectionContent = <LazySettingsShortcutsSection {...shortcutsSectionProps} />;
      break;
    case "open-apps":
      sectionContent = <LazySettingsOpenAppsSection {...openAppsSectionProps} />;
      break;
    case "git":
      sectionContent = <LazySettingsGitSection {...gitSectionProps} />;
      break;
    case "server":
      sectionContent = <SettingsServerSection {...serverSectionProps} />;
      break;
    case "codex":
      sectionContent = <SettingsCodexSection {...codexSectionProps} />;
      break;
    case "features":
      sectionContent = <LazySettingsFeaturesSection {...featuresSectionProps} />;
      break;
    default:
      sectionContent = null;
  }

  return <Suspense fallback={null}>{sectionContent}</Suspense>;
}
