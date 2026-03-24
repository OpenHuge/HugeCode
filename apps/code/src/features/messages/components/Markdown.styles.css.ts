import { globalStyle, style } from "@vanilla-extract/css";
import { layers } from "../../../styles/system/layers.css";

export const markdown = "markdown";
export const markdownLinkblock = "markdown-linkblock";

export const messageFileLink = "message-file-link";
export const messageFileLinkName = "message-file-link-name";
export const messageFileLinkLine = "message-file-link-line";
export const messageFileLinkPath = "message-file-link-path";
export const skillReferenceLink = "message-skill-link";
export const skillReferenceIcon = "message-skill-link-icon";
export const skillReferenceLabel = "message-skill-link-label";
export const skillReferenceTooltipContent = "message-skill-tooltip-content";
export const skillReferenceCard = "message-skill-card";
export const skillReferenceCardEyebrow = "message-skill-card-eyebrow";
export const skillReferenceCardEyebrowLabel = "message-skill-card-eyebrow-label";
export const skillReferenceCardEyebrowMeta = "message-skill-card-eyebrow-meta";
export const skillReferenceCardTitleRow = "message-skill-card-title-row";
export const skillReferenceCardTitle = "message-skill-card-title";
export const skillReferenceCardDescription = "message-skill-card-description";
export const skillReferenceCardMeta = "message-skill-card-meta";
export const skillReferenceCardMetaChip = "message-skill-card-meta-chip";
export const skillReferenceCardMetaChipWarning = "message-skill-card-meta-chip-warning";

export const markdownCodeblockLanguage = style({
  "@layer": {
    [layers.features]: {
      fontSize: "var(--font-size-fine)",
      fontWeight: "500",
      letterSpacing: "0.05em",
      textTransform: "uppercase",
      color: "var(--ds-text-muted)",
    },
  },
});

export const markdownCodeblockCopy = style({
  "@layer": {
    [layers.features]: {
      height: "24px",
      padding: "0 8px",
      fontSize: "var(--font-size-fine)",
      color: "var(--ds-text-muted)",
      borderRadius: "6px",
      transition:
        "background-color var(--duration-fast) var(--ease-smooth), color var(--duration-fast) var(--ease-smooth)",
      selectors: {
        "&:hover": {
          color: "var(--ds-text-primary)",
          backgroundColor: "var(--ds-surface-active)",
        },
      },
    },
  },
});

export const markdownCodeblockSingle = style({
  "@layer": {
    [layers.features]: {
      margin: "0",
      padding: "10px 12px",
      overflowX: "auto",
      fontFamily: "var(--code-font-family)",
      fontSize: "var(--font-size-chrome)",
      lineHeight: "var(--line-height-content)",
      color: "var(--ds-text-primary)",
      scrollbarWidth: "thin",
    },
  },
});

export const markdownCodeblockPre = style({
  "@layer": {
    [layers.features]: {
      margin: "0",
      padding: "14px",
      overflowX: "auto",
      fontFamily: "var(--code-font-family)",
      fontSize: "var(--font-size-chrome)",
      lineHeight: "var(--line-height-content)",
      color: "var(--ds-text-primary)",
      scrollbarWidth: "thin",
    },
  },
});

export const stateCopied = "is-copied";

globalStyle(`.${messageFileLink}`, {
  display: "inline-flex",
  alignItems: "center",
  flexWrap: "wrap",
  gap: "6px",
  maxWidth: "100%",
  margin: "0 2px",
  padding: "2px 10px",
  borderRadius: "999px",
  border: "1px solid color-mix(in srgb, var(--ds-border-subtle) 54%, transparent)",
  background: "color-mix(in srgb, var(--ds-surface-control) 78%, transparent)",
  color: "inherit",
  textDecoration: "none",
  verticalAlign: "middle",
  lineHeight: "var(--line-height-title-lg)",
});

globalStyle(`.${messageFileLink}:hover`, {
  borderColor: "color-mix(in srgb, var(--ds-border-subtle) 84%, transparent)",
  background: "color-mix(in srgb, var(--ds-surface-hover) 84%, var(--ds-surface-control))",
});

globalStyle(`.${messageFileLink}:focus-visible`, {
  outline: "none",
  borderColor: "color-mix(in srgb, var(--ds-brand-primary) 52%, transparent)",
  background: "color-mix(in srgb, var(--ds-brand-primary) 8%, var(--ds-surface-control))",
});

globalStyle(`.${messageFileLinkName}`, {
  minWidth: 0,
  fontFamily: "var(--code-font-family)",
  fontSize: "var(--font-size-meta)",
  fontWeight: "600",
  color: "var(--ds-text-strong)",
  overflowWrap: "anywhere",
});

