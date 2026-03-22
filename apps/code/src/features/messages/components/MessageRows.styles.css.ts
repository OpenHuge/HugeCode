import { createVar, style } from "@vanilla-extract/css";
import { layers } from "../../../styles/system/layers.css";

export const messageImageGrid = "message-image-grid";
export const messageImageGridWithText = "message-image-grid--with-text";
export const messageImageItem = "message-image-item";
export const messageImageThumb = "message-image-thumb";
export const messageImageLightbox = "message-image-lightbox";
export const messageImageLightboxContent = "message-image-lightbox-content";
export const messageImageLightboxClose = "message-image-lightbox-close";

export const toolInlineTerminal = "tool-inline-terminal";
export const toolInlineTerminalLines = "tool-inline-terminal-lines";
export const toolInlineTerminalLine = "tool-inline-terminal-line";
export const commandInline = "command-inline";
export const commandInlineStatusRow = "command-inline-status-row";
export const commandInlineStatus = "command-inline-status";
export const commandInlineSurface = "command-inline-surface";
export const commandInlineSurfaceHeader = "command-inline-surface-header";
export const commandInlineSurfaceToggle = "command-inline-surface-toggle";
export const commandInlineSurfaceLabel = "command-inline-surface-label";
export const commandInlineSurfaceHint = "command-inline-surface-hint";
export const commandInlinePromptRow = "command-inline-prompt-row";
export const commandInlinePrompt = "command-inline-prompt";
export const commandInlinePromptCommand = "command-inline-prompt-command";
export const commandInlineContext = "command-inline-context";
export const commandInlineContextLabel = "command-inline-context-label";

export const working = "working";
export const workingSpinner = "working-spinner";
export const workingBody = "working-body";
export const workingHeader = "working-header";
export const workingStatus = "working-status";
export const workingLabel = "working-label";
export const workingMeta = "working-meta";
export const workingTimer = "working-timer";
export const workingTimerClock = "working-timer-clock";
export const workingText = "working-text";

export const visuallyHidden = style({
  position: "absolute",
  width: "1px",
  height: "1px",
  padding: 0,
  margin: "-1px",
  overflow: "hidden",
  clip: "rect(0, 0, 0, 0)",
  whiteSpace: "nowrap",
  border: 0,
});

export const turnComplete = "turn-complete";
export const turnCompleteLine = "turn-complete-line";
export const turnCompleteStatus = "turn-complete-status";
export const turnCompleteSummary = "turn-complete-summary";
export const turnCompleteChip = "turn-complete-chip";
export const turnCompleteActions = "turn-complete-actions";
export const turnCompleteAction = "turn-complete-action";
export const turnCompleteLabel = "turn-complete-label";
export const turnCompleteToggle = "turn-complete-toggle";
export const turnCompleteSummaryText = "turn-complete-summary-text";
export const turnCompleteMeta = "turn-complete-meta";
export const turnCompleteChevron = "turn-complete-chevron";
export const turnCompleteDetails = "turn-complete-details";
export const turnCompleteDetailBlock = "turn-complete-detail-block";
export const turnCompleteDetailLabel = "turn-complete-detail-label";
export const turnCompleteDetailValue = "turn-complete-detail-value";
const messageContentAlign = createVar();

export const messageRoleClass = {
  assistant: style({
    vars: {
      [messageContentAlign]: "flex-start",
    },
  }),
  user: style({
    vars: {
      [messageContentAlign]: "flex-end",
    },
  }),
} as const;

export const message = style({
  "@layer": {
    [layers.features]: {
      display: "flex",
      flexDirection: "column",
      width: "100%",
      padding: "8px 0 10px",
    },
  },
});

export const messageBody = "message-body";

export const messageContent = style({
  "@layer": {
    [layers.features]: {
      display: "flex",
      flexDirection: "column",
      width: "100%",
      maxWidth: "100%",
      minWidth: "0",
    },
  },
});

export const messageSurface = style({
  "@layer": {
    [layers.features]: {
      display: "flex",
      flexDirection: "column",
      gap: "8px",
      minWidth: "0",
      selectors: {
        [`${messageRoleClass.user} &`]: {
          alignSelf: messageContentAlign,
          width: "fit-content",
          minWidth: "min(180px, 100%)",
          maxWidth: "min(62%, 30rem)",
        },
        [`${messageRoleClass.assistant} &`]: {
          alignSelf: "stretch",
          width: "100%",
          maxWidth: "min(100%, var(--messages-content-max-width))",
        },
      },
    },
  },
});

export const bubble = style({
  "@layer": {
    [layers.features]: {
      display: "flex",
      flexDirection: "column",
      gap: "8px",
      position: "relative",
    },
  },
});

