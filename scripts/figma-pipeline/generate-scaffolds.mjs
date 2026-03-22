#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { pathToFileURL } from "node:url";
import { ARTIFACT_SUFFIXES, PIPELINE_VERSION } from "./shared/contracts.mjs";
import { loadPipelineArtifacts, readPipelineArtifacts } from "./shared/load-artifacts.mjs";
import {
  readJson,
  replaceJsonSuffix,
  resolveLatestRawExportJsonPath,
  writeJson,
} from "./shared/paths.mjs";

const DEFAULT_MODE = "artifacts-only";
const BUTTON_LIKE_FAMILIES = new Set(["Button", "IconButton", "NavigationItem"]);
const FIELD_FAMILIES = new Set(["Input", "Textarea", "Select"]);
const CHOICE_FAMILIES = new Set(["Checkbox", "Radio", "Switch"]);
const CONTAINER_LIKE_FAMILIES = new Set([
  "Box",
  "Surface",
  "Card",
  "Badge",
  "Avatar",
  "Tooltip",
  "DropdownMenu",
  "Toast",
  "Table",
  "Pagination",
  "EmptyState",
  "LoadingState",
]);
const COMPONENT_PROP_ELEMENTS = Object.freeze({
  Box: "div",
  Text: "span",
  Stack: "div",
  Inline: "div",
  Surface: "div",
  Button: "button",
  IconButton: "button",
  Input: "input",
  Textarea: "textarea",
  Select: "button",
  Checkbox: "input",
  Radio: "input",
  Switch: "input",
  Tabs: "div",
  Badge: "span",
  Avatar: "div",
  Tooltip: "div",
  DropdownMenu: "div",
  Card: "div",
  Dialog: "div",
  Toast: "div",
  Table: "div",
  Pagination: "nav",
  NavigationItem: "button",
  EmptyState: "section",
  LoadingState: "div",
});

function toPascalCase(value) {
  return String(value ?? "")
    .replace(/[^a-z0-9]+/giu, " ")
    .trim()
    .split(/\s+/u)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join("");
}

function tokenPathToCssVar(tokenPath) {
  return `var(--semantic-${String(tokenPath ?? "").replace(/\./gu, "-")})`;
}

function sanitizeSemanticDependencies(dependencies) {
  return (dependencies ?? []).map((dependency) => ({
    path: dependency.path,
    cssVar: tokenPathToCssVar(dependency.path),
    mapped: dependency.status === "mapped",
  }));
}

function renderPropType(prop) {
  return `${prop.name}${prop.required ? "" : "?"}: ${prop.type};`;
}

function renderVariantUnion(entries) {
  if (!entries || entries.length === 0) {
    return "never";
  }
  return entries.map((entry) => `"${entry.name}"`).join(" | ");
}

function hasProp(spec, name) {
  return (spec.props ?? []).some((prop) => prop.name === name);
}

function buildComponentProps(spec) {
  const baseElement = COMPONENT_PROP_ELEMENTS[spec.family] ?? "div";
  const explicitProps = (spec.props ?? [])
    .filter((prop) => !["className", "children"].includes(prop.name))
    .map(renderPropType);
  const childrenProp = hasProp(spec, "children") ? "  children?: ReactNode;\n" : "";

  return `export interface ${spec.family}Props extends Omit<ComponentPropsWithoutRef<"${baseElement}">, "children"> {
  className?: string;
${childrenProp}${explicitProps.map((line) => `  ${line}`).join("\n")}
}`;
}

