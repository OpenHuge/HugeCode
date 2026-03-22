import {
  invalidInputError,
  methodUnavailableError,
  requiredInputError,
} from "./webMcpBridgeRuntimeToolHelpers";
import {
  type BuildRuntimeToolsOptions,
  resolveWorkspaceId,
  type WebMcpToolDescriptor,
} from "./webMcpBridgeRuntimeToolsShared";
import type { RuntimeAgentControl } from "./webMcpBridgeTypes";

type RuntimePatchControl = RuntimeAgentControl & {
  applyWorkspacePatch?: (input: {
    workspaceId: string;
    diff: string;
    dryRun?: boolean | null;
  }) => Promise<unknown>;
};

function requireApplyWorkspacePatch(
  control: RuntimePatchControl
): NonNullable<RuntimePatchControl["applyWorkspacePatch"]> {
  const candidate = control.applyWorkspacePatch;
  if (typeof candidate !== "function") {
    throw methodUnavailableError("apply-workspace-patch", "applyWorkspacePatch");
  }
  return candidate;
}

export function buildRuntimePatchTools(
  options: Pick<
    BuildRuntimeToolsOptions,
    "snapshot" | "runtimeControl" | "requireUserApproval" | "onApprovalRequest" | "helpers"
  >
): WebMcpToolDescriptor[] {
  const { snapshot, runtimeControl, requireUserApproval, onApprovalRequest, helpers } = options;
  const control = runtimeControl as RuntimePatchControl;

  return [
    {
      name: "apply-workspace-patch",
      description:
        "Apply a unified diff patch to the active workspace through runtime git apply with optional dry-run validation.",
      inputSchema: {
        type: "object",
        properties: {
          workspaceId: { type: "string" },
          diff: { type: "string" },
          dryRun: { type: "boolean" },
        },
        required: ["diff"],
      },
      annotations: {
        destructiveHint: true,
        title: "Apply Workspace Patch",
        taskSupport: "full",
      },
      execute: async (input, agent) => {
        const applyWorkspacePatch = requireApplyWorkspacePatch(control);
        const diff = typeof input.diff === "string" ? input.diff : null;
        if (diff === null) {
          throw requiredInputError("diff is required.");
        }
        if (diff.trim().length === 0) {
          throw invalidInputError("diff must not be empty.");
        }
        const dryRun = typeof input.dryRun === "boolean" ? input.dryRun : false;
        const workspaceId = resolveWorkspaceId(input, snapshot, helpers);
        if (!dryRun) {
          await helpers.confirmWriteAction(
            agent,
            requireUserApproval,
            `Apply workspace patch in ${snapshot.workspaceName}?`,
            onApprovalRequest
          );
        }
        const result = await applyWorkspacePatch({
          workspaceId,
          diff,
          dryRun,
        });
        return helpers.buildResponse(
          dryRun ? "Workspace patch dry-run completed." : "Workspace patch applied.",
          {
            workspaceId,
            result,
          }
        );
      },
    },
  ];
}
