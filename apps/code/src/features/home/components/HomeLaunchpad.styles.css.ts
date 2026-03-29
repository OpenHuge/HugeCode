import { style } from "@vanilla-extract/css";
import { motionValues, typographyValues } from "@ku0/design-system";
import { layers } from "../../../styles/system/layers.css";

export const intro = style({
  "@layer": {
    [layers.features]: {
      display: "flex",
      flexDirection: "column",
      alignItems: "stretch",
      justifyContent: "flex-start",
      gap: "16px",
      width: "100%",
      minHeight: "auto",
      padding: "24px 20px 12px",
      maxWidth: "920px",
      position: "relative",
      "@media": {
        "(max-width: 640px)": {
          minHeight: "auto",
          padding: "16px 12px 8px",
          gap: "10px",
          justifyContent: "flex-start",
        },
      },
    },
  },
});

export const introHeader = style({
  "@layer": {
    [layers.features]: {
      width: "100%",
      display: "grid",
      gap: "14px",
      paddingBottom: "14px",
      borderBottom: "1px solid color-mix(in srgb, var(--ds-border-subtle) 72%, transparent)",
    },
  },
});

export const introCopy = style({
  "@layer": {
    [layers.features]: {
      display: "grid",
      gap: "8px",
      width: "100%",
      maxWidth: "680px",
    },
  },
});

export const heroStatusRow = style({
  "@layer": {
    [layers.features]: {
      display: "flex",
      alignItems: "flex-start",
      justifyContent: "space-between",
      gap: "10px",
      flexWrap: "wrap",
    },
  },
});

export const heroStatusActions = style({
  "@layer": {
    [layers.features]: {
      display: "flex",
      alignItems: "center",
      gap: "8px",
      flexWrap: "wrap",
    },
  },
});

export const heroMeta = style({
  "@layer": {
    [layers.features]: {
      width: "100%",
      display: "grid",
      gridTemplateColumns: "minmax(0, 1fr)",
      gap: "10px",
      alignItems: "start",
    },
  },
});

export const heroMetaPanel = style({
  "@layer": {
    [layers.features]: {
      display: "flex",
      flexDirection: "column",
      gap: "12px",
      minHeight: "0",
      "@media": {
        "(max-width: 640px)": {
          minHeight: "0",
        },
      },
    },
  },
});

export const heroMetaHeader = style({
  "@layer": {
    [layers.features]: {
      alignItems: "center",
    },
  },
});

export const heroMetaEyebrow = style({
  "@layer": {
    [layers.features]: {
      fontSize: typographyValues.micro.fontSize,
      lineHeight: typographyValues.micro.lineHeight,
      fontWeight: 650,
      letterSpacing: "0.1em",
      textTransform: "uppercase",
      color: "var(--ds-text-faint)",
    },
  },
});

export const heroMetaValue = style({
  "@layer": {
    [layers.features]: {
      fontSize: "clamp(18px, 1.7vw, 22px)",
      lineHeight: typographyValues.titleLg.lineHeight,
      letterSpacing: "-0.03em",
      fontWeight: 630,
      color: "var(--ds-text-stronger)",
      textTransform: "none",
      textWrap: "pretty",
    },
  },
});

export const heroMetaDetail = style({
  "@layer": {
    [layers.features]: {
      maxWidth: "58ch",
      fontSize: typographyValues.fine.fontSize,
      lineHeight: typographyValues.fine.lineHeight,
      color: "var(--ds-text-subtle)",
      textWrap: "pretty",
    },
  },
});

export const heroMetaBody = style({
  "@layer": {
    [layers.features]: {
      display: "grid",
      gap: "14px",
      minWidth: 0,
    },
  },
});

export const heroPlacement = style({
  "@layer": {
    [layers.features]: {
      display: "grid",
      gap: "4px",
      minWidth: 0,
      paddingTop: "12px",
      borderTop: "1px solid color-mix(in srgb, var(--ds-border-subtle) 74%, transparent)",
    },
  },
});

export const heroPlacementWarning = style({
  "@layer": {
    [layers.features]: {
      borderTopColor: "color-mix(in srgb, var(--color-status-warning) 38%, transparent)",
    },
  },
});

