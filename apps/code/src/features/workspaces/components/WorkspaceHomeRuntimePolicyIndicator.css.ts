import { type StyleRule, style } from "@vanilla-extract/css";
import {
  borderRadius,
  boxShadow,
  fontSize,
  fontWeight,
  semanticColors,
  spacing,
} from "@ku0/design-system";
import { layers } from "../../../styles/system/layers.css";

function feature(rule: StyleRule) {
  return style({ "@layer": { [layers.features]: rule } });
}

export const surface = feature({
  display: "grid",
  gap: spacing[3],
});

export const summary = feature({
  display: "grid",
  gap: spacing[1.5],
  padding: spacing[3],
  borderRadius: borderRadius.md,
  border: `1px solid color-mix(in srgb, ${semanticColors.border} 72%, transparent)`,
  background: `linear-gradient(180deg, color-mix(in srgb, ${semanticColors.surface1} 92%, transparent), color-mix(in srgb, ${semanticColors.surface0} 96%, transparent))`,
  boxShadow: boxShadow.xs,
});

export const summaryTitle = feature({
  margin: 0,
  fontSize: fontSize.meta[0],
  lineHeight: fontSize.meta[1].lineHeight,
  fontWeight: fontWeight.semibold,
  color: semanticColors.foreground,
});

export const summaryText = feature({
  fontSize: fontSize.fine[0],
  lineHeight: fontSize.fine[1].lineHeight,
  color: semanticColors.mutedForeground,
});

export const summaryMeta = feature({
  display: "flex",
  flexWrap: "wrap",
  gap: spacing[2],
  fontSize: fontSize.fine[0],
  lineHeight: fontSize.fine[1].lineHeight,
  color: semanticColors.mutedForeground,
});

export const capabilityList = feature({
  display: "grid",
  gap: spacing[2],
});

export const capabilityCard = feature({
  display: "grid",
  gap: spacing[1.5],
  padding: spacing[3],
  borderRadius: borderRadius.md,
  border: `1px solid color-mix(in srgb, ${semanticColors.border} 68%, transparent)`,
  background: `color-mix(in srgb, ${semanticColors.surface0} 94%, transparent)`,
});

export const capabilityHeader = feature({
  display: "flex",
  alignItems: "flex-start",
  justifyContent: "space-between",
  gap: spacing[2],
});

export const capabilityLabel = feature({
  margin: 0,
  fontSize: fontSize.meta[0],
  lineHeight: fontSize.meta[1].lineHeight,
  fontWeight: fontWeight.semibold,
  color: semanticColors.foreground,
});

export const capabilitySignals = feature({
  display: "flex",
  flexWrap: "wrap",
  justifyContent: "flex-end",
  gap: spacing[1.5],
});

export const capabilityText = feature({
  fontSize: fontSize.fine[0],
  lineHeight: fontSize.fine[1].lineHeight,
  color: semanticColors.mutedForeground,
});
