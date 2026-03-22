import { type GlobalStyleRule, globalStyle } from "@vanilla-extract/css";
import { layers } from "../../../styles/system/layers.css";
import * as markdownStyles from "./Markdown.styles.css";

const feature = (selector: string, rule: GlobalStyleRule) =>
  globalStyle(selector, { "@layer": { [layers.features]: rule } } as unknown as GlobalStyleRule);

feature(`.${markdownStyles.skillReferenceLink}`, {
  display: "inline-flex",
  alignItems: "center",
  gap: "6px",
  maxWidth: "100%",
  margin: "0 2px",
  padding: "3px 10px",
  borderRadius: "999px",
  border: "1px solid color-mix(in srgb, var(--ds-border-subtle) 58%, transparent)",
  background: "color-mix(in srgb, var(--ds-surface-control) 78%, var(--ds-surface-card-base))",
  color: "var(--ds-text-strong)",
  verticalAlign: "middle",
  lineHeight: "var(--line-height-135)",
  cursor: "default",
  transition:
    "border-color var(--duration-fast) var(--ease-smooth), background var(--duration-fast) var(--ease-smooth), color var(--duration-fast) var(--ease-smooth)",
});

feature(`.${markdownStyles.skillReferenceLink}:hover`, {
  borderColor:
    "color-mix(in srgb, var(--ds-border-accent-soft, var(--ds-brand-primary)) 82%, transparent)",
  background: "color-mix(in srgb, var(--ds-surface-hover) 84%, var(--ds-surface-control))",
});

feature(`.${markdownStyles.skillReferenceLink}:focus-visible`, {
  outline: "none",
  borderColor: "color-mix(in srgb, var(--ds-brand-primary) 58%, transparent)",
  background: "color-mix(in srgb, var(--ds-brand-primary) 8%, var(--ds-surface-control))",
});

feature(`.${markdownStyles.skillReferenceIcon}`, {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  width: "18px",
  height: "18px",
  borderRadius: "999px",
  background: "color-mix(in srgb, var(--ds-brand-primary) 12%, transparent)",
  color: "color-mix(in srgb, var(--ds-brand-primary) 74%, var(--ds-text-strong))",
  flex: "0 0 auto",
});

feature(`.${markdownStyles.skillReferenceLabel}`, {
  minWidth: "0",
  fontSize: "var(--font-size-meta)",
  fontWeight: "620",
  letterSpacing: "-0.01em",
  overflowWrap: "anywhere",
});

feature(`.${markdownStyles.skillReferenceTooltipContent}`, {
  "--ds-tooltip-shadow": "none",
  maxWidth: "min(22rem, calc(100vw - 24px))",
  padding: "0",
  whiteSpace: "normal",
  pointerEvents: "none",
  background:
    "color-mix(in srgb, var(--ds-surface-panel, var(--ds-surface-card-base)) 96%, var(--ds-surface-card-base))",
  borderColor: "color-mix(in srgb, var(--ds-border-subtle) 84%, transparent)",
  boxShadow: "none",
} as unknown as GlobalStyleRule);

feature(`.${markdownStyles.skillReferenceCard}`, {
  display: "flex",
  flexDirection: "column",
  gap: "10px",
  padding: "12px 13px 13px",
});

feature(`.${markdownStyles.skillReferenceCardEyebrow}`, {
  display: "flex",
  alignItems: "center",
  flexWrap: "wrap",
  gap: "6px",
});

feature(`.${markdownStyles.skillReferenceCardEyebrowLabel}`, {
  fontSize: "var(--font-size-micro)",
  fontWeight: "700",
  letterSpacing: "0.08em",
  textTransform: "uppercase",
  color: "var(--ds-text-subtle)",
});

feature(`.${markdownStyles.skillReferenceCardEyebrowMeta}`, {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  minHeight: "18px",
  padding: "1px 7px",
  borderRadius: "999px",
  border: "1px solid color-mix(in srgb, var(--ds-border-subtle) 62%, transparent)",
  background: "color-mix(in srgb, var(--ds-surface-control) 72%, transparent)",
  color: "var(--ds-text-subtle)",
  fontSize: "var(--font-size-micro)",
  fontWeight: "560",
});

feature(`.${markdownStyles.skillReferenceCardTitleRow}`, {
  display: "flex",
  alignItems: "flex-start",
  gap: "8px",
});

feature(`.${markdownStyles.skillReferenceCardTitle}`, {
  color: "var(--ds-text-strong)",
  fontSize: "var(--font-size-meta)",
  fontWeight: "680",
  lineHeight: "var(--line-height-135)",
});

feature(`.${markdownStyles.skillReferenceCardDescription}`, {
  color: "var(--ds-text-muted)",
  fontSize: "var(--font-size-fine)",
  lineHeight: "var(--line-height-155)",
});

feature(`.${markdownStyles.skillReferenceCardMeta}`, {
  display: "flex",
  alignItems: "center",
  flexWrap: "wrap",
  gap: "6px",
});

feature(`.${markdownStyles.skillReferenceCardMetaChip}`, {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  minHeight: "18px",
  padding: "1px 7px",
  borderRadius: "999px",
  border: "1px solid color-mix(in srgb, var(--ds-border-subtle) 62%, transparent)",
  background: "color-mix(in srgb, var(--ds-surface-card-base) 78%, transparent)",
  color: "var(--ds-text-subtle)",
  fontSize: "var(--font-size-micro)",
  fontWeight: "560",
});

feature(`.${markdownStyles.skillReferenceCardMetaChipWarning}`, {
  borderColor: "color-mix(in srgb, var(--status-warning) 28%, var(--ds-border-subtle))",
  background: "color-mix(in srgb, var(--status-warning) 10%, transparent)",
  color: "color-mix(in srgb, var(--status-warning) 72%, var(--ds-text-strong))",
});