export const heroPlacementLabel = style({
  "@layer": {
    [layers.features]: {
      fontSize: typographyValues.micro.fontSize,
      lineHeight: typographyValues.micro.lineHeight,
      fontWeight: 650,
      letterSpacing: "0.08em",
      textTransform: "uppercase",
      color: "var(--ds-text-faint)",
    },
  },
});

export const heroPlacementValue = style({
  "@layer": {
    [layers.features]: {
      fontSize: typographyValues.fine.fontSize,
      lineHeight: typographyValues.fine.lineHeight,
      fontWeight: 560,
      color: "var(--ds-text-strong)",
      textWrap: "pretty",
    },
  },
});

export const heroPlacementDetail = style({
  "@layer": {
    [layers.features]: {
      fontSize: typographyValues.micro.fontSize,
      lineHeight: typographyValues.micro.lineHeight,
      color: "var(--ds-text-muted)",
      textWrap: "pretty",
    },
  },
});

export const eyebrow = style({
  "@layer": {
    [layers.features]: {
      display: "inline-flex",
      alignItems: "center",
      color: "var(--ds-text-faint)",
      fontSize: typographyValues.micro.fontSize,
      lineHeight: typographyValues.micro.lineHeight,
      fontWeight: "650",
      letterSpacing: "0.1em",
      textTransform: "uppercase",
    },
  },
});

export const headline = style({
  "@layer": {
    [layers.features]: {
      margin: 0,
      textAlign: "left",
      maxWidth: "12ch",
      "@media": {
        "(max-width: 640px)": {
          fontSize: "clamp(28px, 8.2vw, 36px)",
          letterSpacing: "-0.045em",
          fontWeight: "640",
          lineHeight: typographyValues.displaySm.lineHeight,
        },
        "(min-width: 641px)": {
          fontSize: "clamp(34px, 3vw, 44px)",
          fontWeight: "640",
          lineHeight: typographyValues.display.lineHeight,
          letterSpacing: "-0.055em",
          color: "var(--ds-text-stronger)",
        },
      },
    },
  },
});

export const subtitle = style({
  "@layer": {
    [layers.features]: {
      maxWidth: "52ch",
      margin: 0,
      textAlign: "left",
      color: "var(--ds-text-subtle)",
      fontSize: typographyValues.meta.fontSize,
      lineHeight: typographyValues.content.lineHeight,
      textWrap: "pretty",
      "@media": {
        "(max-width: 640px)": {
          fontSize: typographyValues.meta.fontSize,
          lineHeight: typographyValues.content.lineHeight,
        },
      },
    },
  },
});

export const starterSection = style({
  "@layer": {
    [layers.features]: {
      display: "flex",
      flexDirection: "column",
      gap: "0",
      minHeight: "0",
      paddingTop: "0",
    },
  },
});

export const starterSectionTitle = style({
  "@layer": {
    [layers.features]: {
      fontSize: typographyValues.meta.fontSize,
      lineHeight: typographyValues.meta.lineHeight,
      fontWeight: 620,
    },
  },
});

export const starterSectionMeta = style({
  "@layer": {
    [layers.features]: {
      fontSize: typographyValues.fine.fontSize,
      lineHeight: typographyValues.fine.lineHeight,
      color: "var(--ds-text-faint)",
    },
  },
});

export const starterGrid = style({
  "@layer": {
    [layers.features]: {
      display: "grid",
      gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
      gridAutoRows: "1fr",
      alignItems: "stretch",
      gap: "10px",
      width: "100%",
      "@media": {
        "(max-width: 1180px)": {
          gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
        },
        "(max-width: 640px)": {
          gridTemplateColumns: "none",
          gridAutoFlow: "column",
          gridAutoColumns: "minmax(240px, 80vw)",
          gap: "10px",
          overflowX: "auto",
          overflowY: "hidden",
          scrollSnapType: "x proximity",
          scrollPaddingInline: "16px",
          paddingBottom: "4px",
          marginInline: "-16px",
          paddingInline: "16px",
          width: "calc(100% + 32px)",
          selectors: {
            "&::-webkit-scrollbar": {
              display: "none",
            },
          },
        },
      },
    },
  },
});

