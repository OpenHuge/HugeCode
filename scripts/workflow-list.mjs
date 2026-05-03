#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";

const repoRoot = process.cwd();
const packageJsonPath = path.join(repoRoot, "package.json");
const OUTPUT_HEADER = "HugeCode workflow shortcuts";
const INTERNAL_WORKFLOW_NOTE =
  "Internal reusable workflows live under `.github/workflows/_reusable-*.yml`";

const WORKFLOW_SECTIONS = [
  {
    title: "Start Here",
    commands: [
      ["pnpm install", "Install workspace dependencies."],
      ["pnpm workflow:list", "Show the recommended workflow entrypoints."],
      ["pnpm repo:doctor", "Run repo health checks before larger changes."],
      ["pnpm preflight:codex", "Run Codex-specific environment checks."],
    ],
  },
  {
    title: "Development",
    commands: [
      ["pnpm dev", "Start the active t3 code workspace."],
      ["pnpm dev:code:ui", "Run only the t3 code UI dev server."],
      ["pnpm dev:code:service", "Run only the code runtime service."],
      ["pnpm code-t3:build", "Build the active t3 app."],
      [
        "pnpm prewarm:code-runtime-service",
        "Prebuild the Rust runtime service for cold-start lanes.",
      ],
    ],
  },
  {
    title: "Validation",
    commands: [
      ["pnpm validate:fast", "Fast validation for isolated UI or TS changes."],
      ["pnpm validate", "Standard validation for multi-file or behavior changes."],
      ["pnpm validate:full", "Full validation for shared contracts or CI/release-risk work."],
      ["pnpm check:runtime-contract", "Check frozen runtime contract spec and runtime SOT."],
      ["pnpm ui:contract", "Check platform boundaries for app/runtime integration."],
      [
        "pnpm check:design-system:baseline",
        "Verify shared design-system barrels, app ownership and surface-semantics boundaries, normalized compat bridges, app-owned modal/panel/shell grammar routing, promoted Storybook coverage, family contract and adoption evidence including Textarea, governance-unit fixture coverage, operator-adjunct fixture coverage, and the fixture smoke baseline.",
      ],
      ["pnpm check:circular", "Run circular dependency guards."],
    ],
  },
  {
    title: "Affected Workflows",
    commands: [
      ["pnpm build:affected", "Build only packages affected by current branch changes."],
      ["pnpm test:affected", "Run affected tests using the current base ref resolution."],
      ["pnpm lint:affected", "Run lint only on affected workspace packages."],
      ["pnpm typecheck:affected", "Run typecheck only on affected workspace packages."],
    ],
  },
  {
    title: "Targeted E2E",
    commands: [
      ["pnpm test:e2e:core", "Run core workspace flows."],
      ["pnpm test:e2e:features", "Run feature-level flows."],
      ["pnpm test:e2e:smoke", "Run smoke checks."],
      ["pnpm test:e2e:a11y", "Run accessibility-focused E2E checks."],
    ],
  },
  {
    title: "Diagnostics",
    commands: [
      ["pnpm check:repo:sot", "Check naming, docs, and workspace source-of-truth files."],
      [
        "pnpm check:workflow-governance",
        "Check CI/workflow metadata, path filters, and shared-action coverage.",
      ],
      ["pnpm check:branch-policy", "Check current branch naming against repo policy."],
      ["pnpm repo:doctor", "Run repo diagnostics plus Codex readiness checks."],
      ["pnpm repo:doctor:strict", "Run strict repo diagnostics with remote fetch."],
      [
        "pnpm runtime:prove",
        "Run the internal runtime proving lane through the single root entrypoint.",
      ],
      ["pnpm code:integration:check", "Check code-runtime integration wiring."],
      ["pnpm collab:status", "Report ahead/behind/dirty state as JSON without mutating git."],
      ["pnpm collab:sync", "Run the collaboration sync loop helper."],
      ["pnpm collab:sync:fast", "Run collab sync using validate:fast before commit/push."],
      ["pnpm collab:sync:full", "Run collab sync using validate:full before commit/push."],
    ],
  },
  {
    title: "Internal Tools",
    commands: [
      [
        "pnpm -C tools/figma workflow:list",
        "List the internal Figma bridge and pipeline commands when design-tooling work is explicitly needed.",
      ],
      [
        "pnpm -C internal/runtime-proving workflow:list",
        "List the internal runtime proving commands when replay robustness work is explicitly needed.",
      ],
    ],
  },
];

function loadScripts() {
  const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, "utf8"));
  return packageJson.scripts ?? {};
}

function normalizeScriptName(command) {
  const trimmed = command.trim();
  if (!trimmed.startsWith("pnpm ")) {
    return null;
  }
  const tokens = trimmed.split(/\s+/u);
  if (tokens[1] === "-C") {
    return null;
  }
  const [, rawName = ""] = tokens;
  return rawName.length > 0 ? rawName : null;
}

function formatSection(section, scripts) {
  const lines = [`${section.title}:`];

  for (const [command, description] of section.commands) {
    const scriptName = normalizeScriptName(command);
    if (scriptName && !(scriptName in scripts) && scriptName !== "install") {
      continue;
    }
    const padded = command.padEnd(28, " ");
    lines.push(`  ${padded} ${description}`);
  }

  return lines.join("\n");
}

function main() {
  const scripts = loadScripts();
  const output = [
    OUTPUT_HEADER,
    "",
    WORKFLOW_SECTIONS.map((section) => formatSection(section, scripts)).join("\n\n"),
    "",
    INTERNAL_WORKFLOW_NOTE,
  ].join("\n");
  process.stdout.write(`${output}\n`);
}

main();