function buildClassNameExpression(spec) {
  const conditionalClasses = [];
  if ((spec.variants ?? []).length > 0) {
    conditionalClasses.push("variant && styles.variant[variant]");
  }
  if ((spec.sizes ?? []).length > 0) {
    conditionalClasses.push("size && styles.size[size]");
  }
  if ((spec.tones ?? []).length > 0) {
    conditionalClasses.push("tone && styles.tone[tone]");
  }
  if ((spec.densities ?? []).length > 0) {
    conditionalClasses.push("density && styles.density[density]");
  }
  if ((spec.states?.persistent ?? []).some((entry) => entry.name === "selected")) {
    conditionalClasses.push("selected && styles.selected");
  }
  if ((spec.states?.persistent ?? []).some((entry) => entry.name === "invalid")) {
    conditionalClasses.push("invalid && styles.invalid");
  }
  if ((spec.states?.persistent ?? []).some((entry) => entry.name === "loading")) {
    conditionalClasses.push("loading && styles.loading");
  }

  return `[styles.root, ${conditionalClasses.concat("className").join(", ")}].filter(Boolean).join(" ")`;
}

function buildCommonDestructuredProps(spec) {
  const props = [];
  const propNames = new Set((spec.props ?? []).map((prop) => prop.name));
  const defaults = [
    ["variant", spec.variants?.[0]?.name ?? null],
    ["size", spec.sizes?.[0]?.name ?? null],
    ["tone", spec.tones?.[0]?.name ?? null],
    ["density", spec.densities?.[0]?.name ?? null],
  ];

  props.push("className");
  if (propNames.has("children")) {
    props.push("children");
  }

  for (const propName of [
    "label",
    "description",
    "errorMessage",
    "leadingIcon",
    "trailingIcon",
    "icon",
    "prefix",
    "suffix",
    "header",
    "footer",
    "title",
    "action",
    "trigger",
    "fallback",
    "badge",
  ]) {
    if (propNames.has(propName)) {
      props.push(propName);
    }
  }

  for (const [propName, defaultValue] of defaults) {
    if (propNames.has(propName)) {
      props.push(
        defaultValue === null ? propName : `${propName} = ${JSON.stringify(defaultValue)}`
      );
    }
  }

  for (const propName of [
    "selected",
    "invalid",
    "loading",
    "disabled",
    "value",
    "defaultValue",
    "onValueChange",
    "open",
    "orientation",
    "type",
  ]) {
    if (propNames.has(propName)) {
      props.push(propName);
    }
  }

  props.push("...props");
  return props;
}

function indentLines(value, spaces) {
  const prefix = " ".repeat(spaces);
  return String(value)
    .split("\n")
    .map((line) => (line.length > 0 ? `${prefix}${line}` : line))
    .join("\n");
}

function buildSlotMarkup(propName, className = "slot", tag = "span", contentExpression = propName) {
  return `{${propName} ? <${tag} className={styles.${className}} data-slot=${JSON.stringify(propName)}>${contentExpression}</${tag}> : null}`;
}

function buildGenericBody(spec) {
  const wrapperTag = spec.family === "Text" ? "span" : spec.family === "Pagination" ? "nav" : "div";
  const lines = [];

  if (hasProp(spec, "header")) {
    lines.push(buildSlotMarkup("header", "slot", "div"));
  }
  if (hasProp(spec, "title")) {
    lines.push(buildSlotMarkup("title", "label", "div"));
  }
  if (hasProp(spec, "label")) {
    lines.push(buildSlotMarkup("label", "label", "div"));
  }
  if (hasProp(spec, "description")) {
    lines.push(buildSlotMarkup("description", "description", "div"));
  }
  if (hasProp(spec, "trigger")) {
    lines.push(buildSlotMarkup("trigger", "slot", "div"));
  }
  if (hasProp(spec, "icon")) {
    lines.push(buildSlotMarkup("icon", "icon"));
  }
  if (hasProp(spec, "fallback")) {
    lines.push(`{!children ? ${buildSlotMarkup("fallback", "slot", "span")} : null}`);
  }
  if (hasProp(spec, "children")) {
    lines.push("{children}");
  }
  if (hasProp(spec, "action")) {
    lines.push(buildSlotMarkup("action", "slot", "div"));
  }
  if (hasProp(spec, "footer")) {
    lines.push(buildSlotMarkup("footer", "slot", "div"));
  }

  return `return (
    <${wrapperTag}
      className={classes}
      data-figma-family=${JSON.stringify(spec.family)}
      data-figma-target-layer=${JSON.stringify(spec.targetLayer ?? "")}
      {...props}
    >
${indentLines(lines.length > 0 ? lines.join("\n") : "{children}", 6)}
    </${wrapperTag}>
  );`;
}

