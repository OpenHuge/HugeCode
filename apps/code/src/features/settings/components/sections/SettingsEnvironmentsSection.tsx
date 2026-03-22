import type { Dispatch, SetStateAction } from "react";
import { pushErrorToast } from "../../../../application/runtime/ports/toasts";
import { Button, Select, Textarea, type SelectOption } from "../../../../design-system";
import type { WorkspaceInfo } from "../../../../types";
import {
  SettingsField,
  SettingsFieldGroup,
  SettingsFooterBar,
  SettingsSectionFrame,
} from "../SettingsSectionGrammar";
import * as controlStyles from "../SettingsFormControls.css";
import * as grammar from "../SettingsSectionGrammar.css";

type SettingsEnvironmentsSectionProps = {
  mainWorkspaces: WorkspaceInfo[];
  environmentWorkspace: WorkspaceInfo | null;
  environmentSaving: boolean;
  environmentError: string | null;
  environmentDraftScript: string;
  environmentSavedScript: string | null;
  environmentDirty: boolean;
  onSetEnvironmentWorkspaceId: Dispatch<SetStateAction<string | null>>;
  onSetEnvironmentDraftScript: Dispatch<SetStateAction<string>>;
  onSaveEnvironmentSetup: () => Promise<void>;
};

export function SettingsEnvironmentsSection({
  mainWorkspaces,
  environmentWorkspace,
  environmentSaving,
  environmentError,
  environmentDraftScript,
  environmentSavedScript,
  environmentDirty,
  onSetEnvironmentWorkspaceId,
  onSetEnvironmentDraftScript,
  onSaveEnvironmentSetup,
}: SettingsEnvironmentsSectionProps) {
  const workspaceOptions: SelectOption[] = mainWorkspaces.map((workspace) => ({
    value: workspace.id,
    label: workspace.name,
  }));

  return (
    <SettingsSectionFrame
      title="Environments"
      subtitle="Configure per-project setup scripts that run after worktree creation."
    >
      {mainWorkspaces.length === 0 ? (
        <div className={grammar.helpText}>No projects yet.</div>
      ) : (
        <SettingsFieldGroup
          title="Project setup"
          subtitle="Choose the project and maintain its one-time worktree bootstrap script."
        >
          <SettingsField
            label="Project"
            help={environmentWorkspace ? environmentWorkspace.path : undefined}
          >
            <Select
              className={controlStyles.selectRoot}
              triggerClassName={controlStyles.selectTrigger}
              menuClassName={controlStyles.selectMenu}
              optionClassName={controlStyles.selectOption}
              ariaLabel="Project"
              options={workspaceOptions}
              value={environmentWorkspace?.id ?? ""}
              onValueChange={onSetEnvironmentWorkspaceId}
              disabled={environmentSaving}
            />
          </SettingsField>

          <SettingsField
            label="Setup script"
            help="Runs once in a dedicated terminal after each new worktree is created."
          >
            {environmentError ? <div className={grammar.errorText}>{environmentError}</div> : null}
            <Textarea
              fieldClassName={controlStyles.textareaField}
              className={controlStyles.textareaCode}
              value={environmentDraftScript}
              onChange={(event) => onSetEnvironmentDraftScript(event.target.value)}
              placeholder="pnpm install"
              spellCheck={false}
              disabled={environmentSaving}
              textareaSize="lg"
            />
            <SettingsFooterBar>
              <Button
                variant="ghost"
                size="sm"
                className="settings-button-compact"
                onClick={() => {
                  const clipboard = typeof navigator === "undefined" ? null : navigator.clipboard;
                  if (!clipboard?.writeText) {
                    pushErrorToast({
                      title: "Copy failed",
                      message:
                        "Clipboard access is unavailable in this environment. Copy the script manually instead.",
                    });
                    return;
                  }

                  void clipboard.writeText(environmentDraftScript).catch(() => {
                    pushErrorToast({
                      title: "Copy failed",
                      message:
                        "Could not write to the clipboard. Copy the script manually instead.",
                    });
                  });
                }}
                disabled={environmentSaving || environmentDraftScript.length === 0}
              >
                Copy
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="settings-button-compact"
                onClick={() => onSetEnvironmentDraftScript(environmentSavedScript ?? "")}
                disabled={environmentSaving || !environmentDirty}
              >
                Reset
              </Button>
              <Button
                variant="primary"
                size="sm"
                className="settings-button-compact"
                onClick={() => {
                  void onSaveEnvironmentSetup();
                }}
                disabled={environmentSaving || !environmentDirty}
              >
                {environmentSaving ? "Saving..." : "Save"}
              </Button>
            </SettingsFooterBar>
          </SettingsField>
        </SettingsFieldGroup>
      )}
    </SettingsSectionFrame>
  );
}
