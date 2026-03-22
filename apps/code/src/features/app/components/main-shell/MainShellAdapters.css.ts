import { style } from "@vanilla-extract/css";
import { focusRingStyles, motionStyles, typographyStyles } from "@ku0/design-system";

export const chromePill = style([
  typographyStyles.micro,
  motionStyles.interactive,
  focusRingStyles.button,
  {
    display: "inline-flex",
    alignItems: "center",
    gap: "8px",
    minHeight: "28px",
    minWidth: 0,
    maxWidth: "100%",
    padding: "0 10px",
    borderRadius: "999px",
    border: "1px solid transparent",
    background: "color-mix(in srgb, var(--ds-surface-item) 88%, transparent)",
    boxShadow: "none",
    color: "var(--ds-text-muted)",
    fontWeight: 600,
    letterSpacing: "0.01em",
    whiteSpace: "nowrap",
    cursor: "pointer",
    selectors: {
      "&:hover:not(:disabled), &:focus-visible": {
        borderColor: "color-mix(in srgb, var(--ds-border-subtle) 32%, transparent)",
        background: "color-mix(in srgb, var(--ds-surface-hover) 74%, var(--ds-surface-item))",
        color: "var(--ds-text-strong)",
      },
      '&[data-active="true"]': {
        background: "color-mix(in srgb, var(--ds-surface-hover) 78%, var(--ds-surface-item))",
        borderColor: "color-mix(in srgb, var(--ds-border-subtle) 38%, transparent)",
        color: "var(--ds-text-strong)",
      },
      "&:focus-visible": {
        outlineColor: "color-mix(in srgb, var(--ds-focus-ring) 72%, transparent)",
      },
      "&:disabled": {
        opacity: 0.56,
        cursor: "default",
      },
    },
  },
]);

export const chromePillLeading = style({
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  flexShrink: 0,
  color: "inherit",
});

export const chromePillLabel = style({
  minWidth: 0,
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
});

export const chromePillMeta = style({
  flexShrink: 0,
  color: "var(--ds-text-faint)",
  fontVariantNumeric: "tabular-nums",
});

export const chromePillTrailing = style({
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  flexShrink: 0,
  color: "var(--ds-text-faint)",
});

export const headerAction = style([
  typographyStyles.meta,
  motionStyles.interactive,
  focusRingStyles.button,
  {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: "6px",
    minWidth: 0,
    flexShrink: 0,
    height: "var(--shell-chrome-compact-control-size)",
    padding: "0 10px",
    border: "1px solid transparent",
    borderRadius: "var(--shell-chrome-compact-control-radius)",
    background: "transparent",
    boxShadow: "none",
    color: "var(--ds-text-muted)",
    fontWeight: 600,
    cursor: "pointer",
    selectors: {
      "&:hover:not(:disabled), &:focus-visible": {
        background: "var(--ds-shell-control-bg-hover)",
        borderColor: "color-mix(in srgb, var(--ds-border-subtle) 24%, transparent)",
        color: "var(--ds-text-stronger)",
        transform: "none",
        boxShadow: "none",
      },
      '&[data-active="true"]': {
        color: "var(--ds-text-stronger)",
        background: "transparent",
        boxShadow: "none",
      },
      "&:focus-visible": {
        outlineColor: "color-mix(in srgb, var(--ds-focus-ring) 72%, transparent)",
      },
      "&:disabled": {
        opacity: 0.5,
        cursor: "not-allowed",
      },
      '&[data-segment="leading"]': {
        borderTopRightRadius: 0,
        borderBottomRightRadius: 0,
        paddingRight: "8px",
      },
      '&[data-segment="trailing"]': {
        width: "var(--shell-chrome-compact-control-size)",
        paddingInline: 0,
      },
      '&[data-segment="icon"], &[data-icon-only="true"]': {
        width: "var(--shell-chrome-compact-control-size)",
        paddingInline: 0,
      },
    },
  },
]);

export const headerActionLabel = style({
  display: "inline-flex",
  alignItems: "center",
  gap: "6px",
  minWidth: 0,
});

export const headerActionIcon = style({
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  flexShrink: 0,
  width: "16px",
  height: "16px",
});

export const headerActionCopyStack = style({
  position: "relative",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  width: "16px",
  height: "16px",
});

export const headerActionCopyGlyph = style({
  position: "absolute",
  inset: 0,
  opacity: 1,
  transform: "scale(1)",
  transition:
    "opacity var(--duration-fast) var(--ease-smooth), transform var(--duration-fast) var(--ease-smooth)",
});

export const headerActionCheckGlyph = style([
  headerActionCopyGlyph,
  {
    opacity: 0,
    transform: "scale(0.82)",
  },
]);

export const headerActionCopyGlyphHidden = style({
  opacity: 0,
  transform: "scale(0.82)",
});

export const headerActionCheckGlyphVisible = style({
  opacity: 1,
  transform: "scale(1)",
});

export const menuSection = style({
  display: "flex",
  flexDirection: "column",
  gap: "8px",
  padding: "8px 6px 6px",
});

export const menuSectionHeader = style({
  display: "flex",
  alignItems: "flex-start",
  justifyContent: "space-between",
  gap: "10px",
  padding: "0 6px",
});

export const menuSectionHeading = style({
  display: "flex",
  flexDirection: "column",
  gap: "3px",
  minWidth: 0,
});

export const menuSectionLabel = style({
  fontSize: "var(--font-size-fine)",
  fontWeight: 600,
  color: "var(--ds-text-faint)",
  textTransform: "uppercase",
  letterSpacing: "0.06em",
});

export const menuSectionDescription = style([
  typographyStyles.micro,
  {
    color: "var(--ds-text-muted)",
  },
]);

export const menuSectionBody = style({
  display: "flex",
  flexDirection: "column",
  gap: "8px",
});

export const supportMeta = style([
  typographyStyles.fine,
  {
    display: "inline-flex",
    alignItems: "center",
    gap: "6px",
    maxWidth: "100%",
    minHeight: "24px",
    padding: "0 8px",
    borderRadius: "999px",
    background: "color-mix(in srgb, var(--ds-surface-muted) 84%, transparent)",
    color: "var(--ds-text-muted)",
    fontWeight: 600,
  },
]);

export const supportMetaIcon = style({
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  flexShrink: 0,
});

export const supportMetaLabel = style({
  minWidth: 0,
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
});
