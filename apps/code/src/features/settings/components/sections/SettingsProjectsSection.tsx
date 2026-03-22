import ChevronDown from "lucide-react/dist/esm/icons/chevron-down";
import ChevronUp from "lucide-react/dist/esm/icons/chevron-up";
import Trash2 from "lucide-react/dist/esm/icons/trash-2";
import type { Dispatch, SetStateAction } from "react";
import { Button, Input, Select, type SelectOption } from "../../../../design-system";
import type { WorkspaceGroup, WorkspaceInfo } from "../../../../types";
import { normalizePathForDisplay } from "../../../../utils/platformPaths";
import { SettingsFieldGroup, SettingsSectionFrame } from "../SettingsSectionGrammar";
import * as controlStyles from "../SettingsFormControls.css";
import * as styles from "./SettingsProjectsSection.css";

type GroupedWorkspaces = Array<{
  id: string | null;
  name: string;
  workspaces: WorkspaceInfo[];
}>;

type SettingsProjectsSectionProps = {
  workspaceGroups: WorkspaceGroup[];
  groupedWorkspaces: GroupedWorkspaces;
  ungroupedLabel: string;
  groupDrafts: Record<string, string>;
  newGroupName: string;
  groupError: string | null;
  projects: WorkspaceInfo[];
  canCreateGroup: boolean;
  onSetNewGroupName: Dispatch<SetStateAction<string>>;
  onSetGroupDrafts: Dispatch<SetStateAction<Record<string, string>>>;
  onCreateGroup: () => Promise<void>;
  onRenameGroup: (group: WorkspaceGroup) => Promise<void>;
  onMoveWorkspaceGroup: (id: string, direction: "up" | "down") => Promise<boolean | null>;
  onDeleteGroup: (group: WorkspaceGroup) => Promise<void>;
  onChooseGroupCopiesFolder: (group: WorkspaceGroup) => Promise<void>;
  onClearGroupCopiesFolder: (group: WorkspaceGroup) => Promise<void>;
  onAssignWorkspaceGroup: (workspaceId: string, groupId: string | null) => Promise<boolean | null>;
  onRenameWorkspace?: (workspaceId: string, name: string) => Promise<boolean | null>;
  onMoveWorkspace: (id: string, direction: "up" | "down") => void;
  onDeleteWorkspace: (id: string) => void;
};

