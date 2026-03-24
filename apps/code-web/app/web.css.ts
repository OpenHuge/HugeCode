import {
  elevationValues,
  motionValues,
  semanticThemeVars,
  typographyValues,
} from "@ku0/design-system";
import { globalStyle, style } from "@vanilla-extract/css";

const appBackground = [
  `radial-gradient(circle at top left, color-mix(in srgb, ${semanticThemeVars.color.state.running} 16%, transparent), transparent 24%)`,
  `radial-gradient(circle at top right, color-mix(in srgb, ${semanticThemeVars.color.state.success} 10%, transparent), transparent 18%)`,
  `linear-gradient(180deg, color-mix(in srgb, ${semanticThemeVars.color.bg.canvas} 84%, ${semanticThemeVars.color.bg.app} 16%) 0%, color-mix(in srgb, ${semanticThemeVars.color.bg.app} 88%, ${semanticThemeVars.color.bg.card} 12%) 40%, color-mix(in srgb, ${semanticThemeVars.color.bg.app} 94%, ${semanticThemeVars.color.bg.card} 6%) 100%)`,
].join(", ");
const surfaceBorder = `1px solid color-mix(in srgb, ${semanticThemeVars.color.border.default} 42%, transparent)`;
const accentBorder = `1px solid color-mix(in srgb, ${semanticThemeVars.color.border.focus} 42%, transparent)`;
const surfaceGlass = `color-mix(in srgb, ${semanticThemeVars.color.bg.elevated} 78%, transparent)`;
const surfaceGlassStrong = `color-mix(in srgb, ${semanticThemeVars.color.bg.elevated} 90%, ${semanticThemeVars.color.bg.app} 10%)`;
const surfaceMuted = `color-mix(in srgb, ${semanticThemeVars.color.bg.card} 76%, transparent)`;
const surfaceInset = `color-mix(in srgb, ${semanticThemeVars.color.bg.inset} 74%, transparent)`;
const strongText = semanticThemeVars.color.text.primary;
const mutedText = `color-mix(in srgb, ${semanticThemeVars.color.text.secondary} 88%, transparent)`;
const faintText = `color-mix(in srgb, ${semanticThemeVars.color.text.secondary} 68%, transparent)`;
const accentGradient = `linear-gradient(135deg, color-mix(in srgb, ${semanticThemeVars.color.state.running} 88%, ${semanticThemeVars.color.bg.card} 12%), color-mix(in srgb, ${semanticThemeVars.color.state.success} 70%, ${semanticThemeVars.color.bg.card} 30%))`;
const titlebarInsetTop = "env(titlebar-area-height, 0px)";
const titlebarInsetLeft = "env(titlebar-area-x, 0px)";

export const documentBody = style({
  margin: 0,
  minHeight: "100vh",
  background: appBackground,
  color: strongText,
  fontFamily: semanticThemeVars.typography.font.ui,
});

export const routeViewport = style({
  minHeight: "100vh",
});

export const chromeContainer = style({
  minHeight: "100vh",
  width: "min(1120px, calc(100% - 40px))",
  margin: "0 auto",
  display: "grid",
  gap: "28px",
  padding: "20px 0 72px",
  selectors: {
    'html[data-pwa-display-mode="window-controls-overlay"] &': {
      paddingTop: `calc(${titlebarInsetTop} + 12px)`,
    },
  },
  "@media": {
    "(max-width: 960px)": {
      width: "min(100% - 24px, 1120px)",
      paddingTop: "12px",
    },
  },
});

export const chromeHeader = style({
  display: "flex",
  flexWrap: "wrap",
  alignItems: "center",
  justifyContent: "space-between",
  gap: "16px",
  padding: "14px 16px",
  borderRadius: "20px",
  border: surfaceBorder,
  background: surfaceGlass,
  backdropFilter: "blur(18px)",
  boxShadow: elevationValues.card,
  selectors: {
    'html[data-pwa-display-mode="window-controls-overlay"] &': {
      paddingLeft: `calc(16px + ${titlebarInsetLeft})`,
      minHeight: `calc(48px + ${titlebarInsetTop})`,
    },
  },
  "@media": {
    "(max-width: 720px)": {
      padding: "14px",
    },
  },
});

export const chromeBrand = style({
  display: "flex",
  alignItems: "center",
  gap: "12px",
  color: "inherit",
  textDecoration: "none",
});

export const chromeBrandMark = style({
  display: "grid",
  placeItems: "center",
  width: "36px",
  height: "36px",
  borderRadius: "12px",
  background: accentGradient,
  color: semanticThemeVars.color.text.inverse,
  fontSize: typographyValues.micro.fontSize,
  lineHeight: typographyValues.micro.lineHeight,
  fontWeight: 700,
  letterSpacing: "0.08em",
  textTransform: "uppercase",
});