export const messageBubble = style({
  "@layer": {
    [layers.features]: {
      width: "100%",
      maxWidth: "100%",
      minWidth: "0",
      color: "var(--ds-text-primary)",
      fontSize: "var(--font-size-content)",
      lineHeight: "var(--line-height-content)",
      selectors: {
        [`${messageRoleClass.user} &`]: {
          background: "color-mix(in srgb, var(--ds-brand-primary) 6%, var(--ds-surface-card-base))",
          padding: "12px 14px",
          borderRadius: "16px",
          border:
            "1px solid color-mix(in srgb, var(--ds-brand-primary) 14%, var(--ds-border-subtle))",
          boxShadow: "none",
        },
        [`${messageRoleClass.assistant} &`]: {
          padding: "14px 16px",
          borderRadius: "16px",
          border: "1px solid color-mix(in srgb, var(--ds-border-subtle) 52%, transparent)",
          background:
            "color-mix(in srgb, var(--ds-surface-card-base) 94%, var(--ds-surface-control))",
          boxShadow: "none",
        },
      },
    },
  },
});

export const messageActions = style({
  "@layer": {
    [layers.features]: {
      display: "flex",
      alignItems: "center",
      gap: "6px",
      marginBottom: "2px",
      width: "100%",
      justifyContent: "flex-end",
      opacity: 0.42,
      transition:
        "opacity var(--duration-fast) var(--ease-smooth), transform var(--duration-fast) var(--ease-smooth)",
      transform: "translateY(2px)",
      selectors: {
        [`${message}:hover &`]: {
          opacity: 1,
          transform: "translateY(0)",
        },
        [`${message}:focus-within &`]: {
          opacity: 1,
          transform: "translateY(0)",
        },
      },
      "@media": {
        "(hover: none)": {
          opacity: 1,
          transform: "translateY(0)",
        },
      },
    },
  },
});

export const messageCopyButton = "message-copy-button";
export const messageCopyIcon = "message-copy-icon";
export const messageCopyIconCheck = "message-copy-icon-check";
export const messageCopyIconCopy = "message-copy-icon-copy";
export const messageEditButton = "message-edit-button";
export const messageEditIcon = "message-edit-icon";

export const reasoningBlock = "reasoning-block";
export const reasoningToggle = "reasoning-toggle";
export const reasoningSpinner = "reasoning-spinner";
export const reasoningChevron = "reasoning-chevron";
export const reasoningTitle = "reasoning-title";
export const reasoningContent = "reasoning-content";
export const reasoningContentHeader = "reasoning-content-header";
export const reasoningMarkdown = "reasoning-markdown";

export const itemCard = "item-card";
export const timelineCardHeader = "timeline-card-header";
export const timelineCardLead = "timeline-card-lead";
export const timelineCardIcon = "timeline-card-icon";
export const timelineCardTitleStack = "timeline-card-title-stack";
export const timelineCardTitle = "timeline-card-title";
export const timelineCardMeta = "timeline-card-meta";
export const timelineCardChip = "timeline-card-chip";
export const timelineCardChipEmphasis = "timeline-card-chip-emphasis";
export const metaNotice = style({
  "@layer": {
    [layers.features]: {
      width: "100%",
      borderRadius: "12px",
      border: "1px solid color-mix(in srgb, var(--ds-border-subtle) 52%, transparent)",
      background: "color-mix(in srgb, var(--ds-surface-card-base) 96%, transparent)",
      boxShadow: "none",
    },
  },
});
export const review = "review";
export const reviewHeader = "review-header";
export const reviewTitle = "review-title";
export const reviewBadge = "review-badge";
export const diff = "diff";
export const diffHeader = "diff-header";
export const diffHeaderCopy = style({
  "@layer": {
    [layers.features]: {
      display: "flex",
      alignItems: "center",
      gap: "8px",
      minWidth: "0",
      flexWrap: "wrap",
    },
  },
});
export const diffHeaderActions = style({
  "@layer": {
    [layers.features]: {
      display: "flex",
      alignItems: "center",
      gap: "8px",
      marginLeft: "auto",
    },
  },
});
export const diffTitle = "diff-title";
export const diffToggle = style({
  "@layer": {
    [layers.features]: {
      border: "1px solid color-mix(in srgb, var(--ds-border-subtle) 48%, transparent)",
      borderRadius: "999px",
      background: "color-mix(in srgb, var(--ds-surface-muted) 58%, transparent)",
      color: "var(--ds-text-subtle)",
      fontSize: "var(--font-size-fine)",
      fontWeight: "560",
      padding: "5px 10px",
      transition:
        "background var(--duration-fast) var(--ease-smooth), border-color var(--duration-fast) var(--ease-smooth)",
      selectors: {
        "&:hover": {
          background: "color-mix(in srgb, var(--ds-surface-hover) 76%, var(--ds-surface-muted))",
        },
      },
    },
  },
});
export const diffViewerOutput = "diff-viewer-output";
export const diffFileList = style({
  "@layer": {
    [layers.features]: {
      display: "grid",
      gap: "8px",
      listStyle: "none",
      margin: "0 0 10px",
      padding: "0",
    },
  },
});
export const diffFileItem = style({
  "@layer": {
    [layers.features]: {
      display: "flex",
      alignItems: "center",
      gap: "10px",
      minWidth: "0",
      padding: "8px 10px",
      borderRadius: "10px",
      border: "1px solid color-mix(in srgb, var(--ds-border-subtle) 48%, transparent)",
      background: "color-mix(in srgb, var(--ds-surface-muted) 58%, transparent)",
    },
  },
});
export const diffFileStatus = style({
  "@layer": {
    [layers.features]: {
      display: "inline-flex",
      alignItems: "center",
      justifyContent: "center",
      flex: "0 0 auto",
      padding: "3px 8px",
      borderRadius: "999px",
      background: "color-mix(in srgb, var(--ds-surface-active) 46%, transparent)",
      color: "var(--ds-text-subtle)",
      fontSize: "var(--font-size-fine)",
      textTransform: "capitalize",
    },
  },
});
export const diffFilePath = style({
  "@layer": {
    [layers.features]: {
      minWidth: "0",
      overflow: "hidden",
      textOverflow: "ellipsis",
      whiteSpace: "nowrap",
      color: "var(--ds-text-strong)",
      fontSize: "var(--font-size-meta)",
    },
  },
});
export const diffActions = style({
  "@layer": {
    [layers.features]: {
      display: "flex",
      justifyContent: "flex-end",
      gap: "8px",
      marginBottom: "10px",
    },
  },
});
export const itemStatus = "item-status";
export const itemText = "item-text";