function buildButtonBody(spec) {
  const iconOnly = spec.family === "IconButton";
  const bodyLines = [];
  if (hasProp(spec, "leadingIcon")) {
    bodyLines.push(buildSlotMarkup("leadingIcon", "icon"));
  }
  if (hasProp(spec, "icon")) {
    bodyLines.push(buildSlotMarkup("icon", "icon"));
  }
  if (!iconOnly || hasProp(spec, "children")) {
    bodyLines.push("{children}");
  }
  if (hasProp(spec, "badge")) {
    bodyLines.push(buildSlotMarkup("badge", "slot"));
  }
  if (hasProp(spec, "trailingIcon")) {
    bodyLines.push(buildSlotMarkup("trailingIcon", "icon"));
  }

  return `return (
    <button
      ref={ref}
      type={type ?? "button"}
      className={classes}
      data-figma-family=${JSON.stringify(spec.family)}
      data-figma-target-layer=${JSON.stringify(spec.targetLayer ?? "")}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...props}
    >
${indentLines(bodyLines.join("\n"), 6)}
    </button>
  );`;
}

function buildFieldBody(spec) {
  const controlTag =
    spec.family === "Textarea" ? "textarea" : spec.family === "Select" ? "button" : "input";
  const controlProps =
    spec.family === "Textarea"
      ? `className={styles.control}
          disabled={disabled}
          aria-invalid={invalid || undefined}
          value={value}
          defaultValue={defaultValue}
          onChange={onValueChange ? (event) => onValueChange(event.currentTarget.value) : undefined}
          {...props}`
      : spec.family === "Select"
        ? `type="button"
          className={styles.control}
          disabled={disabled}
          aria-invalid={invalid || undefined}
          aria-expanded={open || undefined}
          {...props}`
        : `className={styles.control}
          disabled={disabled}
          aria-invalid={invalid || undefined}
          value={value}
          defaultValue={defaultValue}
          onChange={onValueChange ? (event) => onValueChange(event.currentTarget.value) : undefined}
          {...props}`;
  const controlChildren =
    spec.family === "Select"
      ? `${hasProp(spec, "value") ? '{value ?? children ?? "Select"}' : '{children ?? "Select"}'}\n${
          hasProp(spec, "icon") ? `          ${buildSlotMarkup("icon", "icon")}\n` : ""
        }`
      : "";

  return `return (
    <div
      ref={ref}
      className={classes}
      data-figma-family=${JSON.stringify(spec.family)}
      data-figma-target-layer=${JSON.stringify(spec.targetLayer ?? "")}
    >
      ${hasProp(spec, "label") ? buildSlotMarkup("label", "label", "label") : "null"}
      <div className={styles.field}>
        ${hasProp(spec, "prefix") ? buildSlotMarkup("prefix", "slot") : "null"}
        <${controlTag}
          ${controlProps}
        >
${indentLines(controlChildren, 10)}
        </${controlTag}>
        ${hasProp(spec, "suffix") ? buildSlotMarkup("suffix", "slot") : "null"}
      </div>
      <div className={styles.supportText}>
        ${hasProp(spec, "description") ? buildSlotMarkup("description", "description", "div") : "null"}
        ${hasProp(spec, "errorMessage") ? buildSlotMarkup("errorMessage", "errorText", "div") : "null"}
      </div>
    </div>
  );`;
}

