import { useEffect, useState } from "react";
import type { WorkspaceInfo } from "../../../types";
import { ToolCallChip } from "../../../design-system";
import * as controlStyles from "./WorkspaceHomeAgentControl.styles.css";
import { MissionControlSectionCard } from "./WorkspaceHomeMissionControlSections";
import { useRuntimeAiWebLabController } from "../../../application/runtime/facades/runtimeAiWebLabController";
import type { DesktopAiWebLabArtifact } from "../../../application/runtime/ports/aiWebLab";

type WorkspaceHomeAiWebLabSectionProps = {
  workspace: WorkspaceInfo;
  onApplyArtifactToDraft: (artifact: DesktopAiWebLabArtifact) => void;
};

export function WorkspaceHomeAiWebLabSection({
  workspace,
  onApplyArtifactToDraft,
}: WorkspaceHomeAiWebLabSectionProps) {
  const aiWebLab = useRuntimeAiWebLabController({
    workspace,
    onApplyArtifactToDraft,
  });
  const state = aiWebLab.state;
  const artifact = state?.lastArtifact ?? null;
  const statusLabel =
    artifact?.status === "succeeded" ? "Ready" : state?.managedWindowOpen ? "Live" : "Idle";
  const statusTone =
    artifact?.status === "succeeded" ? "success" : state?.managedWindowOpen ? "running" : "neutral";
  const provider = state?.providerId ?? aiWebLab.settings.defaultProvider;
  const [draftBaseRef, setDraftBaseRef] = useState(aiWebLab.settings.defaultBaseRef);
  const [draftProviderUrls, setDraftProviderUrls] = useState(aiWebLab.settings.providerUrls);
  const configuredProviderUrl = aiWebLab.settings.providerUrls[provider];
  const providerUrl = draftProviderUrls[provider] ?? configuredProviderUrl;
  const providerDescriptor =
    aiWebLab.catalog?.providers.find((entry) => entry.providerId === provider) ?? null;
  const baseRefIsDirty = draftBaseRef.trim() !== aiWebLab.settings.defaultBaseRef;
  const providerUrlIsDirty = providerUrl.trim() !== configuredProviderUrl;

  useEffect(() => {
    setDraftBaseRef(aiWebLab.settings.defaultBaseRef);
  }, [aiWebLab.settings.defaultBaseRef]);

  useEffect(() => {
    setDraftProviderUrls(aiWebLab.settings.providerUrls);
  }, [aiWebLab.settings.providerUrls]);

  return (
    <MissionControlSectionCard
      title="AI Web Lab"
      statusLabel={statusLabel}
      statusTone={statusTone}
      meta={
        <>
          <ToolCallChip tone="neutral">Provider {provider}</ToolCallChip>
          <ToolCallChip tone="neutral">
            Session {aiWebLab.settings.preferredSessionMode}
          </ToolCallChip>
          <ToolCallChip tone="neutral">View {aiWebLab.settings.preferredViewMode}</ToolCallChip>
        </>
      }
    >
      <div className="workspace-home-code-runtime-item" data-testid="workspace-runtime-ai-web-lab">
        <div className="workspace-home-code-runtime-item-main">
          <strong>Multi-provider web workbench</strong>
          <span>
            Use ChatGPT or Gemini web surfaces for prompt refinement, research, reusable workflows,
            and artifact handoff back into Mission Control.
          </span>
          <span>
            Current target: {configuredProviderUrl} | attached Chrome targets:{" "}
            {state?.attachedEndpointCount ?? 0}
          </span>
          {state?.statusMessage ? <span>{state.statusMessage}</span> : null}
          {state?.actualUrl ? <span>Active URL: {state.actualUrl}</span> : null}
          {state?.pageTitle ? <span>Page title: {state.pageTitle}</span> : null}
          {aiWebLab.worktreeRecommendation ? <span>{aiWebLab.worktreeRecommendation}</span> : null}
        </div>
      </div>

      <div className={controlStyles.controlGrid}>
        <label className={controlStyles.field}>
          <span>Provider</span>
          <select
            className={controlStyles.fieldControl}
            value={aiWebLab.settings.defaultProvider}
            onChange={(event) =>
              void aiWebLab.setDefaultProvider(
                event.target.value === "gemini" ? "gemini" : "chatgpt"
              )
            }
          >
            <option value="chatgpt">ChatGPT</option>
            <option value="gemini">Gemini</option>
          </select>
        </label>
        <label className={controlStyles.field}>
          <span>Session mode</span>
          <select
            className={controlStyles.fieldControl}
            value={aiWebLab.settings.preferredSessionMode}
            onChange={(event) =>
              void aiWebLab.setPreferredSessionMode(
                event.target.value === "attached" ? "attached" : "managed"
              )
            }
          >
            <option value="managed">Managed HugeCode session</option>
            <option value="attached">Attached local Chrome</option>
          </select>
        </label>
        <label className={controlStyles.field}>
          <span>View mode</span>
          <select
            className={controlStyles.fieldControl}
            value={aiWebLab.settings.preferredViewMode}
            onChange={(event) =>
              void aiWebLab.setPreferredViewMode(
                event.target.value === "window" ? "window" : "docked"
              )
            }
          >
            <option value="docked">Docked control surface</option>
            <option value="window">Dedicated window</option>
          </select>
        </label>
        <label className={controlStyles.field}>
          <span>Base ref</span>
          <input
            className={controlStyles.fieldControl}
            type="text"
            value={draftBaseRef}
            onChange={(event) => setDraftBaseRef(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && baseRefIsDirty && !aiWebLab.loading) {
                void aiWebLab.setDefaultBaseRef(draftBaseRef);
              }
            }}
            placeholder="origin/main"
          />
        </label>
      </div>

      <div className={controlStyles.controlGrid}>
        <label className={controlStyles.field}>
          <span>{provider} URL</span>
          <input
            className={controlStyles.fieldControl}
            type="url"
            value={providerUrl}
            onChange={(event) =>
              setDraftProviderUrls((current) => ({
                ...current,
                [provider]: event.target.value,
              }))
            }
            onKeyDown={(event) => {
              if (event.key === "Enter" && providerUrlIsDirty && !aiWebLab.loading) {
                void aiWebLab.saveProviderUrl(provider, providerUrl);
              }
            }}
          />
        </label>
      </div>

      <div className={controlStyles.actions}>
        <button
          className={controlStyles.actionButton}
          type="button"
          onClick={() => void aiWebLab.setDefaultBaseRef(draftBaseRef)}
          disabled={aiWebLab.loading || !baseRefIsDirty}
        >
          Save base ref
        </button>
        <button
          className={controlStyles.actionButton}
          type="button"
          onClick={() => void aiWebLab.saveProviderUrl(provider, providerUrl)}
          disabled={aiWebLab.loading || !providerUrlIsDirty}
        >
          Save URL
        </button>
        <button
          className={controlStyles.actionButton}
          type="button"
          onClick={() => void aiWebLab.openSession()}
          disabled={aiWebLab.loading}
        >
          Open AI Web Lab
        </button>
        <button
          className={controlStyles.actionButton}
          type="button"
          onClick={() => void aiWebLab.focusSession()}
          disabled={aiWebLab.loading}
        >
          Focus
        </button>
        <button
          className={controlStyles.actionButton}
          type="button"
          onClick={() => void aiWebLab.extractArtifact()}
          disabled={aiWebLab.extracting}
        >
          {aiWebLab.extracting ? "Extracting..." : "Extract artifact"}
        </button>
        <button
          className={controlStyles.actionButton}
          type="button"
          onClick={aiWebLab.applyArtifactToDraft}
          disabled={!aiWebLab.canApplyArtifactToDraft}
        >
          Attach to mission draft
        </button>
        <button
          className={controlStyles.actionButton}
          type="button"
          onClick={() => void aiWebLab.closeSession()}
          disabled={aiWebLab.loading}
        >
          Close
        </button>
      </div>

      {providerDescriptor?.entrypoints?.length ? (
        <div className={controlStyles.actions}>
          {providerDescriptor.entrypoints.map((entrypoint) => (
            <button
              key={`${providerDescriptor.providerId}:${entrypoint.id}`}
              className={controlStyles.actionButton}
              type="button"
              onClick={() =>
                void aiWebLab.openEntrypoint(providerDescriptor.providerId, entrypoint.id)
              }
              disabled={aiWebLab.loading}
            >
              Open {entrypoint.label}
            </button>
          ))}
        </div>
      ) : null}

      <div className={controlStyles.actions}>
        <label className={controlStyles.field}>
          <input
            type="checkbox"
            checked={aiWebLab.settings.autoAttachArtifact}
            onChange={(event) => void aiWebLab.setAutoAttachArtifact(event.target.checked)}
          />
          Auto-attach successful artifacts to the mission draft
        </label>
        <label className={controlStyles.field}>
          <input
            type="checkbox"
            checked={aiWebLab.settings.autoCreateWorktree}
            onChange={(event) => void aiWebLab.setAutoCreateWorktree(event.target.checked)}
          />
          Prefer worktree-first AI Web Lab flow
        </label>
      </div>

      {aiWebLab.note ? <div className={controlStyles.emptyState}>{aiWebLab.note}</div> : null}
      {aiWebLab.error ? <div className={controlStyles.error}>{aiWebLab.error}</div> : null}
      {artifact ? (
        <div className="workspace-home-code-runtime-item">
          <div className="workspace-home-code-runtime-item-main">
            <strong>Latest artifact</strong>
            <span>
              Provider: {artifact.providerId} | kind: {artifact.artifactKind} | status:{" "}
              {artifact.status}
            </span>
            {artifact.sourceUrl ? <span>Source URL: {artifact.sourceUrl}</span> : null}
            {artifact.pageTitle ? <span>Source title: {artifact.pageTitle}</span> : null}
            {artifact.errorMessage ? <span>{artifact.errorMessage}</span> : null}
            {artifact.content ? (
              <div className={controlStyles.extractionPreview}>{artifact.content}</div>
            ) : null}
          </div>
        </div>
      ) : null}
    </MissionControlSectionCard>
  );
}