export const toolInline = "tool-inline";
export const toolInlineExpanded = "tool-inline-expanded";
export const toolInlineBarToggle = "tool-inline-bar-toggle";
export const toolInlineContent = "tool-inline-content";
export const toolInlineHeader = "tool-inline-header";
export const toolInlinePrimary = "tool-inline-primary";
export const toolInlineSummary = "tool-inline-summary";
export const toolInlineToggle = "tool-inline-toggle";
export const toolInlineActions = "tool-inline-actions";
export const toolInlineBadges = "tool-inline-badges";
export const toolInlineStatusCompact = "tool-inline-status-compact";
export const toolInlineChevron = "tool-inline-chevron";
export const toolInlineIcon = "tool-inline-icon";
export const toolInlineLabel = "tool-inline-label";
export const toolInlineValue = "tool-inline-value";
export const toolInlineSingleLine = "tool-inline-single-line";
export const toolInlineCommand = "tool-inline-command";
export const toolInlineCommandText = "tool-inline-command-text";
export const toolInlineCommandFade = "tool-inline-command-fade";
export const toolInlineCommandFull = "tool-inline-command-full";
export const toolInlineMeta = "tool-inline-meta";
export const toolInlineChip = "tool-inline-chip";
export const toolInlineDetail = "tool-inline-detail";
export const toolInlineMuted = "tool-inline-muted";
export const toolInlineChangeList = "tool-inline-change-list";
export const toolInlineOutput = "tool-inline-output";

export const exploreInline = "explore-inline";
export const exploreInlineHeader = "explore-inline-header";
export const exploreInlineTitle = "explore-inline-title";
export const exploreInlineList = "explore-inline-list";
export const exploreInlineItem = "explore-inline-item";
export const exploreInlineKind = "explore-inline-kind";
export const exploreInlineLabel = "explore-inline-label";
export const exploreInlineDetail = "explore-inline-detail";

export const stateActive = "active";
export const stateDone = "done";
export const stateCopied = "is-copied";
export const toneCompleted = "completed";
export const toneProcessing = "processing";
export const toneFailed = "failed";
export const selectableTimelineItem = style({
  "@layer": {
    [layers.features]: {
      cursor: "pointer",
      transition:
        "border-color var(--duration-fast) var(--ease-smooth), box-shadow var(--duration-fast) var(--ease-smooth), background var(--duration-fast) var(--ease-smooth)",
      selectors: {
        "&:focus-visible": {
          outline: "2px solid var(--ds-panel-focus-ring)",
          outlineOffset: "2px",
        },
      },
    },
  },
});

export const selectableTimelineButtonReset = style({
  "@layer": {
    [layers.features]: {
      appearance: "none",
      background: "transparent",
      border: 0,
      color: "inherit",
      font: "inherit",
      margin: 0,
      padding: 0,
      textAlign: "inherit",
    },
  },
});

export const selectedTimelineItem = style({
  "@layer": {
    [layers.features]: {
      borderColor: "color-mix(in srgb, var(--ds-panel-border) 88%, transparent)",
      background: "color-mix(in srgb, var(--ds-panel-row-selected) 82%, transparent)",
      boxShadow: "none",
    },
  },
});
