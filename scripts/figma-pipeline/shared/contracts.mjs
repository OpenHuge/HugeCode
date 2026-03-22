export const PIPELINE_VERSION = 1;

export const ARTIFACT_SUFFIXES = Object.freeze({
  rawManifest: ".manifest.json",
  summary: ".summary.json",
  classifiedNodeGraph: ".classified-node-graph.json",
  primitiveTokens: ".primitive-tokens.json",
  semanticTokens: ".semantic-tokens.json",
  componentInventory: ".component-inventory.json",
  variantStateModel: ".variant-state-model.json",
  componentSpecs: ".component-specs.json",
  generationPlan: ".generation-plan.json",
  codegenReport: ".codegen-report.json",
  promotionManifest: ".promotion-manifest.json",
  promotionApplyReport: ".promotion-apply-report.json",
  promotionReview: ".promotion-review.md",
  qaReport: ".qa-report.json",
});

export const SUPPORTED_NODE_ROLE_VALUES = Object.freeze([
  "page",
  "section",
  "frame",
  "component-set",
  "component",
  "instance",
  "layout",
  "text",
  "vector",
  "image",
  "shape",
  "interactive-candidate",
  "unknown",
]);

export const SUPPORTED_COMPONENT_CLASSIFICATIONS = Object.freeze([
  "primitive",
  "composite",
  "page-pattern",
]);

export const SUPPORTED_COMPONENT_SPEC_KINDS = Object.freeze([
  "primitive",
  "composite",
  "local-pattern",
]);

export const SUPPORTED_COMPONENT_SHARED_LEVELS = Object.freeze([
  "shared-foundation",
  "shared-component",
  "app-adapter",
  "app-local",
  "defer",
]);

export const SUPPORTED_GENERATION_TARGET_LAYERS = Object.freeze([
  "design-system-primitive",
  "design-system-component",
  "app-adapter",
  "app-pattern",
  "defer",
]);

export const SHARED_COMPONENT_ELIGIBILITY = Object.freeze({
  minOccurrences: 2,
  minConfidence: 0.7,
});

export const SEMANTIC_TOKEN_TEMPLATE = Object.freeze({
  color: {
    bg: [
      "canvas",
      "app",
      "panel",
      "card",
      "elevated",
      "overlay",
      "inset",
      "sidebar",
      "topbar",
      "composer",
      "message",
      "input",
      "hover",
      "pressed",
      "selected",
    ],
    text: ["primary", "secondary", "tertiary", "muted", "inverse", "disabled", "accent"],
    border: ["subtle", "default", "strong", "focus", "accent"],
    icon: ["primary", "secondary", "muted", "inverse"],
    control: ["default", "hover", "pressed", "selected"],
    state: [
      "running",
      "queued",
      "thinking",
      "streaming",
      "success",
      "warning",
      "danger",
      "info",
      "cancelled",
      "offline",
    ],
    diff: [
      "insertBg",
      "insertBorder",
      "deleteBg",
      "deleteBorder",
      "modifiedBg",
      "modifiedBorder",
      "gutter",
      "inlineHighlight",
    ],
    overlay: ["scrim", "glass"],
  },
  typography: {
    font: ["ui", "mono"],
    size: ["xs", "sm", "md", "lg", "xl", "x2", "x3", "x4"],
    lineHeight: ["tight", "sm", "md", "lg", "relaxed"],
    weight: ["regular", "medium", "semibold", "bold"],
    role: ["heading", "body", "label", "caption", "code", "log"],
  },
  space: ["px", "xxs", "xs", "sm", "md", "lg", "xl", "x2", "x3", "x4", "x5", "x6"],
  size: {
    control: ["xs", "sm", "md", "lg"],
    icon: ["xs", "sm", "md", "lg", "xl"],
    layout: [
      "sidebarRail",
      "sidebar",
      "sidebarCompact",
      "inspector",
      "composerMinHeight",
      "composerMaxWidth",
      "contentMaxWidth",
    ],
  },
  radius: ["xs", "sm", "md", "lg", "xl", "x2", "pill"],
  borderWidth: ["hairline", "default", "strong"],
  shadow: ["none", "xs", "sm", "md", "lg", "overlay"],
  motion: {
    duration: ["instant", "fast", "base", "slow"],
    easing: ["standard", "enter", "exit"],
    blur: ["subtle", "overlay"],
    focus: ["width", "offset"],
  },
  layer: [
    "base",
    "stickyHeader",
    "popover",
    "dropdown",
    "modal",
    "toast",
    "commandPalette",
    "dragOverlay",
  ],
});

export function flattenSemanticTemplate(template = SEMANTIC_TOKEN_TEMPLATE, prefix = []) {
  const paths = [];

  if (Array.isArray(template)) {
    for (const value of template) {
      paths.push([...prefix, value].join("."));
    }
    return paths;
  }

  for (const [key, value] of Object.entries(template)) {
    paths.push(...flattenSemanticTemplate(value, [...prefix, key]));
  }

  return paths;
}
