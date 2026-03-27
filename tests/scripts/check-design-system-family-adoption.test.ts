import { spawnSync } from "node:child_process";
import { cp, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

const repoRoot = path.resolve(import.meta.dirname, "..", "..");
const tempRoots: string[] = [];
const requiredEntries = [
  "package.json",
  "scripts/check-design-system-family-adoption.mjs",
  "scripts/lib/design-system-family-contract-config.mjs",
];

const SELECT_FILES = [
  "apps/code/src/features/composer/components/ComposerMetaBarControls.tsx",
  "apps/code/src/features/home/components/Home.tsx",
  "apps/code/src/features/review/components/ReviewPackSurface.tsx",
  "apps/code/src/features/settings/components/sections/SettingsDisplaySection.tsx",
] as const;

const BUTTON_FILES = [
  "apps/code/src/features/home/components/Home.tsx",
  "apps/code/src/features/prompts/components/PromptPanel.tsx",
  "apps/code/src/features/composer/components/ComposerInput.tsx",
] as const;

const INPUT_FILES = [
  "apps/code/src/features/home/components/HomeRuntimeNotice.tsx",
  "apps/code/src/features/settings/components/sections/SettingsDisplaySection.tsx",
  "apps/code/src/features/app/components/LaunchScriptButton.tsx",
] as const;

const CHECKBOX_FILES = [
  "apps/code/src/features/debug/components/DebugRuntimeLiveSkillForm.tsx",
  "apps/code/src/features/composer/components/ComposerToolCallRequestPanel.tsx",
  "apps/code/src/features/atlas/components/AtlasPanel.tsx",
] as const;

const RADIO_GROUP_FILES = [
  "apps/code/src/features/app/components/RequestUserInputMessage.tsx",
] as const;

const POPOVER_FILES = [
  "apps/code/src/features/app/components/Sidebar.tsx",
  "apps/code/src/features/app/components/MainHeader.tsx",
  "apps/code/src/features/composer/components/ComposerInput.tsx",
  "apps/code/src/features/prompts/components/PromptPanel.tsx",
] as const;

const DIALOG_FILES = [
  "apps/code/src/features/app/components/AppModals.tsx",
  "apps/code/src/features/home/components/Home.tsx",
  "apps/code/src/features/workspaces/components/WorktreePrompt.tsx",
  "apps/code/src/features/mobile/components/MobileServerSetupWizard.tsx",
  "apps/code/src/features/settings/components/sections/settings-backend-pool/AcpBackendEditorDialog.tsx",
] as const;

const FIELD_FILES = [
  "packages/design-system/src/components/Input.tsx",
  "packages/design-system/src/components/Select.tsx",
  "packages/design-system/src/components/Textarea.tsx",
  "packages/design-system/src/components/Checkbox.tsx",
  "packages/design-system/src/components/Switch.tsx",
  "packages/design-system/src/components/RadioGroup.tsx",
] as const;

const TEXTAREA_FILES = [
  "apps/code/src/features/composer/components/ComposerInput.tsx",
  "apps/code/src/features/settings/components/sections/settings-backend-pool/AcpBackendEditorDialog.tsx",
  "apps/code/src/features/shared/components/FileEditorCard.tsx",
  "apps/code/src/features/git/components/GitDiffPanelModeContent.tsx",
] as const;

const ROWS_FILES = [
  "apps/code/src/features/design-system/components/DesignSystemClosureFixture.tsx",
  "apps/code/src/features/git/components/GitDiffPanel.tsx",
] as const;

const BADGE_FILES = [
  "apps/code/src/features/right-panel/RightPanelBlocks.tsx",
  "apps/code/src/features/autodrive/components/AutoDriveNavigationFixture.tsx",
  "apps/code/src/features/git/components/GitDiffViewer.tsx",
] as const;

const SECTION_HEADER_FILES = [
  "apps/code/src/features/home/components/HomeMissionLaunchpadSection.tsx",
  "apps/code/src/features/settings/components/sections/settings-codex-accounts-card/SettingsCodexAccountsSectionHeader.tsx",
  "apps/code/src/features/workspaces/components/WorkspaceHomeSubAgentObservabilityFixture.tsx",
] as const;

const TEXT_FILES = [
  "apps/code/src/features/settings/components/SettingsFormChromeFixture.tsx",
  "apps/code/src/features/settings/components/sections/settings-codex-accounts-card/SettingsCodexHealthTab.tsx",
  "apps/code/src/features/review/components/review-loop/ReviewLoopClosureFixture.tsx",
] as const;

const SWITCH_FILES = [
  "apps/code/src/features/settings/components/sections/SettingsFeaturesSection.tsx",
  "apps/code/src/features/settings/components/SettingsToggleControl.tsx",
] as const;

const STATUS_BADGE_FILES = [
  "apps/code/src/features/home/components/Home.tsx",
  "apps/code/src/features/settings/components/sections/SettingsAutomationSection.tsx",
] as const;

const SURFACE_FILES = [
  "apps/code/src/features/home/components/HomeMissionLaunchpadSection.tsx",
  "apps/code/src/features/composer/components/ComposerShell.tsx",
] as const;

async function copyRequiredEntries(targetRoot: string): Promise<void> {
  for (const relativePath of requiredEntries) {
    const sourcePath = path.join(repoRoot, relativePath);
    const targetPath = path.join(targetRoot, relativePath);

    await mkdir(path.dirname(targetPath), { recursive: true });
    await cp(sourcePath, targetPath, { recursive: true });
  }
}

async function writeAdoptionFixtureRepo(targetRoot: string): Promise<void> {
  const fileContents = new Map<string, string[]>();
  const appendLines = (relativePath: string, ...lines: string[]) => {
    const existing = fileContents.get(relativePath) ?? [];
    existing.push(...lines);
    fileContents.set(relativePath, existing);
  };

  for (const relativePath of SELECT_FILES) {
    appendLines(
      relativePath,
      'import { Select } from "../../../design-system";',
      'export function SelectFixture() { return <Select ariaLabel="Select workspace" />; }',
      ""
    );
  }

  for (const relativePath of BUTTON_FILES) {
    appendLines(
      relativePath,
      'import { Button } from "../../../design-system";',
      'export function ButtonFixture() { return <Button type="button">Run</Button>; }',
      ""
    );
  }

  for (const relativePath of INPUT_FILES) {
    appendLines(
      relativePath,
      'import { Input } from "../../../design-system";',
      'export function InputFixture() { return <Input aria-label="Workspace" />; }',
      ""
    );
  }

  for (const relativePath of CHECKBOX_FILES) {
    appendLines(
      relativePath,
      'import { Checkbox } from "../../../design-system";',
      'export function CheckboxFixture() { return <Checkbox label="Enable live supervision" />; }',
      ""
    );
  }

  for (const relativePath of RADIO_GROUP_FILES) {
    appendLines(
      relativePath,
      'import { RadioGroup } from "../../../design-system";',
      [
        "export function RadioGroupFixture() {",
        '  return <RadioGroup ariaLabel="Execution path" options={[{ value: "local", label: "Local" }, { value: "remote", label: "Remote" }]} value="remote" />;',
        "}",
        "",
      ].join("\n")
    );
  }

  for (const relativePath of POPOVER_FILES) {
    const includeMenuItem =
      relativePath.endsWith("Sidebar.tsx") || relativePath.endsWith("PromptPanel.tsx");
    appendLines(
      relativePath,
      'import { PopoverMenuItem, PopoverSurface } from "../../../design-system";',
      includeMenuItem
        ? "export function PopoverFixture() { return <PopoverSurface><PopoverMenuItem /></PopoverSurface>; }"
        : "export function PopoverFixture() { return <PopoverSurface />; }",
      ""
    );
  }

  for (const relativePath of DIALOG_FILES) {
    appendLines(
      relativePath,
      'import { ModalShell } from "../../../design-system";',
      [
        "export function DialogFixture() {",
        "  return <ModalShell open onClose={() => undefined} />;",
        "}",
        "",
      ].join("\n")
    );
  }

  for (const relativePath of TEXTAREA_FILES) {
    appendLines(
      relativePath,
      'import { Textarea } from "../../../design-system";',
      'export function TextareaFixture() { return <Textarea aria-label="Textarea fixture" />; }',
      ""
    );
  }

  for (const relativePath of ROWS_FILES) {
    appendLines(
      relativePath,
      'import { InlineActionRow, MetadataList, MetadataRow } from "../../../design-system";',
      [
        "export function RowsFixture() {",
        '  return <MetadataList><MetadataRow label="Status" value="Ready" /><InlineActionRow label="Open" /></MetadataList>;',
        "}",
        "",
      ].join("\n")
    );
  }

  for (const relativePath of BADGE_FILES) {
    appendLines(
      relativePath,
      'import { Badge } from "../../../design-system";',
      "export function BadgeFixture() { return <Badge>Review ready</Badge>; }",
      ""
    );
  }

  for (const relativePath of STATUS_BADGE_FILES) {
    appendLines(
      relativePath,
      'import { StatusBadge } from "../../../design-system";',
      'export function StatusBadgeFixture() { return <StatusBadge tone="progress">Syncing</StatusBadge>; }',
      ""
    );
  }

  for (const relativePath of SECTION_HEADER_FILES) {
    appendLines(
      relativePath,
      'import { SectionHeader } from "../../../design-system";',
      'export function SectionHeaderFixture() { return <SectionHeader title="Launch readiness" meta="Blocked" />; }',
      ""
    );
  }

  for (const relativePath of TEXT_FILES) {
    appendLines(
      relativePath,
      'import { Text } from "../../../design-system";',
      'export function TextFixture() { return <Text size="meta">Review ready</Text>; }',
      ""
    );
  }

  appendLines(
    "packages/ui/src/components/ListRow.stories.tsx",
    'import { ListRow } from "../index";',
    'export function ListRowFixture() { return <ListRow title="Review ready" description="Open the latest validation summary." />; }',
    ""
  );

  for (const relativePath of SWITCH_FILES) {
    appendLines(
      relativePath,
      'import { Switch } from "../../../design-system";',
      'export function SwitchFixture() { return <Switch label="Enable live supervision" checked onCheckedChange={() => undefined} />; }',
      ""
    );
  }

  appendLines(
    "apps/code/src/features/home/components/Home.tsx",
    'import { ShellFrame, ShellSection } from "../../../design-system";',
    [
      "export function ShellHomeFixture() {",
      '  return <ShellFrame><ShellSection title="Mission signals">Body</ShellSection></ShellFrame>;',
      "}",
      "",
    ].join("\n")
  );
  appendLines(
    "apps/code/src/features/home/components/HomeRecentMissionsSection.tsx",
    'import { EmptySurface } from "../../../design-system";',
    [
      "export function ShellEmptySurfaceFixture() {",
      '  return <EmptySurface title="No missions" />;',
      "}",
      "",
    ].join("\n")
  );
  appendLines(
    "apps/code/src/features/composer/components/ComposerShell.tsx",
    'import { ShellFrame, ShellToolbar } from "../../../design-system";',
    [
      "export function ShellComposerFixture() {",
      "  return <ShellFrame><ShellToolbar leading={<span>Scope</span>}>Filters</ShellToolbar></ShellFrame>;",
      "}",
      "",
    ].join("\n")
  );
  appendLines(
    "apps/code/src/features/settings/components/SettingsSectionGrammar.tsx",
    'import { ShellSection } from "../../../design-system";',
    [
      "export function ShellSettingsFixture() {",
      '  return <ShellSection title="Display">Body</ShellSection>;',
      "}",
      "",
    ].join("\n")
  );
  appendLines(
    "apps/code/src/features/app/components/SidebarScaffold.tsx",
    'import { ShellFrame } from "../../../design-system";',
    [
      "export function ShellSidebarFixture() {",
      "  return <ShellFrame>Sidebar shell</ShellFrame>;",
      "}",
      "",
    ].join("\n")
  );

  for (const relativePath of SURFACE_FILES) {
    appendLines(
      relativePath,
      'import { Surface } from "../../../design-system";',
      'export function SurfaceFixture() { return <Surface tone="translucent">Surface fixture</Surface>; }',
      ""
    );
  }

  for (const [relativePath, lines] of fileContents) {
    const targetPath = path.join(targetRoot, relativePath);
    await mkdir(path.dirname(targetPath), { recursive: true });
    await writeFile(targetPath, `${lines.join("\n")}\n`, "utf8");
  }

  const modalShellPath = path.join(
    targetRoot,
    "apps",
    "code",
    "src",
    "design-system",
    "components",
    "ModalShell.tsx"
  );
  await mkdir(path.dirname(modalShellPath), { recursive: true });
  await writeFile(
    modalShellPath,
    'import { Dialog } from "./modal/ModalPrimitives";\nexport function ModalShell() { return <Dialog open={true} onOpenChange={() => undefined} />; }\n',
    "utf8"
  );

  for (const relativePath of FIELD_FILES) {
    const targetPath = path.join(targetRoot, relativePath);
    await mkdir(path.dirname(targetPath), { recursive: true });
    await writeFile(
      targetPath,
      'import { Field } from "./Field";\nexport function Fixture() { return <Field label="Name" />; }\n',
      "utf8"
    );
  }
}

function runGuard(targetRoot: string) {
  return spawnSync(
    process.execPath,
    [
      path.join(targetRoot, "scripts", "check-design-system-family-adoption.mjs"),
      "--root",
      targetRoot,
    ],
    {
      cwd: targetRoot,
      encoding: "utf8",
    }
  );
}

describe("check-design-system-family-adoption", () => {
  afterEach(async () => {
    await Promise.all(
      tempRoots.map(async (rootPath) => {
        await rm(rootPath, { recursive: true, force: true });
      })
    );
    tempRoots.length = 0;
  });

  it("includes family adoption in the design-system baseline command", async () => {
    const packageJson = JSON.parse(await readFile(path.join(repoRoot, "package.json"), "utf8")) as {
      scripts?: Record<string, string>;
    };

    expect(packageJson.scripts?.["check:design-system:baseline"]).toContain(
      "check:design-system:family-adoption"
    );
  });

  it("passes when governed families have representative adoption evidence", async () => {
    const tempRoot = await mkdtemp(path.join(tmpdir(), "ds-family-adoption-"));
    tempRoots.push(tempRoot);
    await copyRequiredEntries(tempRoot);
    await writeAdoptionFixtureRepo(tempRoot);

    const result = runGuard(tempRoot);

    expect(result.status).toBe(0);
    expect(result.stdout).toContain("Design-system family adoption check passed.");
  });

  it("fails when Select loses one representative adoption surface", async () => {
    const tempRoot = await mkdtemp(path.join(tmpdir(), "ds-family-adoption-"));
    tempRoots.push(tempRoot);
    await copyRequiredEntries(tempRoot);
    await writeAdoptionFixtureRepo(tempRoot);

    await writeFile(
      path.join(
        tempRoot,
        "apps",
        "code",
        "src",
        "features",
        "review",
        "components",
        "ReviewPackSurface.tsx"
      ),
      'import { Select } from "../../../design-system";\nexport function Fixture() { return <div />; }\n',
      "utf8"
    );

    const result = runGuard(tempRoot);

    expect(result.status).toBe(1);
    expect(result.stderr).toContain("Select");
    expect(result.stderr).toContain("ReviewPackSurface.tsx");
  });

  it("fails when Popover loses required PopoverMenuItem evidence", async () => {
    const tempRoot = await mkdtemp(path.join(tmpdir(), "ds-family-adoption-"));
    tempRoots.push(tempRoot);
    await copyRequiredEntries(tempRoot);
    await writeAdoptionFixtureRepo(tempRoot);

    await writeFile(
      path.join(
        tempRoot,
        "apps",
        "code",
        "src",
        "features",
        "prompts",
        "components",
        "PromptPanel.tsx"
      ),
      'import { PopoverSurface } from "../../../design-system";\nexport function Fixture() { return <PopoverSurface />; }\n',
      "utf8"
    );

    const result = runGuard(tempRoot);

    expect(result.status).toBe(1);
    expect(result.stderr).toContain("Popover");
    expect(result.stderr).toContain("PromptPanel.tsx");
    expect(result.stderr).toContain("PopoverMenuItem");
  });

  it("fails when Dialog loses a representative ModalShell surface", async () => {
    const tempRoot = await mkdtemp(path.join(tmpdir(), "ds-family-adoption-"));
    tempRoots.push(tempRoot);
    await copyRequiredEntries(tempRoot);
    await writeAdoptionFixtureRepo(tempRoot);

    await rm(
      path.join(tempRoot, "apps", "code", "src", "features", "app", "components", "AppModals.tsx")
    );

    const result = runGuard(tempRoot);

    expect(result.status).toBe(1);
    expect(result.stderr).toContain("Dialog");
    expect(result.stderr).toContain("AppModals.tsx");
  });

  it("fails when ModalShell stops bridging shared Dialog", async () => {
    const tempRoot = await mkdtemp(path.join(tmpdir(), "ds-family-adoption-"));
    tempRoots.push(tempRoot);
    await copyRequiredEntries(tempRoot);
    await writeAdoptionFixtureRepo(tempRoot);

    await writeFile(
      path.join(tempRoot, "apps", "code", "src", "design-system", "components", "ModalShell.tsx"),
      "export function ModalShell() { return <div />; }\n",
      "utf8"
    );

    const result = runGuard(tempRoot);

    expect(result.status).toBe(1);
    expect(result.stderr).toContain("Dialog");
    expect(result.stderr).toContain("ModalShell.tsx");
  });

  it("fails when Field loses a shared embed surface", async () => {
    const tempRoot = await mkdtemp(path.join(tmpdir(), "ds-family-adoption-"));
    tempRoots.push(tempRoot);
    await copyRequiredEntries(tempRoot);
    await writeAdoptionFixtureRepo(tempRoot);

    await writeFile(
      path.join(tempRoot, "packages", "design-system", "src", "components", "Switch.tsx"),
      "export function Fixture() { return <div />; }\n",
      "utf8"
    );

    const result = runGuard(tempRoot);

    expect(result.status).toBe(1);
    expect(result.stderr).toContain("Field");
    expect(result.stderr).toContain("Switch.tsx");
  });

  it("fails when Textarea loses a representative adoption surface", async () => {
    const tempRoot = await mkdtemp(path.join(tmpdir(), "ds-family-adoption-"));
    tempRoots.push(tempRoot);
    await copyRequiredEntries(tempRoot);
    await writeAdoptionFixtureRepo(tempRoot);

    const fileEditorCardPath = path.join(
      tempRoot,
      "apps",
      "code",
      "src",
      "features",
      "shared",
      "components",
      "FileEditorCard.tsx"
    );
    await mkdir(path.dirname(fileEditorCardPath), { recursive: true });
    await writeFile(
      fileEditorCardPath,
      'import { Textarea } from "../../../design-system";\nexport function Fixture() { return <div />; }\n',
      "utf8"
    );

    const result = runGuard(tempRoot);

    expect(result.status).toBe(1);
    expect(result.stderr).toContain("Textarea");
    expect(result.stderr).toContain("FileEditorCard.tsx");
  });

  it("fails when Rows loses representative adoption evidence", async () => {
    const tempRoot = await mkdtemp(path.join(tmpdir(), "ds-family-adoption-"));
    tempRoots.push(tempRoot);
    await copyRequiredEntries(tempRoot);
    await writeAdoptionFixtureRepo(tempRoot);

    await writeFile(
      path.join(
        tempRoot,
        "apps",
        "code",
        "src",
        "features",
        "git",
        "components",
        "GitDiffPanel.tsx"
      ),
      'import { MetadataList } from "../../../design-system";\nexport function Fixture() { return <MetadataList />; }\n',
      "utf8"
    );

    const result = runGuard(tempRoot);

    expect(result.status).toBe(1);
    expect(result.stderr).toContain("Rows");
    expect(result.stderr).toContain("GitDiffPanel.tsx");
  });

  it("fails when StatusBadge loses representative adoption evidence", async () => {
    const tempRoot = await mkdtemp(path.join(tmpdir(), "ds-family-adoption-"));
    tempRoots.push(tempRoot);
    await copyRequiredEntries(tempRoot);
    await writeAdoptionFixtureRepo(tempRoot);

    await writeFile(
      path.join(
        tempRoot,
        "apps",
        "code",
        "src",
        "features",
        "settings",
        "components",
        "sections",
        "SettingsAutomationSection.tsx"
      ),
      "export function Fixture() { return <div />; }\n",
      "utf8"
    );

    const result = runGuard(tempRoot);

    expect(result.status).toBe(1);
    expect(result.stderr).toContain("StatusBadge");
    expect(result.stderr).toContain("SettingsAutomationSection.tsx");
  });

  it("fails when Surface loses representative adoption evidence", async () => {
    const tempRoot = await mkdtemp(path.join(tmpdir(), "ds-family-adoption-"));
    tempRoots.push(tempRoot);
    await copyRequiredEntries(tempRoot);
    await writeAdoptionFixtureRepo(tempRoot);

    await writeFile(
      path.join(
        tempRoot,
        "apps",
        "code",
        "src",
        "features",
        "composer",
        "components",
        "ComposerShell.tsx"
      ),
      "export function Fixture() { return <div />; }\n",
      "utf8"
    );

    const result = runGuard(tempRoot);

    expect(result.status).toBe(1);
    expect(result.stderr).toContain("Surface");
    expect(result.stderr).toContain("ComposerShell.tsx");
  });
});
