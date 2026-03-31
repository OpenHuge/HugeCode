/*
 * Temporary migration compatibility barrel.
 * Shared visual ownership belongs to @ku0/design-system.
 * Do not add new visual primitives, token families, or component families here.
 */

export { Avatar, type AvatarProps } from "@ku0/design-system";
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
} from "@ku0/design-system";
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
export { RadioGroup, type RadioGroupOption, type RadioGroupProps } from "@ku0/design-system";
export { Select, type SelectOption, type SelectProps } from "@ku0/design-system";
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
  CodeBlockSurface,
  DataTableSurface,
  EmptySurface,
  InlineActionRow,
  MetadataList,
  MetadataRow,
  RichContent,
  SectionHeader,
  StatusBadge,
  Surface,
  Switch,
  type CodeBlockSurfaceProps,
  type DataTableSurfaceProps,
  type EmptySurfaceProps,
  type InlineActionRowProps,
  type MetadataListProps,
  type MetadataRowProps,
  type RichContentProps,
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
export {
  ListRow,
  type ListRowProps,
  ShellFrame,
  ShellSection,
  ShellToolbar,
  SplitPanel,
} from "./components/shell/ShellPrimitives";
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
