import {
  Button,
  DialogDescription,
  DialogTitle,
  Input,
  ModalShell,
  Select,
  Textarea,
  type SelectOption,
} from "../../../../../design-system";
import type { AcpIntegrationSummary } from "../../../../../application/runtime/ports/tauriRemoteServers";
import * as controlStyles from "../../SettingsFormControls.css";
import { SettingsField, SettingsFooterBar } from "../../SettingsSectionGrammar";
import {
  type AcpBackendFormMode,
  type AcpBackendFormState,
  validateAcpKeyValueEntries,
} from "./acpBackendForm";
import { AcpProbeStatusSummary } from "./AcpProbeStatusSummary";
import { KeyValueListEditor } from "./KeyValueListEditor";
import * as styles from "./AcpBackendEditorDialog.css";

type AcpBackendEditorDialogProps = {
  open: boolean;
  mode: AcpBackendFormMode;
  draft: AcpBackendFormState;
  saving?: boolean;
  error?: string | null;
  probeEnabled?: boolean;
  probeBusy?: boolean;
  integrationObservation?: AcpIntegrationSummary | null;
  onClose: () => void;
  onDraftChange: (draft: AcpBackendFormState) => void;
  onSubmit: () => void;
  onProbe?: () => void;
};

function updateDraft(
  draft: AcpBackendFormState,
  patch: Partial<AcpBackendFormState>
): AcpBackendFormState {
  const next = { ...draft, ...patch };
  if (patch.transport === "stdio") {
    next.endpoint = draft.endpoint;
    next.experimentalHttp = draft.experimentalHttp;
    next.headerEntries = draft.headerEntries;
  }
  if (patch.transport === "http") {
    next.command = draft.command;
    next.argsText = draft.argsText;
    next.cwd = draft.cwd;
    next.envEntries = draft.envEntries;
  }
  return next;
}

const backendClassOptions: SelectOption[] = [
  { value: "primary", label: "Primary" },
  { value: "burst", label: "Burst" },
  { value: "specialized", label: "Specialized" },
];

const transportOptions: SelectOption[] = [
  { value: "stdio", label: "STDIO" },
  { value: "http", label: "HTTP" },
];

const stateOptions: SelectOption[] = [
  { value: "active", label: "Active" },
  { value: "draining", label: "Draining" },
  { value: "disabled", label: "Disabled" },
  { value: "degraded", label: "Degraded" },
];

