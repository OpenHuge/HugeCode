import { spawnSync } from "node:child_process";
import { cp, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

const repoRoot = path.resolve(import.meta.dirname, "..", "..");
const tempRoots: string[] = [];
const requiredEntries = [
  "package.json",
  "scripts/check-design-system-surface-semantics.mjs",
  "scripts/lib/design-system-app-surface-config.mjs",
];

const adapterEntries = [
  "apps/code/src/design-system/adapters/Button/Button.tsx",
  "apps/code/src/design-system/adapters/Card/Card.tsx",
  "apps/code/src/design-system/adapters/Input/Input.tsx",
  "apps/code/src/design-system/adapters/Radio/Radio.tsx",
  "apps/code/src/design-system/adapters/Select/Select.tsx",
] as const;

const allowedCompatFiles = new Map<string, string>([
  ["apps/code/src/design-system/components/Icon.tsx", "export function Icon() { return null; }\n"],
  [
    "apps/code/src/design-system/components/IconButton.tsx",
    'import { Icon } from "./Icon";\nexport function IconButton() { return <Icon />; }\n',
  ],
  [
    "apps/code/src/design-system/components/ModalCardPresets.css.ts",
    'export const compactModalCard = "compact-modal-card";\n',
  ],
  [
    "apps/code/src/design-system/components/ModalShell.tsx",
    'import { Dialog } from "./modal/ModalPrimitives";\nexport function ModalShell() { return <Dialog open={true} onOpenChange={() => undefined} />; }\n',
  ],
  ["apps/code/src/design-system/components/ModalShell.test.tsx", "export {};\n"],
  [
    "apps/code/src/design-system/components/modal/ModalPrimitives.tsx",
    'import { Dialog as SharedDialog } from "@ku0/design-system";\nfunction join(values) { return values.filter(Boolean).join(" "); }\nexport function Dialog({ className, cardClassName, ...props }) { return <SharedDialog {...props} className={join(["app-dialog-root", className])} cardClassName={join(["app-dialog-card", cardClassName])} />; }\nexport {};\n',
  ],
  ["apps/code/src/design-system/components/modal/ModalPrimitives.test.tsx", "export {};\n"],
  [
    "apps/code/src/design-system/components/panel/PanelPrimitives.tsx",
    'import { PanelFrame as SharedPanelFrame } from "@ku0/design-system";\nfunction join(values) { return values.filter(Boolean).join(" "); }\nexport function PanelFrame({ className, ...props }) { return <SharedPanelFrame {...props} className={join(["app-panel-frame", className])} />; }\nexport function PanelHeader() { return null; }\nexport function PanelMeta() { return null; }\nexport function PanelNavItem() { return null; }\nexport function PanelNavList() { return null; }\nexport function PanelSearchField() { return null; }\n',
  ],
  ["apps/code/src/design-system/components/panel/PanelPrimitives.test.tsx", "export {};\n"],
  [
    "apps/code/src/design-system/components/shell/ShellPrimitives.tsx",
    'import { ShellFrame as SharedShellFrame } from "@ku0/design-system";\nfunction join(values) { return values.filter(Boolean).join(" "); }\nexport function ShellFrame({ className, ...props }) { return <SharedShellFrame {...props} className={join(["app-shell-frame", className])} />; }\nexport function ShellSection() { return null; }\nexport function ShellToolbar() { return null; }\nexport function SplitPanel() { return null; }\n',
  ],
  ["apps/code/src/design-system/components/shell/ShellPrimitives.test.tsx", "export {};\n"],
  [
    "apps/code/src/design-system/components/popover/PopoverPrimitives.tsx",
    'import { PopoverMenuItem as SharedPopoverMenuItem, PopoverSurface as SharedPopoverSurface } from "@ku0/design-system";\nfunction join(values) { return values.filter(Boolean).join(" "); }\nexport function PopoverSurface({ className, ...props }) { return <SharedPopoverSurface {...props} className={join(["app-popover-surface", className])} data-app-popover-surface="true" />; }\nexport function PopoverMenuItem({ className, ...props }) { return <SharedPopoverMenuItem {...props} className={join(["app-popover-item", className])} data-app-popover-item="true" />; }\nexport {};\n',
  ],
  ["apps/code/src/design-system/components/popover/PopoverPrimitives.test.tsx", "export {};\n"],
  [
    "apps/code/src/design-system/components/textarea/TextareaPrimitives.tsx",
    'import { Textarea as SharedTextarea } from "@ku0/design-system";\nfunction join(values) { return values.filter(Boolean).join(" "); }\nexport function Textarea({ className, fieldClassName, error, textareaSize = "lg", ...props }) { return <SharedTextarea {...props} className={join(["app-textarea-control", className])} fieldClassName={join(["app-textarea-field", fieldClassName])} invalid={error} textareaSize={textareaSize} data-app-textarea="true" />; }\n',
  ],
  ["apps/code/src/design-system/components/textarea/TextareaPrimitives.test.tsx", "export {};\n"],
  [
    "apps/code/src/design-system/components/toast/ToastPrimitives.tsx",
    'import { ToastCard as SharedToastCard } from "@ku0/design-system";\nfunction join(values) { return values.filter(Boolean).join(" "); }\nexport function ToastCard({ className, ...props }) { return <SharedToastCard {...props} className={join(["ds-toast-card", className])} data-tauri-drag-region="false" />; }\nexport function ToastViewport() { return null; }\nexport function ToastHeader() { return null; }\nexport function ToastTitle() { return null; }\nexport function ToastBody() { return null; }\nexport function ToastActions() { return null; }\nexport function ToastError() { return null; }\n',
  ],
  ["apps/code/src/design-system/components/toast/ToastPrimitives.test.tsx", "export {};\n"],
  [
    "apps/code/src/design-system/components/execution/ActivityLogRow.tsx",
    "export function ActivityLogRow() { return null; }\n",
  ],
  [
    "apps/code/src/design-system/components/execution/DiffReviewPanel.tsx",
    "export function DiffReviewPanel() { return null; }\nexport type DiffReviewFileEntry = { path: string };\n",
  ],
  [
    "apps/code/src/design-system/components/execution/ExecutionPrimitives.css.ts",
    'export const executionRow = "execution-row";\n',
  ],
  ["apps/code/src/design-system/components/execution/ExecutionPrimitives.test.tsx", "export {};\n"],
  [
    "apps/code/src/design-system/components/execution/ExecutionStatusPill.tsx",
    "export function ExecutionStatusPill() { return null; }\n",
  ],
  [
    "apps/code/src/design-system/components/execution/ToolCallChip.tsx",
    "export function ToolCallChip() { return null; }\n",
  ],
  [
    "apps/code/src/design-system/components/execution/executionStatus.ts",
    'export function executionToneFromLifecycleTone() { return "neutral"; }\nexport function formatCompactExecutionStatusLabel() { return "Running"; }\nexport function formatExecutionStatusLabel() { return "Running"; }\nexport function resolveExecutionStatusPresentation() { return null; }\nexport function resolveExecutionTone() { return null; }\nexport type ExecutionLifecycleTone = "completed";\nexport type ExecutionTone = "neutral";\n',
  ],
]);

const rootBarrelSource = `export { Avatar, type AvatarProps } from "@ku0/design-system";
export { Badge, type BadgeProps } from "@ku0/design-system";
export { Button, type ButtonProps } from "./adapters/Button";
export {
  Card,
  CardBody,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
  type CardProps,
} from "./adapters/Card";
export { Checkbox, type CheckboxProps } from "@ku0/design-system";
export { EmptyState, type EmptyStateProps } from "@ku0/design-system";
export { Icon, type IconProps, type IconSize } from "./components/Icon";
export { IconButton, type IconButtonProps } from "./components/IconButton";
export { Input, type InputProps } from "./adapters/Input";
export {
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  type DropdownMenuContentProps,
  type DropdownMenuItemProps,
  type DropdownMenuTriggerProps,
} from "@ku0/design-system";
export {
  PopoverMenuItem,
  PopoverSurface,
  type PopoverMenuItemProps,
  type PopoverSurfaceProps,
} from "./components/popover/PopoverPrimitives";
export { RadioGroup, type RadioGroupOption, type RadioGroupProps } from "./adapters/Radio";
export { Select, type SelectOption, type SelectProps } from "./adapters/Select";
export {
  DialogButton,
  Dialog,
  DialogDescription,
  DialogDivider,
  DialogError,
  DialogFooter,
  DialogHeader,
  DialogInput,
  DialogLabel,
  DialogLabelText,
  type DialogProps,
  DialogTextarea,
  DialogTitle,
} from "./components/modal/ModalPrimitives";
export {
  EmptySurface,
  InlineActionRow,
  MetadataList,
  MetadataRow,
  SectionHeader,
  StatusBadge,
  Surface,
  Switch,
  type EmptySurfaceProps,
  type InlineActionRowProps,
  type MetadataListProps,
  type MetadataRowProps,
  type SectionHeaderProps,
  type StatusBadgeProps,
  type StatusBadgeTone,
  type SurfaceProps,
  type SwitchProps,
} from "@ku0/design-system";
export { compactModalCard } from "./components/ModalCardPresets.css";
export { ModalShell } from "./components/ModalShell";
export {
  CoreLoopHeader,
  CoreLoopMetaRail,
  CoreLoopSection,
  CoreLoopStatePanel,
} from "../features/core-loop/components/CoreLoopAdapters";
export {
  WorkspaceChromePill,
  WorkspaceHeaderAction,
  WorkspaceHeaderActionCopyGlyphs,
  WorkspaceMenuSection,
  WorkspaceSupportMeta,
} from "../features/app/components/main-shell/MainShellAdapters";
export {
  ReviewActionRail,
  ReviewEvidenceList,
  ReviewLoopHeader,
  ReviewLoopSection,
  ReviewSignalGroup,
  ReviewSummaryCard,
} from "../features/review/components/review-loop/ReviewLoopAdapters";
export {
  PanelFrame,
  PanelHeader,
  PanelMeta,
  PanelNavItem,
  PanelNavList,
  PanelSearchField,
} from "./components/panel/PanelPrimitives";
export { ShellFrame, ShellSection, ShellToolbar, SplitPanel } from "./components/shell/ShellPrimitives";
export {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  type TabsContentProps,
  type TabsProps,
  type TabsTriggerProps,
} from "@ku0/design-system";
export { Text, type TextProps } from "@ku0/design-system";
export { Textarea, type TextareaProps } from "./components/textarea/TextareaPrimitives";
export {
  ToastActions,
  ToastBody,
  ToastCard,
  ToastError,
  ToastHeader,
  ToastTitle,
  ToastViewport,
} from "./components/toast/ToastPrimitives";
export { Tooltip, type TooltipProps } from "@ku0/design-system";
export { ActivityLogRow } from "./components/execution/ActivityLogRow";
export { DiffReviewPanel, type DiffReviewFileEntry } from "./components/execution/DiffReviewPanel";
export { ExecutionStatusPill } from "./components/execution/ExecutionStatusPill";
export { ToolCallChip } from "./components/execution/ToolCallChip";
export {
  executionToneFromLifecycleTone,
  formatCompactExecutionStatusLabel,
  formatExecutionStatusLabel,
  resolveExecutionStatusPresentation,
  resolveExecutionTone,
  type ExecutionLifecycleTone,
  type ExecutionTone,
} from "./components/execution/executionStatus";
`;

async function copyRequiredEntries(targetRoot: string): Promise<void> {
  for (const relativePath of requiredEntries) {
    const sourcePath = path.join(repoRoot, relativePath);
    const targetPath = path.join(targetRoot, relativePath);

    await mkdir(path.dirname(targetPath), { recursive: true });
    await cp(sourcePath, targetPath, { recursive: true });
  }
}

async function writeRepoFile(targetRoot: string, relativePath: string, content = "export {};\n") {
  const targetPath = path.join(targetRoot, relativePath);
  await mkdir(path.dirname(targetPath), { recursive: true });
  await writeFile(targetPath, content, "utf8");
}

async function createSurfaceSemanticsFixtureRepo(): Promise<string> {
  const tempRoot = await mkdtemp(path.join(tmpdir(), "ds-surface-semantics-"));
  tempRoots.push(tempRoot);
  await copyRequiredEntries(tempRoot);

  await writeRepoFile(tempRoot, "apps/code/src/design-system/index.ts", rootBarrelSource);

  for (const relativePath of adapterEntries) {
    await writeRepoFile(tempRoot, relativePath, 'export { value } from "@ku0/design-system";\n');
  }

  for (const [relativePath, content] of allowedCompatFiles) {
    await writeRepoFile(tempRoot, relativePath, content);
  }

  return tempRoot;
}

function runGuard(targetRoot: string) {
  return spawnSync(
    process.execPath,
    [
      path.join(targetRoot, "scripts", "check-design-system-surface-semantics.mjs"),
      "--root",
      targetRoot,
    ],
    {
      cwd: targetRoot,
      encoding: "utf8",
    }
  );
}

describe("check-design-system-surface-semantics", () => {
  afterEach(async () => {
    await Promise.all(
      tempRoots.map(async (rootPath) => {
        await rm(rootPath, { recursive: true, force: true });
      })
    );
    tempRoots.length = 0;
  });

  it("includes surface semantics in the design-system baseline command", async () => {
    const packageJson = JSON.parse(await readFile(path.join(repoRoot, "package.json"), "utf8")) as {
      scripts?: Record<string, string>;
    };

    expect(packageJson.scripts?.["check:design-system:baseline"]).toContain(
      "check:design-system:surface-semantics"
    );
  });

  it("passes when app design-system surfaces stay inside the frozen semantics baseline", async () => {
    const tempRoot = await createSurfaceSemanticsFixtureRepo();

    const result = runGuard(tempRoot);

    expect(result.status).toBe(0);
  });

  it("fails when a deleted passthrough-to-adapter component reappears", async () => {
    const tempRoot = await createSurfaceSemanticsFixtureRepo();
    await writeRepoFile(
      tempRoot,
      "apps/code/src/design-system/components/Button.tsx",
      'export { Button } from "../adapters/Button";\n'
    );

    const result = runGuard(tempRoot);

    expect(result.status).toBe(1);
  });

  it("fails when a new trivial passthrough-to-shared component is added", async () => {
    const tempRoot = await createSurfaceSemanticsFixtureRepo();
    await writeRepoFile(
      tempRoot,
      "apps/code/src/design-system/components/Chip.tsx",
      'export { Chip } from "@ku0/design-system";\n'
    );

    const result = runGuard(tempRoot);

    expect(result.status).toBe(1);
  });

  it("fails when the root barrel adds an unregistered direct shared forward", async () => {
    const tempRoot = await createSurfaceSemanticsFixtureRepo();
    await writeRepoFile(
      tempRoot,
      "apps/code/src/design-system/index.ts",
      `${rootBarrelSource}\nexport { Chip } from "@ku0/design-system";\n`
    );

    const result = runGuard(tempRoot);

    expect(result.status).toBe(1);
  });

  it("fails when the root barrel still directly forwards dialog exports from shared design-system", async () => {
    const tempRoot = await createSurfaceSemanticsFixtureRepo();
    await writeRepoFile(
      tempRoot,
      "apps/code/src/design-system/index.ts",
      `${rootBarrelSource}\nexport { Dialog } from "@ku0/design-system";\n`
    );

    const result = runGuard(tempRoot);

    expect(result.status).toBe(1);
  });

  it("fails when the root barrel still directly forwards panel exports from shared design-system", async () => {
    const tempRoot = await createSurfaceSemanticsFixtureRepo();
    await writeRepoFile(
      tempRoot,
      "apps/code/src/design-system/index.ts",
      `${rootBarrelSource}\nexport { PanelFrame } from "@ku0/design-system";\n`
    );

    const result = runGuard(tempRoot);

    expect(result.status).toBe(1);
  });

  it("fails when the root barrel still directly forwards shell exports from shared design-system", async () => {
    const tempRoot = await createSurfaceSemanticsFixtureRepo();
    await writeRepoFile(
      tempRoot,
      "apps/code/src/design-system/index.ts",
      `${rootBarrelSource}\nexport { ShellFrame, SplitPanel } from "@ku0/design-system";\n`
    );

    const result = runGuard(tempRoot);

    expect(result.status).toBe(1);
  });

  it("fails when the root barrel still routes SectionHeader through a deleted component path", async () => {
    const tempRoot = await createSurfaceSemanticsFixtureRepo();
    await writeRepoFile(
      tempRoot,
      "apps/code/src/design-system/index.ts",
      `${rootBarrelSource.replace("  SectionHeader,\n", "")}\nexport { SectionHeader } from "./components/SectionHeader";\n`
    );

    const result = runGuard(tempRoot);

    expect(result.status).toBe(1);
  });

  it("does not misclassify ModalShell or normalized compat bridges as forbidden cleanup targets", async () => {
    const tempRoot = await createSurfaceSemanticsFixtureRepo();

    const result = runGuard(tempRoot);

    expect(result.status).toBe(0);
  });

  it("fails when PopoverPrimitives regresses into a trivial passthrough shell", async () => {
    const tempRoot = await createSurfaceSemanticsFixtureRepo();
    await writeRepoFile(
      tempRoot,
      "apps/code/src/design-system/components/popover/PopoverPrimitives.tsx",
      'export { PopoverSurface } from "@ku0/design-system";\n'
    );

    const result = runGuard(tempRoot);

    expect(result.status).toBe(1);
  });

  it("fails when the root barrel still routes Popover through the deleted root-level compat path", async () => {
    const tempRoot = await createSurfaceSemanticsFixtureRepo();
    await writeRepoFile(
      tempRoot,
      "apps/code/src/design-system/index.ts",
      `${rootBarrelSource.replace('} from "./components/popover/PopoverPrimitives";', '} from "./components/Popover";')}\n`
    );

    const result = runGuard(tempRoot);

    expect(result.status).toBe(1);
  });

  it("fails when execution survivors regress into raw shared imports", async () => {
    const tempRoot = await createSurfaceSemanticsFixtureRepo();
    await writeRepoFile(
      tempRoot,
      "apps/code/src/design-system/components/execution/ActivityLogRow.tsx",
      'import { ActivityLogRow as SharedActivityLogRow } from "@ku0/design-system";\nexport function ActivityLogRow() { return <SharedActivityLogRow />; }\n'
    );

    const result = runGuard(tempRoot);

    expect(result.status).toBe(1);
  });

  it("fails when ModalPrimitives regresses into a trivial passthrough shell", async () => {
    const tempRoot = await createSurfaceSemanticsFixtureRepo();
    await writeRepoFile(
      tempRoot,
      "apps/code/src/design-system/components/modal/ModalPrimitives.tsx",
      'export { Dialog } from "@ku0/design-system";\n'
    );

    const result = runGuard(tempRoot);

    expect(result.status).toBe(1);
  });

  it("fails when ModalShell still imports Dialog directly from shared design-system", async () => {
    const tempRoot = await createSurfaceSemanticsFixtureRepo();
    await writeRepoFile(
      tempRoot,
      "apps/code/src/design-system/components/ModalShell.tsx",
      'import { Dialog } from "@ku0/design-system";\nexport function ModalShell() { return <Dialog open={true} onOpenChange={() => undefined} />; }\n'
    );

    const result = runGuard(tempRoot);

    expect(result.status).toBe(1);
  });

  it("fails when a feature-local surface re-exports a promoted shared family", async () => {
    const tempRoot = await createSurfaceSemanticsFixtureRepo();
    await writeRepoFile(
      tempRoot,
      "apps/code/src/features/right-panel/RightPanelPrimitives.tsx",
      "export function StatusBadge() { return null; }\n"
    );

    const result = runGuard(tempRoot);

    expect(result.status).toBe(1);
  });
});
