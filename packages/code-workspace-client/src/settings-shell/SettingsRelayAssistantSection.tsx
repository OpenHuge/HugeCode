import { useMemo, useState } from "react";
import { Button, Input, Select, Textarea, type SelectOption } from "@ku0/design-system";
import * as controlStyles from "./SettingsFormControls.css";
import { SettingsField, SettingsFieldGroup, SettingsFooterBar } from "./SettingsSectionGrammar";
import { settingsServerCompactSelectProps } from "./settingsServerControlPlaneShared";
import type { SettingsRelayAssistantSurface } from "./serverControlPlaneTypes";
import {
  buildRelayAssistantGeneratedConfig,
  createRelayAssistantDraft,
  RELAY_ASSISTANT_PRESETS,
  resolveRelayAssistantPreset,
  type SettingsRelayAssistantDraft,
  type SettingsRelayAssistantGeneratedConfig,
  type SettingsRelayAssistantKind,
} from "./relayAssistant";

export type SettingsRelayAssistantSectionProps = {
  surface?: SettingsRelayAssistantSurface | null;
};

function formatRelayNotes(notes: string[]): string {
  return notes.join(" ");
}

async function copyToClipboard(value: string): Promise<boolean> {
  const clipboard = typeof navigator === "undefined" ? null : navigator.clipboard;
  if (!clipboard?.writeText) {
    return false;
  }
  await clipboard.writeText(value);
  return true;
}

function updateDraftField<Key extends keyof SettingsRelayAssistantDraft>(
  draft: SettingsRelayAssistantDraft,
  key: Key,
  value: SettingsRelayAssistantDraft[Key]
): SettingsRelayAssistantDraft {
  return {
    ...draft,
    [key]: value,
  };
}