function buildChoiceBody(spec) {
  const inputType =
    spec.family === "Radio" ? "radio" : spec.family === "Switch" ? "checkbox" : "checkbox";
  return `return (
    <label
      ref={ref}
      className={classes}
      data-figma-family=${JSON.stringify(spec.family)}
      data-figma-target-layer=${JSON.stringify(spec.targetLayer ?? "")}
    >
      <input
        className={styles.control}
        type=${JSON.stringify(inputType)}
        disabled={disabled}
        aria-invalid={invalid || undefined}
        {...props}
      />
      <span className={styles.panel}>
        ${hasProp(spec, "label") ? buildSlotMarkup("label", "label") : "{children}"}
        ${hasProp(spec, "description") ? buildSlotMarkup("description", "description", "div") : "null"}
      </span>
    </label>
  );`;
}

function buildTabsBody(spec) {
  return `return (
    <div
      ref={ref}
      className={classes}
      data-figma-family=${JSON.stringify(spec.family)}
      data-figma-target-layer=${JSON.stringify(spec.targetLayer ?? "")}
      data-orientation={orientation ?? "horizontal"}
      {...props}
    >
      <div className={styles.list} role="tablist" aria-orientation={orientation ?? "horizontal"}>
        {children ?? <span className={styles.slot}>Tabs scaffold</span>}
      </div>
    </div>
  );`;
}

function buildDialogBody(spec) {
  return `return (
    <div
      ref={ref}
      className={classes}
      data-figma-family=${JSON.stringify(spec.family)}
      data-figma-target-layer=${JSON.stringify(spec.targetLayer ?? "")}
      data-open={open ? "true" : "false"}
      role="dialog"
      aria-modal="true"
      {...props}
    >
      ${hasProp(spec, "title") ? buildSlotMarkup("title", "label", "div") : "null"}
      ${hasProp(spec, "description") ? buildSlotMarkup("description", "description", "div") : "null"}
      <div className={styles.panel}>{children}</div>
      ${hasProp(spec, "footer") ? buildSlotMarkup("footer", "slot", "div") : "null"}
    </div>
  );`;
}

function buildComponentTemplate(spec, target) {
  const propElement = COMPONENT_PROP_ELEMENTS[spec.family] ?? "div";
  const variantType = renderVariantUnion(spec.variants);
  const sizeType = renderVariantUnion(spec.sizes);
  const toneType = renderVariantUnion(spec.tones);
  const densityType = renderVariantUnion(spec.densities);
  const refType =
    propElement === "button"
      ? "HTMLButtonElement"
      : propElement === "input"
        ? "HTMLInputElement"
        : propElement === "textarea"
          ? "HTMLTextAreaElement"
          : propElement === "nav"
            ? "HTMLElement"
            : "HTMLDivElement";
  const propsInterface = buildComponentProps(spec);
  const componentName = spec.family;
  const classNameExpression = buildClassNameExpression(spec);
  const destructuredProps = buildCommonDestructuredProps(spec);
  const semanticDeps = sanitizeSemanticDependencies(spec.tokenDependencies?.semantic ?? []);
  const semanticTokenComment = semanticDeps
    .map((dependency) => ` * - ${dependency.path} => ${dependency.cssVar}`)
    .join("\n");

  let componentBody;
  if (BUTTON_LIKE_FAMILIES.has(spec.family)) {
    componentBody = buildButtonBody({ ...spec, targetLayer: target.targetLayer });
  } else if (FIELD_FAMILIES.has(spec.family)) {
    componentBody = buildFieldBody({ ...spec, targetLayer: target.targetLayer });
  } else if (CHOICE_FAMILIES.has(spec.family)) {
    componentBody = buildChoiceBody({ ...spec, targetLayer: target.targetLayer });
  } else if (spec.family === "Tabs") {
    componentBody = buildTabsBody({ ...spec, targetLayer: target.targetLayer });
  } else if (spec.family === "Dialog") {
    componentBody = buildDialogBody({ ...spec, targetLayer: target.targetLayer });
  } else if (CONTAINER_LIKE_FAMILIES.has(spec.family) || spec.family === "Text") {
    componentBody = buildGenericBody({ ...spec, targetLayer: target.targetLayer });
  } else {
    componentBody = buildGenericBody({ ...spec, targetLayer: target.targetLayer });
  }

  return `import { forwardRef, type ComponentPropsWithoutRef, type ReactNode } from "react";
import * as styles from "./${componentName}.css";

${propsInterface}

export const ${componentName} = forwardRef<${refType}, ${componentName}Props>(function ${componentName}(
  {
    ${destructuredProps.join(",\n    ")}
  },
  ref
) {
  const classes = ${classNameExpression};

${indentLines(componentBody, 2)}
});

${componentName}.displayName = ${JSON.stringify(componentName)};

/**
 * Generated from Figma pipeline scaffold planning.
 * Semantic token dependencies:
${semanticTokenComment.length > 0 ? semanticTokenComment : " * - none"}
 */
export type ${componentName}Variant = ${variantType};
export type ${componentName}Size = ${sizeType};
export type ${componentName}Tone = ${toneType};
export type ${componentName}Density = ${densityType};
`;
}

