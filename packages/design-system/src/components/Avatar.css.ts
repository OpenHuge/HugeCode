import { style, styleVariants } from "@vanilla-extract/css";
import { componentThemeVars } from "../themeSemantics";
import { typographyStyles } from "../semanticPrimitives.css";

function dsVar(name: string, fallback: string) {
  return `var(${name}, ${fallback})`;
}

export const root = style([
  typographyStyles.label,
  {
    position: "relative",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    flexShrink: 0,
    border: `1px solid ${dsVar("--ds-avatar-border", componentThemeVars.avatar.border)}`,
    background: dsVar("--ds-avatar-surface", componentThemeVars.avatar.background),
    color: dsVar("--ds-avatar-foreground", componentThemeVars.avatar.foreground),
    fontWeight: 600,
    lineHeight: "var(--line-height-100)",
    letterSpacing: "0.02em",
  },
]);

export const size = styleVariants({
  sm: {
    width: dsVar("--ds-avatar-size-sm", componentThemeVars.avatar.size.sm),
    height: dsVar("--ds-avatar-size-sm", componentThemeVars.avatar.size.sm),
    fontSize: "var(--font-size-meta)",
  },
  md: {
    width: dsVar("--ds-avatar-size-md", componentThemeVars.avatar.size.md),
    height: dsVar("--ds-avatar-size-md", componentThemeVars.avatar.size.md),
    fontSize: "var(--font-size-fine)",
  },
  lg: {
    width: dsVar("--ds-avatar-size-lg", componentThemeVars.avatar.size.lg),
    height: dsVar("--ds-avatar-size-lg", componentThemeVars.avatar.size.lg),
    fontSize: "var(--font-size-chrome)",
  },
});

export const shape = styleVariants({
  circle: {
    borderRadius: dsVar("--ds-avatar-radius-circle", componentThemeVars.avatar.radius.circle),
  },
  rounded: {
    borderRadius: dsVar("--ds-avatar-radius-rounded", componentThemeVars.avatar.radius.rounded),
  },
});

export const image = style({
  width: "100%",
  height: "100%",
  objectFit: "cover",
});

export const fallback = style({
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  width: "100%",
  height: "100%",
});