export function SettingsProjectsSection({
  workspaceGroups,
  groupedWorkspaces,
  ungroupedLabel,
  groupDrafts,
  newGroupName,
  groupError,
  projects,
  canCreateGroup,
  onSetNewGroupName,
  onSetGroupDrafts,
  onCreateGroup,
  onRenameGroup,
  onMoveWorkspaceGroup,
  onDeleteGroup,
  onChooseGroupCopiesFolder,
  onClearGroupCopiesFolder,
  onAssignWorkspaceGroup,
  onRenameWorkspace,
  onMoveWorkspace,
  onDeleteWorkspace,
}: SettingsProjectsSectionProps) {
  const groupSelectOptions: SelectOption[] = [
    { value: "", label: ungroupedLabel },
    ...workspaceGroups.map((entry) => ({ value: entry.id, label: entry.name })),
  ];

  return (
    <SettingsSectionFrame
      title="Projects"
      subtitle="Group related workspaces and reorder projects within each group."
    >
      <SettingsFieldGroup title="Groups" subtitle="Create group labels for related repositories.">
        <div className={styles.groupCreate}>
          <Input
            fieldClassName={`${controlStyles.inputField} ${controlStyles.inputFieldCompact} ${styles.groupCreateInput}`}
            inputSize="sm"
            value={newGroupName}
            placeholder="New group name"
            onValueChange={onSetNewGroupName}
            onKeyDown={(event) => {
              if (event.key === "Enter" && canCreateGroup) {
                event.preventDefault();
                void onCreateGroup();
              }
            }}
          />
          <Button
            variant="ghost"
            size="sm"
            className="settings-button-compact"
            onClick={() => {
              void onCreateGroup();
            }}
            disabled={!canCreateGroup}
          >
            Add group
          </Button>
        </div>
        {groupError ? <div className={styles.groupError}>{groupError}</div> : null}
        {workspaceGroups.length > 0 ? (
          <div className={styles.groupList}>
            {workspaceGroups.map((group, index) => (
              <div key={group.id} className={styles.groupRow}>
                <div className={styles.groupFields}>
                  <Input
                    fieldClassName={`${controlStyles.inputField} ${controlStyles.inputFieldCompact} ${styles.groupNameInput}`}
                    inputSize="sm"
                    value={groupDrafts[group.id] ?? group.name}
                    onValueChange={(name) =>
                      onSetGroupDrafts((prev) => ({
                        ...prev,
                        [group.id]: name,
                      }))
                    }
                    onBlur={() => {
                      void onRenameGroup(group);
                    }}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") {
                        event.preventDefault();
                        void onRenameGroup(group);
                      }
                    }}
                  />
                  <div className={styles.groupCopies}>
                    <div className={styles.groupCopiesLabel}>Copies folder</div>
                    <div className={styles.groupCopiesRow}>
                      <div
                        className={`${styles.groupCopiesPath}${
                          group.copiesFolder ? "" : ` ${styles.groupCopiesPathEmpty}`
                        }`}
                        title={group.copiesFolder ?? ""}
                      >
                        {group.copiesFolder ?? "Not set"}
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="settings-button-compact"
                        onClick={() => {
                          void onChooseGroupCopiesFolder(group);
                        }}
                      >
                        Choose…
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="settings-button-compact"
                        onClick={() => {
                          void onClearGroupCopiesFolder(group);
                        }}
                        disabled={!group.copiesFolder}
                      >
                        Clear
                      </Button>
                    </div>
                  </div>
                </div>
                <div className={styles.groupActions}>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => {
                      void onMoveWorkspaceGroup(group.id, "up");
                    }}
                    disabled={index === 0}
                    aria-label="Move group up"
                  >
                    <ChevronUp aria-hidden />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => {
                      void onMoveWorkspaceGroup(group.id, "down");
                    }}
                    disabled={index === workspaceGroups.length - 1}
                    aria-label="Move group down"
                  >
                    <ChevronDown aria-hidden />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => {
                      void onDeleteGroup(group);
                    }}
                    aria-label="Delete group"
                  >
                    <Trash2 aria-hidden />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className={styles.emptyMessage}>No groups yet.</div>
        )}
      </SettingsFieldGroup>

      <SettingsFieldGroup
        title="Projects"
        subtitle="Assign projects to groups and adjust their order."
      >
        {groupedWorkspaces.map((group, groupIndex) => (
          <div
            key={group.id ?? "ungrouped"}
            className={`${styles.projectGroup}${groupIndex > 0 ? ` ${styles.projectGroupSpaced}` : ""}`}
          >
            <div className={styles.projectGroupLabel}>{group.name}</div>
            {group.workspaces.map((workspace, index) => {
              const groupValue = workspaceGroups.some(
                (entry) => entry.id === workspace.settings.groupId
              )
                ? (workspace.settings.groupId ?? "")
                : "";
              return (
                <div key={workspace.id} className={styles.projectRow}>
                  <div className={styles.projectInfo}>
                    <div className={styles.projectName}>{workspace.name}</div>
                    <div className={styles.projectPath}>
                      {normalizePathForDisplay(workspace.path)}
                    </div>
                  </div>
                  <div className={styles.projectActions}>
                    <Select
                      className={`${controlStyles.selectRoot} ${styles.projectGroupSelect}`}
                      triggerClassName={controlStyles.selectTrigger}
                      menuClassName={controlStyles.selectMenu}
                      optionClassName={controlStyles.selectOption}
                      triggerDensity="compact"
                      ariaLabel={`Project group for ${workspace.name}`}
                      options={groupSelectOptions}
                      value={groupValue}
                      onValueChange={(nextGroupId) => {
                        void onAssignWorkspaceGroup(workspace.id, nextGroupId || null);
                      }}
                    />
                    <Button
                      variant="ghost"
                      size="sm"
                      className="settings-button-compact"
                      onClick={() => {
                        if (!onRenameWorkspace) {
                          return;
                        }
                        const currentName = workspace.name.trim();
                        const nextNameInput = globalThis.prompt?.("Project name", currentName);
                        if (nextNameInput === null || nextNameInput === undefined) {
                          return;
                        }
                        const nextName = nextNameInput.trim();
                        if (!nextName || nextName === currentName) {
                          return;
                        }
                        void onRenameWorkspace(workspace.id, nextName);
                      }}
                      disabled={(workspace.kind ?? "main") === "worktree" || !onRenameWorkspace}
                    >
                      Rename
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => onMoveWorkspace(workspace.id, "up")}
                      disabled={index === 0}
                      aria-label="Move project up"
                    >
                      <ChevronUp aria-hidden />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => onMoveWorkspace(workspace.id, "down")}
                      disabled={index === group.workspaces.length - 1}
                      aria-label="Move project down"
                    >
                      <ChevronDown aria-hidden />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => onDeleteWorkspace(workspace.id)}
                      aria-label="Delete project"
                    >
                      <Trash2 aria-hidden />
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        ))}
        {projects.length === 0 ? <div className={styles.emptyMessage}>No projects yet.</div> : null}
      </SettingsFieldGroup>
    </SettingsSectionFrame>
  );
}