export const starterCardButton = style({
  "@layer": {
    [layers.features]: {
      appearance: "none",
      WebkitAppearance: "none",
      border: "none",
      background: "transparent",
      padding: "0",
      margin: "0",
      font: "inherit",
      color: "inherit",
      textAlign: "inherit",
      display: "block",
      width: "100%",
      "@media": {
        "(max-width: 640px)": {
          scrollSnapAlign: "start",
        },
      },
    },
  },
});

export const starterCard = style({
  "@layer": {
    [layers.features]: {
      display: "flex",
      flexDirection: "column",
      alignItems: "flex-start",
      justifyContent: "flex-start",
      gap: "8px",
      height: "auto",
      minHeight: "80px",
      textAlign: "left",
      borderRadius: "14px",
      border: "1px solid color-mix(in srgb, var(--ds-border-default) 76%, transparent)",
      background: "var(--ds-surface-card)",
      boxShadow:
        "0 1px 2px color-mix(in srgb, var(--ds-shadow-color, rgba(0,0,0,0.1)) 8%, transparent)",
      transition: motionValues.interactive,
      cursor: "pointer",
      selectors: {
        "&:hover, &[data-selected='true']": {
          transform: "translateY(-1px)",
          borderColor: "color-mix(in srgb, var(--ds-border-strong) 70%, transparent)",
          background: "var(--ds-surface-elevated)",
          boxShadow:
            "0 4px 12px color-mix(in srgb, var(--ds-shadow-color, rgba(0,0,0,0.1)) 14%, transparent), 0 1px 3px color-mix(in srgb, var(--ds-shadow-color, rgba(0,0,0,0.1)) 8%, transparent)",
        },
        "&:active": {
          transform: "translateY(0) scale(0.985)",
          boxShadow:
            "0 1px 2px color-mix(in srgb, var(--ds-shadow-color, rgba(0,0,0,0.1)) 8%, transparent)",
        },
      },
      "@media": {
        "(max-width: 640px)": {
          minHeight: "56px",
          gap: "6px",
          flexDirection: "row",
          alignItems: "flex-start",
        },
      },
    },
  },
});

export const starterIcon = style({
  "@layer": {
    [layers.features]: {
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      color: "var(--ds-text-strong)",
      background: "color-mix(in srgb, var(--ds-surface-item) 94%, transparent)",
      width: "34px",
      height: "34px",
      borderRadius: "12px",
      transition: motionValues.interactive,
      selectors: {
        [`${starterCard}:hover &`]: {
          color: "var(--ds-brand-primary)",
          background: "color-mix(in srgb, var(--ds-brand-primary) 14%, var(--ds-surface-item))",
        },
      },
      "@media": {
        "(max-width: 640px)": {
          width: "28px",
          height: "28px",
          flexShrink: "0",
        },
      },
    },
  },
});

export const starterIconGlyph = style({
  "@layer": {
    [layers.features]: {
      "@media": {
        "(max-width: 640px)": {
          width: "16px",
          height: "16px",
        },
      },
    },
  },
});

export const starterLabel = style({
  "@layer": {
    [layers.features]: {
      lineHeight: typographyValues.label.lineHeight,
      textAlign: "left",
      "@media": {
        "(max-width: 640px)": {
          textAlign: "left",
        },
      },
    },
  },
});

export const starterTitle = style({
  "@layer": {
    [layers.features]: {
      fontSize: "var(--font-size-label)",
      fontWeight: 600,
      color: "var(--ds-text-stronger)",
      marginBottom: "4px",
    },
  },
});

export const starterCopy = style({
  "@layer": {
    [layers.features]: {
      display: "flex",
      alignItems: "flex-start",
      width: "100%",
      minWidth: 0,
      flex: "1",
    },
  },
});

export const starterDescription = style({
  "@layer": {
    [layers.features]: {
      textWrap: "pretty",
      display: "-webkit-box",
      overflow: "hidden",
      WebkitBoxOrient: "vertical",
      WebkitLineClamp: "2",
      "@media": {
        "(max-width: 640px)": {
          display: "none",
        },
      },
    },
  },
});

export const composer = style({
  "@layer": {
    [layers.features]: {
      width: "100%",
      "@media": {
        "(max-width: 640px)": {
          minHeight: "48px",
          fontSize: "var(--font-size-label)",
          padding: "0",
        },
      },
    },
  },
});