function buildStyleGroup(name, entries) {
  if (!entries || entries.length === 0) {
    return `export const ${name} = {} as const;`;
  }

  return `export const ${name} = {
${entries.map((entry) => `  ${JSON.stringify(entry.name)}: style({}),`).join("\n")}
} as const;`;
}

function buildStyleTemplate(spec) {
  const semanticDeps = sanitizeSemanticDependencies(spec.tokenDependencies?.semantic ?? []);
  const fallbackBackground = semanticDeps[0]?.cssVar ?? tokenPathToCssVar("color.bg.card");
  const fallbackColor =
    semanticDeps.find((dependency) => dependency.path.includes("color.text"))?.cssVar ??
    tokenPathToCssVar("color.text.primary");
  const fallbackBorder =
    semanticDeps.find((dependency) => dependency.path.includes("border"))?.cssVar ??
    tokenPathToCssVar("color.border.default");

  return `import { style } from "@vanilla-extract/css";

export const root = style({
  background: ${JSON.stringify(fallbackBackground)},
  color: ${JSON.stringify(fallbackColor)},
  border: \`1px solid ${fallbackBorder}\`,
  borderRadius: ${JSON.stringify(tokenPathToCssVar("radius.md"))},
  transition: \`background var(--semantic-motion-duration-fast) var(--semantic-motion-easing-standard)\`,
});

export const field = style({
  display: "flex",
  alignItems: "center",
  gap: "8px",
});

export const control = style({
  flex: 1,
  minWidth: 0,
  background: "transparent",
  color: "inherit",
  border: 0,
  outline: "none",
});

export const panel = style({
  display: "grid",
  gap: "8px",
});

export const list = style({
  display: "flex",
  gap: "8px",
});

export const slot = style({});
export const icon = style({});
export const label = style({});
export const description = style({});
export const supportText = style({
  display: "grid",
  gap: "4px",
});
export const errorText = style({});

${buildStyleGroup("variant", spec.variants)}

${buildStyleGroup("size", spec.sizes)}

${buildStyleGroup("tone", spec.tones)}

${buildStyleGroup("density", spec.densities)}

export const selected = style({});
export const invalid = style({});
export const loading = style({});
`;
}

function buildSmokeUsage(spec) {
  switch (spec.family) {
    case "Button":
      return `<Button type="button">Scaffold</Button>`;
    case "IconButton":
      return `<IconButton aria-label="Action" icon={<span aria-hidden="true">+</span>} />`;
    case "Input":
      return `<Input label="Field" placeholder="Scaffold" />`;
    case "Textarea":
      return `<Textarea label="Field" defaultValue="Scaffold" />`;
    case "Select":
      return `<Select label="Field" value="Scaffold" />`;
    case "Checkbox":
    case "Radio":
    case "Switch":
      return `<${spec.family} label="Option" />`;
    case "Dialog":
      return `<Dialog open title="Dialog">Dialog content</Dialog>`;
    case "Tabs":
      return `<Tabs value="overview">Tabs scaffold</Tabs>`;
    case "Avatar":
      return `<Avatar fallback="OF" />`;
    case "Tooltip":
      return `<Tooltip trigger={<button type="button">Trigger</button>}>Tooltip content</Tooltip>`;
    case "DropdownMenu":
      return `<DropdownMenu trigger={<button type="button">Menu</button>}>Menu content</DropdownMenu>`;
    case "Toast":
      return `<Toast title="Saved">Scaffold</Toast>`;
    case "Pagination":
      return `<Pagination>Page 1 of 1</Pagination>`;
    default:
      return hasProp(spec, "children")
        ? `<${spec.family}>Scaffold</${spec.family}>`
        : `<${spec.family} />`;
  }
}

