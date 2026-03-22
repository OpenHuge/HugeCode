import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import {
  buildCodeRuntimeRpcSpec,
  CODE_RUNTIME_RPC_FREEZE_EFFECTIVE_AT,
} from "../src/codeRuntimeRpc";
import { CODE_RUNTIME_HOST_EVENT_KINDS } from "../src/index";
import {
  buildRuntimeRpcCompatArtifacts,
  COMPAT_LIFECYCLE_NOTE_PATH,
  SERVICE_LIB_PATH,
  TAURI_RPC_PATH,
} from "./runtime-rpc-compat-artifacts";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const workspaceRoot = resolve(scriptDir, "../../..");
const outputDir = resolve(workspaceRoot, "docs/runtime/spec");

type GeneratedSpecPayload = {
  generatedAt: string;
  rpc: ReturnType<typeof buildCodeRuntimeRpcSpec>;
  hostEventKinds: readonly string[];
};

function buildJson(payload: GeneratedSpecPayload): string {
  return `${JSON.stringify(payload, null, 2).replace(
    /\[\n(\s+)"([^"\n]+)"\n(\s+)\]/gu,
    '["$2"]'
  )}\n`;
}

function buildMarkdown(payload: GeneratedSpecPayload): string {
  const { rpc } = payload;
  const featureList = rpc.features.map((feature) => `- \`${feature}\``).join("\n");
  const canonicalMethodList = rpc.canonicalMethods.map((method) => `- \`${method}\``).join("\n");
  const advertisedMethodList = rpc.methods.map((method) => `- \`${method}\``).join("\n");
  const eventList = payload.hostEventKinds.map((kind) => `- \`${kind}\``).join("\n");
  const transportList = Object.entries(rpc.transports)
    .map(
      ([name, descriptor]) =>
        `- \`${name}\`: \`${descriptor.protocol}\` on \`${descriptor.endpointPath}\` (${descriptor.channel})`
    )
    .join("\n");
  const executionGraphFieldList = rpc.executionGraphFields
    .map((field) => `- \`${field}\``)
    .join("\n");
  return [
    "# Code Runtime RPC Frozen Spec",
    "",
    `- Generated at: \`${payload.generatedAt}\``,
    `- Contract version: \`${rpc.contractVersion}\``,
    `- Freeze effective at: \`${CODE_RUNTIME_RPC_FREEZE_EFFECTIVE_AT}\``,
    `- Method-set hash: \`${rpc.methodSetHash}\``,
    "",
    "## Features",
    "",
    featureList,
    "",
    "## RPC Methods (canonical)",
    "",
    canonicalMethodList,
    "",
    "## RPC Methods (advertised capabilities)",
    "",
    advertisedMethodList,
    "",
    "## Host Event Kinds",
    "",
    eventList,
    "",
    "## Transports",
    "",
    transportList,
    "",
    "## Task Truth Baseline",
    "",
    "The runtime-owned task responses for:",
    "",
    "- `code_runtime_run_start`",
    "- `code_runtime_run_subscribe`",
    "- `code_runtime_runs_list`",
    "",
    "must expose the canonical task-truth fields used by control-plane consumers:",
    "",
    "- `executionProfile`",
    "- `routing`",
    "- `profileReadiness`",
    "- `approvalState`",
    "- `intervention`",
    "- `operatorState`",
    "- `nextAction`",
    "- `reviewDecision`",
    "- `reviewPackId`",
    "- `publishHandoff`",
    "- `missionLinkage`",
    "- `reviewActionability`",
    "- `checkpointId`",
    "- `traceId`",
    "",
    "These fields are runtime truth, not UI-derived annotations. When the same semantics are shown in Mission Control, they must be derived from the same canonical runtime helpers.",
    "",
    "## Execution Graph Baseline",
    "",
    "The runtime-owned task responses also expose the distributed task graph baseline:",
    "",
    executionGraphFieldList,
    "",
    "The `executionGraph` payload is the canonical runtime summary for graph-aware task execution and recovery.",
    "",
    "## Notes",
    "",
    "- Canonical RPC spec source: `packages/code-runtime-host-contract/src/codeRuntimeRpc.ts`.",
    "- Compatibility aliases and lifecycle are tracked separately in `packages/code-runtime-host-contract/src/codeRuntimeRpcCompat.ts`.",
    "- Web/Tauri adapters should treat this file as the frozen source for the cutover batch.",
    "",
  ].join("\n");
}

function main(): void {
  const rpc = buildCodeRuntimeRpcSpec();
  const generatedAt = new Date().toISOString();
  const payload: GeneratedSpecPayload = {
    generatedAt,
    rpc,
    hostEventKinds: CODE_RUNTIME_HOST_EVENT_KINDS,
  };

  const versionedBase = `code-runtime-rpc-spec.${rpc.contractVersion}`;
  mkdirSync(outputDir, { recursive: true });

  const jsonPath = resolve(outputDir, `${versionedBase}.json`);
  const markdownPath = resolve(outputDir, `${versionedBase}.md`);
  writeFileSync(jsonPath, buildJson(payload), "utf8");
  writeFileSync(markdownPath, buildMarkdown(payload), "utf8");

  const compatArtifacts = buildRuntimeRpcCompatArtifacts(workspaceRoot);
  writeFileSync(compatArtifacts.serviceLibPath, compatArtifacts.nextServiceSource, "utf8");
  writeFileSync(compatArtifacts.tauriRpcPath, compatArtifacts.nextTauriSource, "utf8");
  writeFileSync(
    compatArtifacts.lifecycleNotePath,
    `${compatArtifacts.lifecycleMarkdown}\n`,
    "utf8"
  );

  process.stdout.write(
    `${jsonPath}\n${markdownPath}\n${resolve(workspaceRoot, SERVICE_LIB_PATH)}\n${resolve(workspaceRoot, TAURI_RPC_PATH)}\n${resolve(workspaceRoot, COMPAT_LIFECYCLE_NOTE_PATH)}\n`
  );
}

main();
