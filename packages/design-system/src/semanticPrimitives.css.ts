import { globalStyle, style } from "@vanilla-extract/css";
import {
  elevationValues,
  focusRingValues,
  motionValues,
  typographyValues,
} from "./semanticPrimitives";

const rootSemanticVars = {
  "--focus-ring-button": "2px solid color-mix(in srgb, var(--color-ring) 62%, transparent)",
  "--focus-ring-input": "2px solid color-mix(in srgb, var(--color-ring) 48%, transparent)",
  "--focus-ring-overlay":
    "2px solid color-mix(in srgb, var(--color-border-strong) 44%, transparent)",
  "--elevation-card": "var(--shadow-xs)",
  "--elevation-panel": "var(--shadow-sm)",
  "--elevation-floating": "var(--shadow-md)",
  "--elevation-overlay": "var(--shadow-lg)",
} as const;

globalStyle(":root", rootSemanticVars as unknown as import("@vanilla-extract/css").GlobalStyleRule);

function textStyle(fontSizeVar: string, lineHeightVar: string, fontWeight?: string) {
  return style({
    fontSize: fontSizeVar,
    lineHeight: lineHeightVar,
    ...(fontWeight ? { fontWeight } : {}),
  });
}

export const typographyStyles = {
  nano: textStyle(typographyValues.nano.fontSize, typographyValues.nano.lineHeight),
  tiny: textStyle(typographyValues.tiny.fontSize, typographyValues.tiny.lineHeight),
  micro: textStyle(typographyValues.micro.fontSize, typographyValues.micro.lineHeight),
  fine: textStyle(typographyValues.fine.fontSize, typographyValues.fine.lineHeight),
  label: textStyle(typographyValues.label.fontSize, typographyValues.label.lineHeight),
  meta: textStyle(typographyValues.meta.fontSize, typographyValues.meta.lineHeight),
  ui: textStyle(typographyValues.ui.fontSize, typographyValues.ui.lineHeight),
  chrome: textStyle(
    typographyValues.chrome.fontSize,
    typographyValues.chrome.lineHeight,
    typographyValues.chrome.fontWeight
  ),
  chat: textStyle(typographyValues.chat.fontSize, typographyValues.chat.lineHeight),
  content: textStyle(typographyValues.content.fontSize, typographyValues.content.lineHeight),
  title: textStyle(typographyValues.title.fontSize, typographyValues.title.lineHeight),
  titleLg: textStyle(typographyValues.titleLg.fontSize, typographyValues.titleLg.lineHeight),
  displaySm: textStyle(typographyValues.displaySm.fontSize, typographyValues.displaySm.lineHeight),
  display: textStyle(typographyValues.display.fontSize, typographyValues.display.lineHeight),
  displayLg: textStyle(typographyValues.displayLg.fontSize, typographyValues.displayLg.lineHeight),
} as const;

export const motionStyles = {
  interactive: style({
    transition: motionValues.interactive,
  }),
  enter: style({
    transition: motionValues.enter,
  }),
  exit: style({
    transition: motionValues.exit,
  }),
  press: style({
    transition: motionValues.press,
  }),
} as const;

export const elevationStyles = {
  card: style({ boxShadow: elevationValues.card }),
  panel: style({ boxShadow: elevationValues.panel }),
  floating: style({ boxShadow: elevationValues.floating }),
  overlay: style({ boxShadow: elevationValues.overlay }),
  none: style({ boxShadow: elevationValues.none }),
} as const;

export const focusRingStyles = {
  button: style({
    selectors: {
      "&:focus-visible": {
        outline: focusRingValues.button,
        outlineOffset: "2px",
      },
    },
  }),
  input: style({
    selectors: {
      "&:focus-visible": {
        outline: focusRingValues.input,
        outlineOffset: "2px",
      },
    },
  }),
  overlay: style({
    selectors: {
      "&:focus-visible": {
        outline: focusRingValues.overlay,
        outlineOffset: "2px",
      },
    },
  }),
} as const;