function buildTestTemplate(spec) {
  const usage = buildSmokeUsage(spec);
  const assertion =
    hasProp(spec, "label") || spec.family === "Dialog" || spec.family === "Toast"
      ? "Field"
      : spec.family === "IconButton"
        ? "Action"
        : spec.family === "Tooltip"
          ? "Tooltip content"
          : spec.family === "DropdownMenu"
            ? "Menu content"
            : spec.family === "Avatar"
              ? "OF"
              : spec.family === "Pagination"
                ? "Page 1 of 1"
                : spec.family === "Tabs"
                  ? "Tabs scaffold"
                  : spec.family === "Dialog"
                    ? "Dialog"
                    : spec.family === "Toast"
                      ? "Saved"
                      : "Scaffold";

  return `import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ${spec.family} } from "./${spec.family}";

describe("${spec.family}", () => {
  it("renders a scaffold shell", () => {
    render(${usage});
    expect(screen.getByText(${JSON.stringify(assertion)})).toBeTruthy();
  });
});
`;
}

function buildExampleTemplate(spec) {
  const usage = buildSmokeUsage(spec);
  return `import { ${spec.family} } from "./${spec.family}";

export function ${spec.family}Example() {
  return ${usage};
}
`;
}

function buildOutputRoot(exportJsonPath) {
  const baseName = path.basename(exportJsonPath, ".json");
  return path.join(process.cwd(), "artifacts", "figma-codegen", baseName);
}

function buildSpecKey(componentName, family) {
  return `${String(componentName ?? "")}::${String(family ?? "")}`;
}

function parseCliOptions(argv) {
  const promote = argv.includes("--promote");
  const allowReviewTargets = argv.includes("--allow-review-targets");
  const overwrite = argv.includes("--overwrite");
  const explicitInputPath = argv.find((argument) => !argument.startsWith("--")) ?? null;
  const promoteRootArg = argv.find((argument) => argument.startsWith("--promote-root=")) ?? null;
  const promoteRoot = promoteRootArg
    ? promoteRootArg.slice("--promote-root=".length)
    : process.cwd();

  return {
    promote,
    allowReviewTargets,
    overwrite,
    explicitInputPath,
    promoteRoot,
  };
}

function ensureParentDirectory(filePath) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
}

function writeFile(filePath, contents) {
  ensureParentDirectory(filePath);
  fs.writeFileSync(filePath, contents, "utf8");
}

function buildGeneratedFiles(target, spec, outputRoot) {
  const generatedFiles = [];
  const baseName = toPascalCase(spec.family);
  const componentDirectory = path.join(outputRoot, target.directoryPath);
  const fileEntries = [
    {
      path: path.join(componentDirectory, `${baseName}.tsx`),
      role: "component",
      contents: buildComponentTemplate(spec, target),
    },
    {
      path: path.join(componentDirectory, `${baseName}.css.ts`),
      role: "styles",
      contents: buildStyleTemplate(spec),
    },
    {
      path: path.join(componentDirectory, `${baseName}.test.tsx`),
      role: "test",
      contents: buildTestTemplate(spec),
    },
    {
      path: path.join(componentDirectory, `${baseName}.examples.tsx`),
      role: "examples",
      contents: buildExampleTemplate(spec),
    },
  ];

  for (const fileEntry of fileEntries) {
    writeFile(fileEntry.path, fileEntry.contents);
    generatedFiles.push({ path: fileEntry.path, role: fileEntry.role });
  }

  const indexPath = path.join(componentDirectory, "index.ts");
  writeFile(
    indexPath,
    `export { ${spec.family}, type ${spec.family}Props } from "./${baseName}";\n`
  );
  generatedFiles.push({ path: indexPath, role: "index" });

  return generatedFiles;
}

