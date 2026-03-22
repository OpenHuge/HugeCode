import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { CODE_RUNTIME_RPC_CONTRACT_VERSION } from "../src/codeRuntimeRpc";
import { CODE_RUNTIME_RPC_COMPAT_FIELD_LIFECYCLE } from "../src/codeRuntimeRpcCompat";

export const COMPAT_LIFECYCLE_NOTE_PATH = `docs/runtime/spec/code-runtime-rpc-compat-lifecycle.${CODE_RUNTIME_RPC_CONTRACT_VERSION}.md`;
export const SERVICE_LIB_PATH = "packages/code-runtime-service-rs/src/lib.rs";
export const TAURI_RPC_PATH = "apps/code-tauri/src-tauri/src/commands/rpc.rs";

function formatLifecycleList(fields: readonly string[]): string {
  return fields.length > 0 ? fields.map((field) => `- \`${field}\``).join("\n") : "- None";
}

export function buildCompatLifecycleMarkdown(): string {
  return [
    "# Code Runtime RPC Compat Lifecycle",
    "",
    `- Contract version: \`${CODE_RUNTIME_RPC_CONTRACT_VERSION}\``,
    "- Canonical source: `packages/code-runtime-host-contract/src/codeRuntimeRpc.ts`",
    "- Compat source: `packages/code-runtime-host-contract/src/codeRuntimeRpcCompat.ts`",
    "- Generated alongside the frozen RPC spec and Rust parity surfaces.",
    "",
    "## Still Needed",
    "",
    formatLifecycleList(CODE_RUNTIME_RPC_COMPAT_FIELD_LIFECYCLE.stillNeeded),
    "",
    "These aliases remain part of the frozen cross-runtime compatibility surface.",
    "",
    "## Soft Deprecated",
    "",
    formatLifecycleList(CODE_RUNTIME_RPC_COMPAT_FIELD_LIFECYCLE.softDeprecated),
    "",
    "These aliases are still generated but should not gain new callers.",
    "",
    "## Removable Now",
    "",
    formatLifecycleList(CODE_RUNTIME_RPC_COMPAT_FIELD_LIFECYCLE.removableNow),
    "",
    "These entries are compatibility no-ops or fully superseded. Keep them visible until the next explicit compat prune window, then delete them from the TS registry and regenerate artifacts.",
  ].join("\n");
}

export function buildRuntimeRpcCompatArtifacts(workspaceRoot: string) {
  const serviceLibPath = resolve(workspaceRoot, SERVICE_LIB_PATH);
  const tauriRpcPath = resolve(workspaceRoot, TAURI_RPC_PATH);

  return {
    serviceLibPath,
    tauriRpcPath,
    lifecycleNotePath: resolve(workspaceRoot, COMPAT_LIFECYCLE_NOTE_PATH),
    nextServiceSource: readFileSync(serviceLibPath, "utf8"),
    nextTauriSource: readFileSync(tauriRpcPath, "utf8"),
    lifecycleMarkdown: buildCompatLifecycleMarkdown(),
  };
}
