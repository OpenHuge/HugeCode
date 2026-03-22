import { keyframes, style, styleVariants } from "@vanilla-extract/css";
import { componentThemeVars } from "../themeSemantics";
import { spacing, zIndex } from "../tokens";
import { typographyStyles } from "../semanticPrimitives.css";

function dsVar(name: string, fallback: string) {
  return `var(${name}, ${fallback})`;
}

const fadeIn = keyframes({
  from: { opacity: 0, transform: "var(--ds-tooltip-transform-hidden)" },
  to: { opacity: 1, transform: "var(--ds-tooltip-transform-visible)" },
});

export const root = style({
  position: "relative",
  display: "inline-flex",
  width: "fit-content",
  verticalAlign: "middle",
});

export const content = style([
  typographyStyles.micro,
  {
    position: "absolute",
    zIndex: zIndex.tooltip,
    maxWidth: "min(20rem, calc(100vw - 24px))",
    padding: dsVar("--ds-tooltip-padding", componentThemeVars.tooltip.padding),
    borderRadius: dsVar("--ds-tooltip-radius", componentThemeVars.tooltip.radius),
    border: `1px solid ${dsVar("--ds-tooltip-border", componentThemeVars.tooltip.border)}`,
    background: dsVar("--ds-tooltip-surface", componentThemeVars.tooltip.background),
    color: dsVar("--ds-tooltip-foreground", componentThemeVars.tooltip.foreground),
    boxShadow: dsVar("--ds-tooltip-shadow", componentThemeVars.tooltip.shadow),
    lineHeight: "var(--line-height-120)",
    whiteSpace: "nowrap",
    pointerEvents: "none",
    animation: `${fadeIn} var(--duration-fast) var(--ease-smooth)`,
  },
]);

export const side = styleVariants({
  top: {
    left: "50%",
    bottom: `calc(100% + ${componentThemeVars.tooltip.offset})`,
    vars: {
      "--ds-tooltip-transform-hidden": "translateX(-50%) translateY(4px)",
      "--ds-tooltip-transform-visible": "translateX(-50%) translateY(0)",
    },
    transform: "var(--ds-tooltip-transform-visible)",
  },
  bottom: {
    left: "50%",
    top: `calc(100% + ${componentThemeVars.tooltip.offset})`,
    vars: {
      "--ds-tooltip-transform-hidden": "translateX(-50%) translateY(-4px)",
      "--ds-tooltip-transform-visible": "translateX(-50%) translateY(0)",
    },
    transform: "var(--ds-tooltip-transform-visible)",
  },
  left: {
    right: `calc(100% + ${componentThemeVars.tooltip.offset})`,
    top: "50%",
    vars: {
      "--ds-tooltip-transform-hidden": "translateX(4px) translateY(-50%)",
      "--ds-tooltip-transform-visible": "translateX(0) translateY(-50%)",
    },
    transform: "var(--ds-tooltip-transform-visible)",
  },
  right: {
    left: `calc(100% + ${componentThemeVars.tooltip.offset})`,
    top: "50%",
    vars: {
      "--ds-tooltip-transform-hidden": "translateX(-4px) translateY(-50%)",
      "--ds-tooltip-transform-visible": "translateX(0) translateY(-50%)",
    },
    transform: "var(--ds-tooltip-transform-visible)",
  },
});

export const arrow = style({
  position: "absolute",
  width: componentThemeVars.tooltip.arrowSize,
  height: componentThemeVars.tooltip.arrowSize,
  borderRadius: "2px",
  background: dsVar("--ds-tooltip-surface", componentThemeVars.tooltip.background),
  border: `1px solid ${dsVar("--ds-tooltip-border", componentThemeVars.tooltip.border)}`,
  pointerEvents: "none",
  transform: "rotate(45deg)",
  zIndex: zIndex.tooltip,
});

export const arrowSide = styleVariants({
  top: {
    left: "50%",
    bottom: `calc(100% + ${spacing[1]})`,
    marginLeft: `-${spacing[1]}`,
    borderRight: "none",
    borderBottom: "none",
  },
  bottom: {
    left: "50%",
    top: `calc(100% + ${spacing[1]})`,
    marginLeft: `-${spacing[1]}`,
    borderLeft: "none",
    borderTop: "none",
  },
  left: {
    right: `calc(100% + ${spacing[1]})`,
    top: "50%",
    marginTop: `-${spacing[1]}`,
    borderLeft: "none",
    borderBottom: "none",
  },
  right: {
    left: `calc(100% + ${spacing[1]})`,
    top: "50%",
    marginTop: `-${spacing[1]}`,
    borderRight: "none",
    borderTop: "none",
  },
});