function buildAppAdapterNotes(target) {
  if (target.targetLayer !== "app-adapter") {
    return [];
  }

  return [
    `App adapter targets stay in ${target.directoryPath} as app-only compatibility wrappers around @ku0/design-system.`,
    "This flow generates family folders only. After promotion, wire the family through apps/code/src/design-system/adapters/index.ts and then re-export it from apps/code/src/design-system/index.ts.",
  ];
}

function promoteGeneratedFiles(generatedFiles, artifactRoot, promoteRoot, overwrite) {
  const promotedFiles = [];
  const overwrittenFiles = [];

  for (const generatedFile of generatedFiles) {
    const relativePath = path.relative(artifactRoot, generatedFile.path);
    const targetPath = path.join(promoteRoot, relativePath);
    const targetExists = fs.existsSync(targetPath);

    if (targetExists && !overwrite) {
      return {
        ok: false,
        reason: `Target file already exists: ${targetPath}. Re-run with --overwrite to promote this scaffold.`,
        promotedFiles: [],
        overwrittenFiles: [],
      };
    }

    ensureParentDirectory(targetPath);
    fs.copyFileSync(generatedFile.path, targetPath);
    promotedFiles.push({ path: targetPath, role: generatedFile.role });
    if (targetExists) {
      overwrittenFiles.push(targetPath);
    }
  }

  return {
    ok: true,
    promotedFiles,
    overwrittenFiles,
  };
}

function canPromoteTarget(target, options) {
  if (target.targetLayer === "defer") {
    return {
      ok: false,
      reason: "Target is deferred by generation planning and should not be promoted.",
    };
  }
  if (target.codegenReadiness?.status === "defer") {
    return {
      ok: false,
      reason: "Target readiness is defer and requires more design-system evidence first.",
    };
  }
  if (target.codegenReadiness?.status !== "ready" && !options.allowReviewTargets) {
    return {
      ok: false,
      reason:
        "Target is not codegen-ready. Re-run with --allow-review-targets to promote review-stage scaffolds.",
    };
  }
  if ((target.blockers ?? []).length > 0 && !options.allowReviewTargets) {
    return {
      ok: false,
      reason: "Target still has blockers. Re-run with --allow-review-targets after manual review.",
    };
  }

  return { ok: true };
}

