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
import * as controlStyles from "../../SettingsFormControls.css";
import { SettingsField, SettingsFooterBar } from "../../SettingsSectionGrammar";
import type { NativeBackendFormMode, NativeBackendFormState } from "./nativeBackendForm";
import * as styles from "./AcpBackendEditorDialog.css";

type NativeBackendEditorDialogProps = {
  open: boolean;
  mode: NativeBackendFormMode;
  draft: NativeBackendFormState;
  saving?: boolean;
  error?: string | null;
  onClose: () => void;
  onDraftChange: (draft: NativeBackendFormState) => void;
  onSubmit: () => void;
};

function updateDraft(
  draft: NativeBackendFormState,
  patch: Partial<NativeBackendFormState>
): NativeBackendFormState {
  return { ...draft, ...patch };
}

const backendClassOptions: SelectOption[] = [
  { value: "primary", label: "Primary" },
  { value: "burst", label: "Burst" },
  { value: "specialized", label: "Specialized" },
];

const rolloutStateOptions: SelectOption[] = [
  { value: "current", label: "Current" },
  { value: "ramping", label: "Ramping" },
  { value: "draining", label: "Draining" },
  { value: "drained", label: "Drained" },
];

const statusOptions: SelectOption[] = [
  { value: "active", label: "Active" },
  { value: "draining", label: "Draining" },
  { value: "disabled", label: "Disabled" },
];

const trustTierOptions: SelectOption[] = [
  { value: "trusted", label: "Trusted" },
  { value: "standard", label: "Standard" },
  { value: "isolated", label: "Isolated" },
];

const dataSensitivityOptions: SelectOption[] = [
  { value: "public", label: "Public" },
  { value: "internal", label: "Internal" },
  { value: "restricted", label: "Restricted" },
];

const approvalPolicyOptions: SelectOption[] = [
  { value: "runtime-default", label: "Runtime default" },
  { value: "checkpoint-required", label: "Checkpoint required" },
  { value: "never-auto-approve", label: "Never auto-approve" },
];

export function NativeBackendEditorDialog({
  open,
  mode,
  draft,
  saving = false,
  error = null,
  onClose,
  onDraftChange,
  onSubmit,
}: NativeBackendEditorDialogProps) {
  const isEditMode = mode === "edit";
  const title = isEditMode ? "Edit backend" : "Add backend";
  const submitLabel = saving
    ? isEditMode
      ? "Saving..."
      : "Adding..."
    : isEditMode
      ? "Save backend"
      : "Add backend";
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
          onSubmit();
        }}
      >
        <DialogTitle>{title}</DialogTitle>
        <DialogDescription>
          Register and maintain runtime-native backends through the same operator dialog model as
          ACP integrations.
        </DialogDescription>

        <SettingsField
          label="Backend ID"
          help={
            isEditMode
              ? "Backend identity is fixed so editing updates the existing runtime-native backend instead of creating a second entry."
              : undefined
          }
        >
          {isEditMode ? (
            <div className="settings-help">{draft.backendId}</div>
          ) : (
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
          )}
        </SettingsField>

        <SettingsField
          label="Display name"
          help="Leave blank to reuse the backend ID as the operator-facing label."
        >
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

        <SettingsField label="Capabilities" help="Use one capability name per line.">
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
            min="1"
            step="1"
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

        <SettingsField
          label="Backend class"
          help="Backend class is operator metadata for pool management. It does not redefine runtime placement truth for any task or run."
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
          help="Optional tags for specialized backends. Use one specialization per line."
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

        <SettingsField label="Rollout state">
          <Select
            aria-label="Rollout state"
            {...compactSelectProps}
            options={rolloutStateOptions}
            value={draft.rolloutState}
            onValueChange={(value) => {
              onDraftChange(
                updateDraft(draft, {
                  rolloutState:
                    value === "ramping"
                      ? "ramping"
                      : value === "draining"
                        ? "draining"
                        : value === "drained"
                          ? "drained"
                          : "current",
                })
              );
            }}
          />
        </SettingsField>

        <SettingsField label="Status">
          <Select
            aria-label="Status"
            {...compactSelectProps}
            options={statusOptions}
            value={draft.status}
            onValueChange={(value) => {
              onDraftChange(
                updateDraft(draft, {
                  status:
                    value === "disabled"
                      ? "disabled"
                      : value === "draining"
                        ? "draining"
                        : "active",
                })
              );
            }}
          />
        </SettingsField>

        <SettingsField
          label="Trust tier"
          help="Runtime-owned trust metadata used for placement and future approval policy enforcement."
        >
          <Select
            aria-label="Trust tier"
            {...compactSelectProps}
            options={trustTierOptions}
            value={draft.trustTier}
            onValueChange={(value) => {
              onDraftChange(
                updateDraft(draft, {
                  trustTier:
                    value === "trusted"
                      ? "trusted"
                      : value === "isolated"
                        ? "isolated"
                        : "standard",
                })
              );
            }}
          />
        </SettingsField>

        <SettingsField label="Data sensitivity">
          <Select
            aria-label="Data sensitivity"
            {...compactSelectProps}
            options={dataSensitivityOptions}
            value={draft.dataSensitivity}
            onValueChange={(value) => {
              onDraftChange(
                updateDraft(draft, {
                  dataSensitivity:
                    value === "public"
                      ? "public"
                      : value === "restricted"
                        ? "restricted"
                        : "internal",
                })
              );
            }}
          />
        </SettingsField>

        <SettingsField label="Approval policy">
          <Select
            aria-label="Approval policy"
            {...compactSelectProps}
            options={approvalPolicyOptions}
            value={draft.approvalPolicy}
            onValueChange={(value) => {
              onDraftChange(
                updateDraft(draft, {
                  approvalPolicy:
                    value === "runtime-default"
                      ? "runtime-default"
                      : value === "never-auto-approve"
                        ? "never-auto-approve"
                        : "checkpoint-required",
                })
              );
            }}
          />
        </SettingsField>

        <SettingsField
          label="Allowed tool classes"
          help="One tool class per line. Runtime policy can use this to constrain remote execution."
        >
          <Textarea
            aria-label="Allowed tool classes"
            fieldClassName={controlStyles.textareaField}
            className={styles.textarea}
            textareaSize="sm"
            value={draft.allowedToolClassesText}
            onChange={(event) => {
              onDraftChange(updateDraft(draft, { allowedToolClassesText: event.target.value }));
            }}
          />
        </SettingsField>

        {error ? <div className="settings-help settings-help-error">{error}</div> : null}

        <SettingsFooterBar>
          <Button type="button" variant="secondary" size="sm" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" size="sm" disabled={saving}>
            {submitLabel}
          </Button>
        </SettingsFooterBar>
      </form>
    </ModalShell>
  );
}