export function SettingsRelayAssistantSection({ surface }: SettingsRelayAssistantSectionProps) {
  const [draft, setDraft] = useState<SettingsRelayAssistantDraft>(() =>
    createRelayAssistantDraft(surface?.defaultKind ?? "new-api")
  );
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const compactInputFieldClassName = `${controlStyles.inputField} ${controlStyles.inputFieldCompact}`;
  const preset = resolveRelayAssistantPreset(draft.kind);
  const generated = useMemo(() => buildRelayAssistantGeneratedConfig(draft), [draft]);
  const relayOptions: SelectOption[] = RELAY_ASSISTANT_PRESETS.map((entry) => ({
    value: entry.id,
    label: entry.label,
  }));
  const actionBlocked = generated.diagnostics.length > 0;

  const applyGeneratedConfig = async (
    config: SettingsRelayAssistantGeneratedConfig
  ): Promise<void> => {
    if (!surface?.onApplyConfig) {
      const copied = await copyToClipboard(
        [
          config.shellExports,
          config.codexConfigToml,
          config.qualityProbeScript,
          config.qualityPlugin.manifestJson,
        ].join("\n\n")
      );
      setActionMessage(
        copied
          ? "No local settings writer is connected. Local setup and relay quality plugin copied."
          : "No local settings writer is connected. Use the generated exports shown above."
      );
      return;
    }
    await surface.onApplyConfig(config);
    setActionMessage("Relay provider config applied to the local settings writer.");
  };

  return (
    <SettingsFieldGroup
      title="Relay assistant"
      subtitle="Convert Sub2API, New API, One API, or any OpenAI-compatible relay into a local provider extension for the runtime and shell."
    >
      <SettingsField
        label="Relay type"
        help="The preset only changes defaults and guidance. The generated runtime contract remains provider-extension JSON plus one token environment variable."
      >
        <Select
          {...settingsServerCompactSelectProps}
          ariaLabel="Relay type"
          options={relayOptions}
          value={draft.kind}
          onValueChange={(value) => {
            const nextKind = value as SettingsRelayAssistantKind;
            setDraft(createRelayAssistantDraft(nextKind));
            setActionMessage(null);
          }}
        />
      </SettingsField>

      <SettingsField label="Gateway base URL" htmlFor="relay-assistant-base-url">
        <Input
          id="relay-assistant-base-url"
          fieldClassName={compactInputFieldClassName}
          inputSize="sm"
          value={draft.baseUrl}
          onValueChange={(value) => {
            setDraft((previous) => updateDraftField(previous, "baseUrl", value));
            setActionMessage(null);
          }}
          placeholder={preset.baseUrlPlaceholder}
        />
      </SettingsField>

      <SettingsField
        label="Provider identity"
        help="Provider id and pool are normalized to the runtime extension identifier format."
      >
        <div>
          <Input
            fieldClassName={compactInputFieldClassName}
            inputSize="sm"
            value={draft.providerId}
            onValueChange={(value) => {
              setDraft((previous) => updateDraftField(previous, "providerId", value));
              setActionMessage(null);
            }}
            placeholder={preset.providerId}
          />
          <Input
            fieldClassName={compactInputFieldClassName}
            inputSize="sm"
            value={draft.pool}
            onValueChange={(value) => {
              setDraft((previous) => updateDraftField(previous, "pool", value));
              setActionMessage(null);
            }}
            placeholder={preset.pool}
          />
        </div>
      </SettingsField>

      <SettingsField
        label="Model and token"
        help="Paste the real token into the generated env line locally. The assistant does not persist secrets."
      >
        <div>
          <Input
            fieldClassName={compactInputFieldClassName}
            inputSize="sm"
            value={draft.defaultModelId}
            onValueChange={(value) => {
              setDraft((previous) => updateDraftField(previous, "defaultModelId", value));
              setActionMessage(null);
            }}
            placeholder={preset.defaultModelId}
          />
          <Input
            fieldClassName={compactInputFieldClassName}
            inputSize="sm"
            value={draft.tokenEnvKey}
            onValueChange={(value) => {
              setDraft((previous) => updateDraftField(previous, "tokenEnvKey", value));
              setActionMessage(null);
            }}
            placeholder={preset.tokenEnvKey}
          />
        </div>
      </SettingsField>

      <SettingsField label="Connection analysis" help={formatRelayNotes(preset.notes)}>
        <div>
          <div>{preset.summary}</div>
          <div>
            Runtime provider: {generated.providerExtension.providerId}; base URL:{" "}
            {generated.providerExtension.compatBaseUrl || "not configured"}
          </div>
          <div>
            Quality plugin: {generated.qualityPlugin.pluginId}; checks:{" "}
            {generated.qualityPlugin.capabilities.join(", ")}
          </div>
        </div>
      </SettingsField>

      <SettingsField
        label="Local setup exports"
        help="Source these exports before starting the embedded runtime, or hand them to the desktop host settings writer when one is connected."
      >
        <Textarea
          fieldClassName={controlStyles.textareaField}
          className={controlStyles.textareaCode}
          value={generated.shellExports}
          onChange={() => undefined}
          spellCheck={false}
          textareaSize="lg"
          readOnly
        />
      </SettingsField>

      <SettingsField
        label="Codex shell config"
        help="For a local Codex CLI shell, merge this provider block into config.toml and keep the token in the env key above."
      >
        <Textarea
          fieldClassName={controlStyles.textareaField}
          className={controlStyles.textareaCode}
          value={generated.codexConfigToml}
          onChange={() => undefined}
          spellCheck={false}
          textareaSize="lg"
          readOnly
        />
      </SettingsField>

      <SettingsField
        label="Relay quality probe"
        help="Run this local probe after exporting the token to check the relay station before routing user work through it."
      >
        <Textarea
          fieldClassName={controlStyles.textareaField}
          className={controlStyles.textareaCode}
          value={generated.qualityProbeScript}
          onChange={() => undefined}
          spellCheck={false}
          textareaSize="lg"
          readOnly
        />
      </SettingsField>

      <SettingsField
        label="Quality plugin manifest"
        help="This declaration gives local HugeRouter quality tooling a stable plugin id, provider binding, and check list without storing the relay token."
      >
        <Textarea
          fieldClassName={controlStyles.textareaField}
          className={controlStyles.textareaCode}
          value={generated.qualityPlugin.manifestJson}
          onChange={() => undefined}
          spellCheck={false}
          textareaSize="lg"
          readOnly
        />
      </SettingsField>

      {generated.diagnostics.map((diagnostic) => (
        <div key={diagnostic} className="settings-help settings-help-error">
          {diagnostic}
        </div>
      ))}
      {actionMessage ? <div className="settings-help">{actionMessage}</div> : null}

      <SettingsFooterBar>
        <Button
          variant="secondary"
          size="sm"
          disabled={actionBlocked}
          onClick={() => {
            void copyToClipboard(
              [
                generated.shellExports,
                generated.codexConfigToml,
                generated.qualityProbeScript,
                generated.qualityPlugin.manifestJson,
              ].join("\n\n")
            )
              .then((copied) => {
                setActionMessage(
                  copied
                    ? "Local setup, Codex shell config, and relay quality plugin copied."
                    : "Clipboard is unavailable. Use the generated exports shown above."
                );
              })
              .catch(() => {
                setActionMessage("Copy failed. Use the generated exports shown above.");
              });
          }}
        >
          Copy local setup
        </Button>
        <Button
          variant="primary"
          size="sm"
          disabled={actionBlocked}
          onClick={() => {
            void applyGeneratedConfig(generated).catch((error: unknown) => {
              const message = error instanceof Error ? error.message : "Apply failed.";
              setActionMessage(message);
            });
          }}
        >
          Apply locally
        </Button>
      </SettingsFooterBar>
    </SettingsFieldGroup>
  );
}