globalStyle(`.${messageFileLinkLine}`, {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  padding: "1px 7px",
  borderRadius: "999px",
  background: "color-mix(in srgb, var(--ds-brand-primary) 10%, transparent)",
  color: "color-mix(in srgb, var(--ds-brand-primary) 70%, var(--ds-text-strong))",
  fontSize: "var(--font-size-fine)",
  fontWeight: "700",
  lineHeight: "var(--line-height-display)",
  whiteSpace: "nowrap",
});

globalStyle(`.${messageFileLinkPath}`, {
  minWidth: 0,
  color: "var(--ds-text-muted)",
  fontFamily: "var(--code-font-family)",
  fontSize: "var(--font-size-fine)",
  overflowWrap: "anywhere",
});

globalStyle(".tool-inline-output pre", {
  margin: "0",
  maxWidth: "100%",
  overflowX: "auto",
  overflowY: "hidden",
  whiteSpace: "pre-wrap",
  overflowWrap: "anywhere",
  wordBreak: "break-word",
  scrollbarWidth: "thin",
});

globalStyle(".tool-inline-output pre code", {
  display: "block",
  minWidth: 0,
  whiteSpace: "inherit",
  overflowWrap: "inherit",
  wordBreak: "inherit",
});

globalStyle(
  `.${markdownCodeblockPre} .token.comment, .${markdownCodeblockPre} .token.prolog, .${markdownCodeblockPre} .token.doctype, .${markdownCodeblockPre} .token.cdata, .${markdownCodeblockSingle} .token.comment, .${markdownCodeblockSingle} .token.prolog, .${markdownCodeblockSingle} .token.doctype, .${markdownCodeblockSingle} .token.cdata`,
  {
    color: "var(--ds-text-accent)",
  }
);
globalStyle(
  `.${markdownCodeblockPre} .token.punctuation, .${markdownCodeblockSingle} .token.punctuation`,
  {
    color: "var(--ds-text-subtle)",
  }
);
globalStyle(
  `.${markdownCodeblockPre} .token.property, .${markdownCodeblockPre} .token.tag, .${markdownCodeblockPre} .token.constant, .${markdownCodeblockPre} .token.symbol, .${markdownCodeblockPre} .token.deleted, .${markdownCodeblockSingle} .token.property, .${markdownCodeblockSingle} .token.tag, .${markdownCodeblockSingle} .token.constant, .${markdownCodeblockSingle} .token.symbol, .${markdownCodeblockSingle} .token.deleted`,
  {
    color: "var(--ds-syntax-danger)",
  }
);
globalStyle(
  `.${markdownCodeblockPre} .token.boolean, .${markdownCodeblockPre} .token.number, .${markdownCodeblockSingle} .token.boolean, .${markdownCodeblockSingle} .token.number`,
  {
    color: "var(--ds-syntax-warning)",
  }
);
globalStyle(
  `.${markdownCodeblockPre} .token.selector, .${markdownCodeblockPre} .token.attr-name, .${markdownCodeblockPre} .token.string, .${markdownCodeblockPre} .token.char, .${markdownCodeblockPre} .token.builtin, .${markdownCodeblockPre} .token.inserted, .${markdownCodeblockSingle} .token.selector, .${markdownCodeblockSingle} .token.attr-name, .${markdownCodeblockSingle} .token.string, .${markdownCodeblockSingle} .token.char, .${markdownCodeblockSingle} .token.builtin, .${markdownCodeblockSingle} .token.inserted`,
  {
    color: "var(--ds-syntax-success)",
  }
);
globalStyle(
  `.${markdownCodeblockPre} .token.operator, .${markdownCodeblockPre} .token.entity, .${markdownCodeblockPre} .token.url, .${markdownCodeblockPre} .token.variable, .${markdownCodeblockSingle} .token.operator, .${markdownCodeblockSingle} .token.entity, .${markdownCodeblockSingle} .token.url, .${markdownCodeblockSingle} .token.variable`,
  {
    color: "var(--ds-syntax-variable)",
  }
);
globalStyle(
  `.${markdownCodeblockPre} .token.atrule, .${markdownCodeblockPre} .token.attr-value, .${markdownCodeblockPre} .token.keyword, .${markdownCodeblockSingle} .token.atrule, .${markdownCodeblockSingle} .token.attr-value, .${markdownCodeblockSingle} .token.keyword`,
  {
    color: "var(--ds-syntax-keyword)",
  }
);
globalStyle(
  `.${markdownCodeblockPre} .token.function, .${markdownCodeblockPre} .token.class-name, .${markdownCodeblockSingle} .token.function, .${markdownCodeblockSingle} .token.class-name`,
  {
    color: "var(--ds-syntax-function)",
  }
);