export function generateScaffolds(exportJsonPath, options = {}) {
  const artifacts = readPipelineArtifacts(exportJsonPath);
  const { componentSpecsPath, generationPlanPath } = loadPipelineArtifacts(exportJsonPath);
  const componentSpecs = readJson(componentSpecsPath);
  const generationPlan = readJson(generationPlanPath);
  const outputRoot = buildOutputRoot(exportJsonPath);
  const effectiveOptions = {
    promote: false,
    allowReviewTargets: false,
    overwrite: false,
    promoteRoot: process.cwd(),
    ...options,
  };
  const specsByComponent = new Map(
    componentSpecs.components.map((component) => [
      buildSpecKey(component.name, component.family),
      component,
    ])
  );
  const generatedTargets = [];
  const promotedTargets = [];
  const skippedTargets = [];

  for (const target of generationPlan.targets) {
    const spec = specsByComponent.get(buildSpecKey(target.componentName, target.family));
    if (!spec) {
      skippedTargets.push({
        componentName: target.componentName,
        family: target.family,
        targetLayer: target.targetLayer,
        readiness: target.codegenReadiness?.status ?? "review",
        stage: "generate",
        reason: "No matching component spec was found for this generation target.",
      });
      continue;
    }
    if (target.targetLayer === "defer") {
      skippedTargets.push({
        componentName: target.componentName,
        family: target.family,
        targetLayer: target.targetLayer,
        readiness: target.codegenReadiness?.status ?? "defer",
        stage: "generate",
        reason: "Target is deferred by generation planning and should not scaffold yet.",
      });
      continue;
    }

    const generatedFiles = buildGeneratedFiles(target, spec, outputRoot);
    generatedTargets.push({
      componentName: target.componentName,
      family: target.family,
      targetLayer: target.targetLayer,
      templateFamily: target.family,
      readiness: target.codegenReadiness.status,
      outputDirectory: path.join(outputRoot, target.directoryPath),
      generatedFiles,
      notes: [
        "Artifacts are generated into artifacts/figma-codegen and do not overwrite repo source files.",
        "Promote scaffold files manually after review and token/a11y validation.",
        ...buildAppAdapterNotes(target),
      ],
    });

    if (!effectiveOptions.promote) {
      continue;
    }

    const promotionGate = canPromoteTarget(target, effectiveOptions);
    if (!promotionGate.ok) {
      skippedTargets.push({
        componentName: target.componentName,
        family: target.family,
        targetLayer: target.targetLayer,
        readiness: target.codegenReadiness?.status ?? "review",
        stage: "promote",
        reason: promotionGate.reason,
      });
      continue;
    }

    const promotionResult = promoteGeneratedFiles(
      generatedFiles,
      outputRoot,
      path.resolve(effectiveOptions.promoteRoot),
      effectiveOptions.overwrite
    );
    if (!promotionResult.ok) {
      skippedTargets.push({
        componentName: target.componentName,
        family: target.family,
        targetLayer: target.targetLayer,
        readiness: target.codegenReadiness?.status ?? "review",
        stage: "promote",
        reason: promotionResult.reason,
      });
      continue;
    }

    promotedTargets.push({
      componentName: target.componentName,
      family: target.family,
      targetLayer: target.targetLayer,
      readiness: target.codegenReadiness.status,
      targetDirectory: path.join(path.resolve(effectiveOptions.promoteRoot), target.directoryPath),
      promotedFiles: promotionResult.promotedFiles,
      overwrittenFiles: promotionResult.overwrittenFiles,
      notes: [
        effectiveOptions.allowReviewTargets
          ? "Review-stage targets were explicitly allowed during promotion."
          : "Only ready targets were promoted.",
        ...buildAppAdapterNotes(target),
      ],
    });
  }

  const report = {
    artifactVersion: PIPELINE_VERSION,
    generatedAt: new Date().toISOString(),
    sourceManifest: artifacts.manifest.files?.json ?? artifacts.manifest.source?.nodeId ?? "",
    outputRoot,
    mode: effectiveOptions.promote ? "artifacts-and-promote" : DEFAULT_MODE,
    promotion: {
      enabled: effectiveOptions.promote,
      promoteRoot: path.resolve(effectiveOptions.promoteRoot),
      allowReviewTargets: effectiveOptions.allowReviewTargets,
      overwrite: effectiveOptions.overwrite,
    },
    generatedTargets,
    promotedTargets,
    skippedTargets,
  };

  const outputPath = replaceJsonSuffix(exportJsonPath, ARTIFACT_SUFFIXES.codegenReport);
  writeJson(outputPath, report);
  return { outputPath, outputRoot, report };
}

function main() {
  const cliOptions = parseCliOptions(process.argv.slice(2));
  const exportJsonPath = resolveLatestRawExportJsonPath(cliOptions.explicitInputPath);
  const { outputPath, outputRoot, report } = generateScaffolds(exportJsonPath, cliOptions);
  process.stdout.write(
    `${JSON.stringify(
      {
        ok: true,
        outputPath,
        outputRoot,
        mode: report.mode,
        generatedTargets: report.generatedTargets.length,
        promotedTargets: report.promotedTargets.length,
        skippedTargets: report.skippedTargets.length,
      },
      null,
      2
    )}\n`
  );
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    main();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    process.stderr.write(`${message}\n`);
    process.exit(1);
  }
}