export function AcpBackendEditorDialog({
  open,
  mode,
  draft,
  saving = false,
  error = null,
  probeEnabled = false,
  probeBusy = false,
  integrationObservation = null,
  onClose,
  onDraftChange,
  onSubmit,
  onProbe,
}: AcpBackendEditorDialogProps) {
  const isEditMode = mode === "edit";
  const title = isEditMode ? "Edit ACP backend" : "Add ACP backend";
  const submitLabel = saving
    ? isEditMode
      ? "Saving..."
      : "Adding..."
    : isEditMode
      ? "Save ACP backend"
      : "Add ACP backend";
  const envValidation = validateAcpKeyValueEntries(draft.envEntries, "environment");
  const headerValidation = validateAcpKeyValueEntries(draft.headerEntries, "header");
  const activeValidation = draft.transport === "stdio" ? envValidation : headerValidation;
  const validationMessage =
    activeValidation.issues[0]?.message ??
    (draft.transport === "stdio"
      ? "Resolve environment entry validation before saving."
      : "Resolve HTTP header validation before saving.");
  const submitDisabled = saving || !activeValidation.isValid;
  const compactInputFieldClassName = `${controlStyles.inputField} ${controlStyles.inputFieldCompact}`;
  const compactSelectProps = {
    className: controlStyles.selectRoot,
    triggerClassName: controlStyles.selectTrigger,
    menuClassName: controlStyles.selectMenu,
    optionClassName: controlStyles.selectOption,
    triggerDensity: "compact" as const,
  };

  if (!open) {
    return null;
  }

  return (
    <ModalShell
      className="settings-overlay"
      cardClassName={styles.card}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) {
          onClose();
        }
      }}
      ariaLabel={title}
    >
      <form
        className={styles.form}
        onSubmit={(event) => {
          event.preventDefault();
          if (!activeValidation.isValid) {
            return;
          }
          onSubmit();
        }}
      >
        <DialogTitle>{title}</DialogTitle>
        <DialogDescription>
          Configure the ACP integration without changing the runtime’s canonical backend model.
        </DialogDescription>

        <SettingsField
          label="Integration ID"
          help={
            isEditMode
              ? "Integration identity is immutable so existing backend projection and task routing stay stable."
              : undefined
          }
        >
          {isEditMode ? (
            <div className="settings-help">{draft.integrationId}</div>
          ) : (
            <Input
              type="text"
              aria-label="Integration ID"
              fieldClassName={compactInputFieldClassName}
              inputSize="sm"
              value={draft.integrationId}
              onValueChange={(value) => {
                onDraftChange(updateDraft(draft, { integrationId: value }));
              }}
            />
          )}
        </SettingsField>

        <SettingsField label="Display name">
          <Input
            type="text"
            aria-label="Display name"
            fieldClassName={compactInputFieldClassName}
            inputSize="sm"
            value={draft.displayName}
            onValueChange={(value) => {
              onDraftChange(updateDraft(draft, { displayName: value }));
            }}
          />
        </SettingsField>

        <SettingsField
          label="Backend ID"
          help="Leave empty to use the default `acp:<integrationId>` projection identity."
        >
          <Input
            type="text"
            aria-label="Backend ID"
            fieldClassName={compactInputFieldClassName}
            inputSize="sm"
            value={draft.backendId}
            onValueChange={(value) => {
              onDraftChange(updateDraft(draft, { backendId: value }));
            }}
          />
        </SettingsField>

        <SettingsField
          label="Backend class"
          help="This labels the backend’s pool role for operator workflows only. Runtime still owns resolved placement truth."
        >
          <Select
            aria-label="Backend class"
            {...compactSelectProps}
            options={backendClassOptions}
            value={draft.backendClass}
            onValueChange={(value) => {
              onDraftChange(
                updateDraft(draft, {
                  backendClass:
                    value === "burst"
                      ? "burst"
                      : value === "specialized"
                        ? "specialized"
                        : "primary",
                })
              );
            }}
          />
        </SettingsField>

        <SettingsField
          label="Specializations"
          help="Optional tags, one per line, for specialized ACP nodes."
        >
          <Textarea
            aria-label="Specializations"
            fieldClassName={controlStyles.textareaField}
            className={styles.textarea}
            textareaSize="sm"
            value={draft.specializationsText}
            onChange={(event) => {
              onDraftChange(updateDraft(draft, { specializationsText: event.target.value }));
            }}
          />
        </SettingsField>

        <SettingsField label="Transport">
          <Select
            aria-label="Transport"
            {...compactSelectProps}
            options={transportOptions}
            value={draft.transport}
            onValueChange={(value) => {
              onDraftChange(
                updateDraft(draft, {
                  transport: value === "http" ? "http" : "stdio",
                })
              );
            }}
          />
        </SettingsField>

        {draft.transport === "stdio" ? (
          <>
            <SettingsField label="Command">
              <Input
                type="text"
                aria-label="Command"
                fieldClassName={compactInputFieldClassName}
                inputSize="sm"
                value={draft.command}
                onValueChange={(value) => {
                  onDraftChange(updateDraft(draft, { command: value }));
                }}
              />
            </SettingsField>

            <SettingsField label="Args" help="One CLI argument per line.">
              <Textarea
                aria-label="Args"
                fieldClassName={controlStyles.textareaField}
                className={styles.textarea}
                textareaSize="sm"
                value={draft.argsText}
                onChange={(event) => {
                  onDraftChange(updateDraft(draft, { argsText: event.target.value }));
                }}
              />
            </SettingsField>

            <SettingsField label="Working directory">
              <Input
                type="text"
                aria-label="Working directory"
                fieldClassName={compactInputFieldClassName}
                inputSize="sm"
                value={draft.cwd}
                onValueChange={(value) => {
                  onDraftChange(updateDraft(draft, { cwd: value }));
                }}
              />
            </SettingsField>

            <SettingsField
              label="Environment overrides"
              help="Add structured `KEY` / `VALUE` entries."
            >
              <KeyValueListEditor
                entries={draft.envEntries}
                emptyState="No environment overrides configured."
                addLabel="Add environment variable"
                keyLabel="Environment key"
                valueLabel="Environment value"
                validationIssues={envValidation.issues}
                onChange={(entries) => {
                  onDraftChange(updateDraft(draft, { envEntries: entries }));
                }}
              />
            </SettingsField>
          </>
        ) : (
          <>
            <SettingsField label="Endpoint">
              <Input
                type="text"
                aria-label="Endpoint"
                fieldClassName={compactInputFieldClassName}
                inputSize="sm"
                value={draft.endpoint}
                onValueChange={(value) => {
                  onDraftChange(updateDraft(draft, { endpoint: value }));
                }}
              />
            </SettingsField>

            <SettingsField label="HTTP headers" help="Add structured header name and value pairs.">
              <KeyValueListEditor
                entries={draft.headerEntries}
                emptyState="No HTTP headers configured."
                addLabel="Add header"
                keyLabel="HTTP header name"
                valueLabel="HTTP header value"
                validationIssues={headerValidation.issues}
                onChange={(entries) => {
                  onDraftChange(updateDraft(draft, { headerEntries: entries }));
                }}
              />
            </SettingsField>

            <SettingsField
              label="HTTP rollout"
              help="Keep this visible in operator workflows so draft HTTP transport assumptions stay explicit."
            >
              <label className={styles.checkboxRow}>
                <input
                  type="checkbox"
                  aria-label="Experimental HTTP transport enabled"
                  checked={draft.experimentalHttp}
                  onChange={(event) => {
                    onDraftChange(updateDraft(draft, { experimentalHttp: event.target.checked }));
                  }}
                />
                <span>Experimental HTTP transport enabled</span>
              </label>
            </SettingsField>
          </>
        )}

        <SettingsField label="State">
          <Select
            aria-label="State"
            {...compactSelectProps}
            options={stateOptions}
            value={draft.state}
            onValueChange={(value) => {
              onDraftChange(
                updateDraft(draft, {
                  state:
                    value === "draining" || value === "disabled" || value === "degraded"
                      ? value
                      : "active",
                })
              );
            }}
          />
        </SettingsField>

        <SettingsField label="Capabilities" help="Use one capability per line.">
          <Textarea
            aria-label="Capabilities"
            fieldClassName={controlStyles.textareaField}
            className={styles.textarea}
            textareaSize="sm"
            value={draft.capabilitiesText}
            onChange={(event) => {
              onDraftChange(updateDraft(draft, { capabilitiesText: event.target.value }));
            }}
          />
        </SettingsField>

        <SettingsField label="Max concurrency">
          <Input
            type="number"
            min={1}
            aria-label="Max concurrency"
            fieldClassName={compactInputFieldClassName}
            inputSize="sm"
            value={draft.maxConcurrency}
            onValueChange={(value) => {
              onDraftChange(updateDraft(draft, { maxConcurrency: value }));
            }}
          />
        </SettingsField>

        <SettingsField label="Cost tier">
          <Input
            type="text"
            aria-label="Cost tier"
            fieldClassName={compactInputFieldClassName}
            inputSize="sm"
            value={draft.costTier}
            onValueChange={(value) => {
              onDraftChange(updateDraft(draft, { costTier: value }));
            }}
          />
        </SettingsField>

        <SettingsField label="Latency class">
          <Input
            type="text"
            aria-label="Latency class"
            fieldClassName={compactInputFieldClassName}
            inputSize="sm"
            value={draft.latencyClass}
            onValueChange={(value) => {
              onDraftChange(updateDraft(draft, { latencyClass: value }));
            }}
          />
        </SettingsField>

        <SettingsField label={<div className={styles.sectionTitle}>Latest probe</div>}>
          <AcpProbeStatusSummary
            healthy={integrationObservation?.healthy}
            lastError={integrationObservation?.lastError}
            lastProbeAt={integrationObservation?.lastProbeAt}
          />
        </SettingsField>

        {!activeValidation.isValid ? (
          <div className="settings-help settings-help-error">{validationMessage}</div>
        ) : null}
        {error ? <div className="settings-help settings-help-error">{error}</div> : null}

        <SettingsFooterBar>
          <Button type="button" variant="ghost" size="sm" onClick={onClose}>
            Cancel
          </Button>
          {isEditMode ? (
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={onProbe}
              disabled={!onProbe || !probeEnabled || probeBusy}
            >
              {probeBusy ? "Probing..." : "Probe now"}
            </Button>
          ) : null}
          <Button type="submit" variant="primary" size="sm" disabled={submitDisabled}>
            {submitLabel}
          </Button>
        </SettingsFooterBar>
      </form>
    </ModalShell>
  );
}