export const chromeBrandMeta = style({
  display: "block",
  fontSize: typographyValues.micro.fontSize,
  lineHeight: typographyValues.micro.lineHeight,
  letterSpacing: "0.14em",
  textTransform: "uppercase",
  color: faintText,
});

export const chromeBrandName = style({
  display: "block",
  fontSize: typographyValues.ui.fontSize,
  lineHeight: typographyValues.ui.lineHeight,
  fontWeight: 600,
});

export const chromeNav = style({
  display: "flex",
  flexWrap: "wrap",
  alignItems: "center",
  justifyContent: "flex-end",
  gap: "10px",
});

export const chromeNavLink = style({
  display: "inline-flex",
  alignItems: "center",
  minHeight: "36px",
  padding: "0 12px",
  borderRadius: "999px",
  color: mutedText,
  textDecoration: "none",
  transition: motionValues.interactive,
});

export const chromeNavLinkActive = style([
  chromeNavLink,
  {
    background: surfaceMuted,
    color: strongText,
  },
]);

export const chromeStatusPill = style({
  display: "inline-flex",
  alignItems: "center",
  minHeight: "36px",
  padding: "0 12px",
  borderRadius: "999px",
  border: surfaceBorder,
  background: surfaceInset,
  color: faintText,
  fontSize: typographyValues.chrome.fontSize,
  lineHeight: typographyValues.chrome.lineHeight,
});

export const heroSplit = style({
  display: "grid",
  gridTemplateColumns: "minmax(0, 1.45fr) minmax(300px, 0.95fr)",
  gap: "20px",
  "@media": {
    "(max-width: 960px)": {
      gridTemplateColumns: "1fr",
    },
  },
});

export const heroCard = style({
  display: "grid",
  gap: "18px",
  padding: "32px",
  borderRadius: "28px",
  border: surfaceBorder,
  background: `linear-gradient(180deg, color-mix(in srgb, ${semanticThemeVars.color.bg.elevated} 96%, ${semanticThemeVars.color.bg.card} 4%), color-mix(in srgb, ${semanticThemeVars.color.bg.app} 90%, ${semanticThemeVars.color.bg.card} 10%))`,
  boxShadow: elevationValues.overlay,
  backdropFilter: "blur(18px)",
  "@media": {
    "(max-width: 720px)": {
      padding: "24px",
    },
  },
});

export const eyebrow = style({
  fontSize: typographyValues.fine.fontSize,
  lineHeight: typographyValues.fine.lineHeight,
  letterSpacing: "0.16em",
  textTransform: "uppercase",
  color: faintText,
});

export const heroTitle = style({
  margin: 0,
  fontSize: "clamp(2.7rem, 6vw, 4.9rem)",
  lineHeight: typographyValues.displayLg.lineHeight,
  letterSpacing: "-0.05em",
  "@media": {
    "(max-width: 720px)": {
      letterSpacing: "-0.04em",
    },
  },
});

export const heroCopy = style({
  margin: 0,
  maxWidth: "62ch",
  fontSize: typographyValues.content.fontSize,
  lineHeight: typographyValues.content.lineHeight,
  color: mutedText,
});

export const ctaRow = style({
  display: "flex",
  flexWrap: "wrap",
  gap: "12px",
});

export const primaryLink = style({
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  minHeight: "44px",
  padding: "0 18px",
  borderRadius: "999px",
  background: semanticThemeVars.color.text.primary,
  color: semanticThemeVars.color.text.inverse,
  fontSize: typographyValues.chrome.fontSize,
  lineHeight: typographyValues.chrome.lineHeight,
  fontWeight: 600,
  textDecoration: "none",
});

export const secondaryLink = style({
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  minHeight: "44px",
  padding: "0 18px",
  borderRadius: "999px",
  border: accentBorder,
  background: surfaceMuted,
  color: strongText,
  fontSize: typographyValues.chrome.fontSize,
  lineHeight: typographyValues.chrome.lineHeight,
  textDecoration: "none",
});

export const heroMetaGrid = style({
  display: "grid",
  gap: "14px",
});

export const heroMetaCard = style({
  display: "grid",
  gap: "8px",
  padding: "18px 18px 20px",
  borderRadius: "22px",
  border: surfaceBorder,
  background: surfaceGlassStrong,
});

export const heroMetaLabel = style({
  fontSize: typographyValues.micro.fontSize,
  lineHeight: typographyValues.micro.lineHeight,
  letterSpacing: "0.12em",
  textTransform: "uppercase",
  color: faintText,
});

export const heroMetaValue = style({
  fontSize: typographyValues.content.fontSize,
  lineHeight: typographyValues.content.lineHeight,
  fontWeight: 600,
});

