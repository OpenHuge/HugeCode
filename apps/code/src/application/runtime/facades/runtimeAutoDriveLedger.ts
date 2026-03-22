import type {
  AutoDriveContextSnapshot,
  AutoDriveIterationSummary,
  AutoDriveLedger,
  AutoDrivePublishHandoff,
  AutoDriveRouteProposal,
  AutoDriveRunRecord,
} from "../types/autoDrive";
import { buildAutoDrivePublishHandoff } from "./runtimeAutoDrivePublishHandoff";
import { buildAutoDrivePublishRecoveryArtifact } from "./runtimeAutoDrivePublishRecoveryArtifact";
// Deterministic fixture persistence only. Production AutoDrive truth is runtime-owned.

type AutoDriveLedgerDeps = {
  writeArtifact: (path: string, content: string) => Promise<void>;
  readArtifact: (path: string) => Promise<string | null>;
};

function stringifyJson(value: unknown): string {
  return JSON.stringify(value, null, 2);
}

function buildRunRoot(runId: string): string {
  return `.hugecode/runs/${runId}`;
}

export function createAutoDriveLedger(deps: AutoDriveLedgerDeps): AutoDriveLedger {
  const writePublishHandoffArtifacts = async (params: {
    runId: string;
    handoff: AutoDrivePublishHandoff;
    markdown: string;
  }) => {
    const runRoot = buildRunRoot(params.runId);
    const publishRoot = `${runRoot}/publish`;
    await deps.writeArtifact(`${publishRoot}/handoff.json`, stringifyJson(params.handoff));
    await deps.writeArtifact(`${publishRoot}/handoff.md`, params.markdown);
    await deps.writeArtifact(`${publishRoot}/pr-body.md`, params.handoff.reviewDraft.body);
    await deps.writeArtifact(
      `${publishRoot}/pr-create.sh`,
      ["#!/usr/bin/env bash", "set -euo pipefail", params.handoff.operatorCommands[0] ?? ""].join(
        "\n"
      )
    );
  };

  return {
    writeRun: async (run: AutoDriveRunRecord) => {
      await deps.writeArtifact(`${buildRunRoot(run.runId)}/run.json`, stringifyJson(run));
    },
    writeContext: async (context: AutoDriveContextSnapshot) => {
      await deps.writeArtifact(
        `${buildRunRoot(context.runId)}/context/${context.iteration}.json`,
        stringifyJson(context)
      );
    },
    writeProposal: async (proposal: AutoDriveRouteProposal) => {
      await deps.writeArtifact(
        `${buildRunRoot(proposal.runId)}/next-task/${proposal.iteration}.json`,
        stringifyJson(proposal)
      );
    },
    writeSummary: async (summary: AutoDriveIterationSummary) => {
      await deps.writeArtifact(
        `${buildRunRoot(summary.runId)}/summary/${summary.iteration}.json`,
        stringifyJson(summary)
      );
    },
    writeReroute: async ({ runId, iteration, reroute }) => {
      await deps.writeArtifact(
        `${buildRunRoot(runId)}/reroute/${iteration}.json`,
        stringifyJson(reroute)
      );
    },
    writeFinalReport: async ({ run, latestSummary, markdown }) => {
      const runRoot = buildRunRoot(run.runId);
      const publishHandoff = buildAutoDrivePublishHandoff({
        run,
        latestSummary,
      });
      const publishRecovery = buildAutoDrivePublishRecoveryArtifact({
        run,
        latestSummary,
      });
      const finalReport =
        publishHandoff === null && publishRecovery === null
          ? markdown
          : [
              markdown.trimEnd(),
              ...(publishHandoff === null
                ? []
                : [
                    "",
                    "## Publish Handoff",
                    "",
                    `- JSON: \`${runRoot}/publish/handoff.json\``,
                    `- Markdown: \`${runRoot}/publish/handoff.md\``,
                    `- Branch: \`${publishHandoff.handoff.publish.branchName}\``,
                  ]),
              ...(publishRecovery === null
                ? []
                : [
                    "",
                    "## Publish Recovery",
                    "",
                    `- Markdown: \`${runRoot}/publish/recovery.md\``,
                  ]),
            ].join("\n");
      await deps.writeArtifact(`${runRoot}/final-report.md`, finalReport);
      if (publishHandoff) {
        await writePublishHandoffArtifacts({
          runId: run.runId,
          handoff: publishHandoff.handoff,
          markdown: publishHandoff.markdown,
        });
      }
      if (!publishRecovery) {
        return;
      }
      await deps.writeArtifact(`${runRoot}/publish/recovery.md`, publishRecovery.markdown);
      if (publishRecovery.retryScript) {
        await deps.writeArtifact(`${runRoot}/publish/retry.sh`, publishRecovery.retryScript);
      }
    },
    writePublishHandoff: async ({ runId, handoff, markdown }) => {
      await writePublishHandoffArtifacts({
        runId,
        handoff,
        markdown,
      });
    },
    readRun: async (runId: string) => {
      const raw = await deps.readArtifact(`${buildRunRoot(runId)}/run.json`);
      if (!raw) {
        return null;
      }
      try {
        return JSON.parse(raw) as AutoDriveRunRecord;
      } catch {
        return null;
      }
    },
  };
}
