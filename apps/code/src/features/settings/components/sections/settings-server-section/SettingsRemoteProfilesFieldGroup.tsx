import type { Dispatch, SetStateAction } from "react";
import { Button, Input, StatusBadge } from "../../../../../design-system";
import type { RemoteBackendProfile } from "../../../../../types";
import { SettingsField, SettingsFieldGroup, SettingsFooterBar } from "../../SettingsSectionGrammar";

type SettingsRemoteProfilesFieldGroupProps = {
  isMobileSimplified: boolean;
  remoteProfiles: RemoteBackendProfile[];
  selectedRemoteProfileId: string | null;
  defaultRemoteProfileId: string | null;
  remoteProfileLabelDraft: string;
  compactInputFieldClassName: string;
  onSelectRemoteProfile: (profileId: string) => void;
  onAddRemoteProfile: () => Promise<void>;
  onSetDefaultRemoteProfile: (profileId: string) => Promise<void>;
  onRemoveRemoteProfile: (profileId: string) => Promise<void>;
  onSetRemoteProfileLabelDraft: Dispatch<SetStateAction<string>>;
  onCommitRemoteProfileLabel: () => Promise<void>;
};

export function SettingsRemoteProfilesFieldGroup({
  isMobileSimplified,
  remoteProfiles,
  selectedRemoteProfileId,
  defaultRemoteProfileId,
  remoteProfileLabelDraft,
  compactInputFieldClassName,
  onSelectRemoteProfile,
  onAddRemoteProfile,
  onSetDefaultRemoteProfile,
  onRemoveRemoteProfile,
  onSetRemoteProfileLabelDraft,
  onCommitRemoteProfileLabel,
}: SettingsRemoteProfilesFieldGroupProps) {
  if (isMobileSimplified) {
    return null;
  }

  return (
    <SettingsFieldGroup
      title="Remote backend profiles"
      subtitle="Manage reusable profile records separately from transport-specific daemon and mobile connection settings."
    >
      <SettingsField
        label="Profile list"
        help="The default profile keeps legacy desktop/mobile settings in sync."
      >
        <div className="settings-field">
          <SettingsFooterBar>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              className="settings-button-compact"
              onClick={() => {
                void onAddRemoteProfile();
              }}
            >
              Add profile
            </Button>
          </SettingsFooterBar>
          <div className="settings-field-row" role="list" aria-label="Remote backend profiles">
            {remoteProfiles.map((profile) => {
              const isSelected = profile.id === selectedRemoteProfileId;
              const isDefault = profile.id === defaultRemoteProfileId;
              return (
                <button
                  key={profile.id}
                  type="button"
                  className={`settings-profile-button${isSelected ? " is-selected" : ""}`}
                  onClick={() => onSelectRemoteProfile(profile.id)}
                  aria-pressed={isSelected}
                >
                  <StatusBadge className="settings-profile-badge">{profile.label}</StatusBadge>
                  {isDefault ? (
                    <StatusBadge className="settings-profile-default-badge" tone="progress">
                      Default
                    </StatusBadge>
                  ) : null}
                </button>
              );
            })}
          </div>
          {selectedRemoteProfileId ? (
            <SettingsFooterBar>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                className="settings-button-compact"
                onClick={() => {
                  void onSetDefaultRemoteProfile(selectedRemoteProfileId);
                }}
                disabled={selectedRemoteProfileId === defaultRemoteProfileId}
              >
                Set default profile
              </Button>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                className="settings-button-compact"
                onClick={() => {
                  void onRemoveRemoteProfile(selectedRemoteProfileId);
                }}
                disabled={remoteProfiles.length <= 1}
              >
                Remove profile
              </Button>
            </SettingsFooterBar>
          ) : null}
        </div>
      </SettingsField>

      <SettingsField label="Profile name" htmlFor="remote-profile-label">
        <Input
          id="remote-profile-label"
          fieldClassName={compactInputFieldClassName}
          inputSize="sm"
          value={remoteProfileLabelDraft}
          placeholder="Remote backend profile name"
          onValueChange={onSetRemoteProfileLabelDraft}
          onBlur={() => {
            void onCommitRemoteProfileLabel();
          }}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              void onCommitRemoteProfileLabel();
            }
          }}
          aria-label="Remote backend profile name"
        />
      </SettingsField>
    </SettingsFieldGroup>
  );
}