export const heroMetaCopy = style({
  margin: 0,
  color: mutedText,
  lineHeight: typographyValues.content.lineHeight,
});

export const stackSection = style({
  display: "grid",
  gap: "18px",
});

export const stackSectionHeader = style({
  display: "grid",
  gap: "8px",
});

export const stackSectionEyebrow = style({
  fontSize: typographyValues.micro.fontSize,
  lineHeight: typographyValues.micro.lineHeight,
  letterSpacing: "0.14em",
  textTransform: "uppercase",
  color: faintText,
});

export const stackSectionTitle = style({
  margin: 0,
  fontSize: "clamp(1.4rem, 3vw, 2rem)",
  lineHeight: typographyValues.titleLg.lineHeight,
  letterSpacing: "-0.04em",
});

export const infoGrid = style({
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
  gap: "16px",
});

export const infoCard = style({
  display: "grid",
  gap: "10px",
  padding: "22px",
  borderRadius: "24px",
  background: surfaceMuted,
  border: surfaceBorder,
});

export const infoKicker = style({
  fontSize: typographyValues.micro.fontSize,
  lineHeight: typographyValues.micro.lineHeight,
  letterSpacing: "0.12em",
  textTransform: "uppercase",
  color: faintText,
});

export const infoTitle = style({
  margin: 0,
  fontSize: typographyValues.content.fontSize,
  lineHeight: typographyValues.content.lineHeight,
});

export const infoCopy = style({
  margin: 0,
  color: mutedText,
  lineHeight: typographyValues.content.lineHeight,
});

export const workspaceFallbackShell = style({
  minHeight: "100vh",
  display: "grid",
  placeItems: "center",
  padding: "24px",
});

export const workspaceFallbackCard = style({
  display: "grid",
  gap: "10px",
  width: "min(440px, 100%)",
  padding: "24px",
  borderRadius: "24px",
  background: surfaceGlassStrong,
  border: surfaceBorder,
  boxShadow: elevationValues.floating,
});

export const workspaceFallbackEyebrow = style({
  fontSize: typographyValues.micro.fontSize,
  lineHeight: typographyValues.micro.lineHeight,
  letterSpacing: "0.18em",
  textTransform: "uppercase",
  color: faintText,
});

export const workspaceFallbackTitle = style({
  fontSize: typographyValues.label.fontSize,
  lineHeight: typographyValues.label.lineHeight,
  fontWeight: 600,
});

export const workspaceFallbackDetail = style({
  color: mutedText,
  lineHeight: typographyValues.content.lineHeight,
});

export const aboutShell = style({
  display: "grid",
  gap: "18px",
});

export const aboutSubgrid = style({
  display: "grid",
  gridTemplateColumns: "minmax(0, 1.05fr) minmax(300px, 0.95fr)",
  gap: "20px",
  "@media": {
    "(max-width: 960px)": {
      gridTemplateColumns: "1fr",
    },
  },
});

export const aboutCard = style({
  display: "grid",
  gap: "18px",
  padding: "28px 28px 24px",
  borderRadius: "28px",
  border: surfaceBorder,
  background: surfaceGlass,
  boxShadow: elevationValues.floating,
  "@media": {
    "(max-width: 720px)": {
      padding: "22px",
    },
  },
});

export const aboutHeader = style({
  display: "flex",
  alignItems: "center",
  gap: "16px",
});

export const aboutIcon = style({
  width: "48px",
  height: "48px",
  borderRadius: "10px",
  background: surfaceInset,
  boxShadow: elevationValues.card,
});

export const aboutTitle = style({
  fontSize: "clamp(1.55rem, 4vw, 1.75rem)",
  lineHeight: typographyValues.titleLg.lineHeight,
  fontWeight: 700,
  letterSpacing: "-0.03em",
});

export const aboutVersion = style({
  color: faintText,
  fontSize: typographyValues.ui.fontSize,
  lineHeight: typographyValues.ui.lineHeight,
});

export const aboutSubtitle = style({
  margin: 0,
  maxWidth: "34ch",
  color: mutedText,
  lineHeight: typographyValues.content.lineHeight,
});

export const aboutMetaGrid = style({
  display: "grid",
  gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
  gap: "12px",
  "@media": {
    "(max-width: 720px)": {
      gridTemplateColumns: "1fr",
    },
  },
});

export const aboutMetaItem = style({
  display: "grid",
  gap: "6px",
  padding: "14px",
  borderRadius: "18px",
  border: surfaceBorder,
  background: surfaceMuted,
});

export const aboutMetaLabel = style({
  fontSize: typographyValues.micro.fontSize,
  lineHeight: typographyValues.micro.lineHeight,
  letterSpacing: "0.12em",
  textTransform: "uppercase",
  color: faintText,
});

export const aboutMetaValue = style({
  fontSize: typographyValues.ui.fontSize,
  lineHeight: typographyValues.ui.lineHeight,
  fontWeight: 600,
});

export const aboutLinkGroupTitle = style({
  marginBottom: "10px",
  fontSize: typographyValues.micro.fontSize,
  lineHeight: typographyValues.micro.lineHeight,
  letterSpacing: "0.12em",
  textTransform: "uppercase",
  color: faintText,
});

export const aboutLinkRow = style({
  display: "flex",
  flexWrap: "wrap",
  gap: "10px",
});

export const aboutLink = style({
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  minHeight: "40px",
  padding: "0 14px",
  borderRadius: "999px",
  border: accentBorder,
  color: strongText,
  fontSize: typographyValues.chrome.fontSize,
  lineHeight: typographyValues.chrome.lineHeight,
  textDecoration: "none",
  background: surfaceMuted,
});

export const aboutFooter = style({
  color: faintText,
  fontSize: typographyValues.fine.fontSize,
  lineHeight: typographyValues.fine.lineHeight,
});

export const aboutPrincipleList = style({
  display: "grid",
  gap: "12px",
});

export const aboutPrincipleItem = style({
  display: "grid",
  gap: "8px",
  padding: "18px",
  borderRadius: "22px",
  border: surfaceBorder,
  background: surfaceMuted,
});

export const aboutPrincipleTitle = style({
  margin: 0,
  fontSize: typographyValues.content.fontSize,
  lineHeight: typographyValues.content.lineHeight,
});

export const aboutPrincipleCopy = style({
  margin: 0,
  color: mutedText,
  lineHeight: typographyValues.content.lineHeight,
});

export const pwaBannerViewport = style({
  position: "fixed",
  right: "20px",
  bottom: "20px",
  zIndex: 20,
  display: "grid",
  gap: "12px",
  width: "min(420px, calc(100vw - 24px))",
  "@media": {
    "(max-width: 720px)": {
      right: "12px",
      bottom: "12px",
      width: "min(100vw - 24px, 420px)",
    },
  },
});

export const pwaBannerCard = style({
  display: "grid",
  gap: "12px",
  padding: "18px",
  borderRadius: "22px",
  border: accentBorder,
  background: surfaceGlassStrong,
  boxShadow: elevationValues.overlay,
  backdropFilter: "blur(18px)",
});

export const pwaBannerEyebrow = style({
  fontSize: typographyValues.micro.fontSize,
  lineHeight: typographyValues.micro.lineHeight,
  letterSpacing: "0.14em",
  textTransform: "uppercase",
  color: faintText,
});

export const pwaBannerTitle = style({
  fontSize: typographyValues.label.fontSize,
  lineHeight: typographyValues.label.lineHeight,
  fontWeight: 700,
});

export const pwaBannerCopy = style({
  margin: 0,
  color: mutedText,
  lineHeight: typographyValues.content.lineHeight,
});

export const pwaBannerActions = style({
  display: "flex",
  flexWrap: "wrap",
  gap: "10px",
  alignItems: "center",
});

export const pwaBannerPrimaryButton = style({
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  minHeight: "42px",
  padding: "0 16px",
  borderRadius: "999px",
  border: "none",
  background: semanticThemeVars.color.text.primary,
  color: semanticThemeVars.color.text.inverse,
  fontSize: typographyValues.chrome.fontSize,
  lineHeight: typographyValues.chrome.lineHeight,
  fontWeight: 600,
  cursor: "pointer",
});

export const pwaBannerSecondaryButton = style({
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  minHeight: "42px",
  padding: "0 16px",
  borderRadius: "999px",
  border: accentBorder,
  background: surfaceMuted,
  color: strongText,
  fontSize: typographyValues.chrome.fontSize,
  lineHeight: typographyValues.chrome.lineHeight,
  textDecoration: "none",
});

export const pwaBannerDismissButton = style({
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  minHeight: "42px",
  padding: "0 8px",
  border: "none",
  background: "transparent",
  color: faintText,
  fontSize: typographyValues.chrome.fontSize,
  lineHeight: typographyValues.chrome.lineHeight,
  cursor: "pointer",
});

globalStyle(`${documentBody} a`, {
  color: "inherit",
});

globalStyle("html, body", {
  minHeight: "100%",
});

globalStyle(
  `${chromeNavLink}:hover, ${chromeNavLinkActive}:hover, ${aboutLink}:hover, ${primaryLink}:hover, ${secondaryLink}:hover, ${pwaBannerSecondaryButton}:hover`,
  {
    opacity: 0.92,
  }
);

globalStyle(`${pwaBannerPrimaryButton}:disabled`, {
  cursor: "progress",
  opacity: 0.82,
});
