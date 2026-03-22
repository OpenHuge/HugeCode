import { useEffect, useMemo } from "react";
import { isComposingEvent } from "../../../utils/keys";
import type { AccessMode } from "../../../types";
import { matchesShortcut } from "../../../utils/shortcuts";

type ModelOption = { id: string; displayName: string; model: string; available?: boolean };

type UseComposerShortcutsOptions = {
  textareaRef: React.RefObject<HTMLTextAreaElement | null>;
  modelShortcut: string | null;
  accessShortcut: string | null;
  reasoningShortcut: string | null;
  collaborationShortcut: string | null;
  models: ModelOption[];
  collaborationModes: { id: string; label: string }[];
  selectedModelId: string | null;
  onSelectModel: (id: string) => void;
  selectedCollaborationModeId: string | null;
  onSelectCollaborationMode: (id: string | null) => void;
  accessMode: AccessMode;
  onSelectAccessMode: (mode: AccessMode) => void;
  reasoningOptions: string[];
  selectedEffort: string | null;
  onSelectEffort: (effort: string) => void;
  reasoningSupported: boolean;
};

const ACCESS_ORDER: AccessMode[] = ["read-only", "on-request", "full-access"];

export function useComposerShortcuts({
  textareaRef,
  modelShortcut,
  accessShortcut,
  reasoningShortcut,
  collaborationShortcut,
  models,
  collaborationModes,
  selectedModelId,
  onSelectModel,
  selectedCollaborationModeId,
  onSelectCollaborationMode,
  accessMode,
  onSelectAccessMode,
  reasoningOptions,
  selectedEffort,
  onSelectEffort,
  reasoningSupported,
}: UseComposerShortcutsOptions) {
  const availableModels = useMemo(
    () => models.filter((model) => model.available !== false),
    [models]
  );

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.repeat) {
        return;
      }
      if (isComposingEvent(event)) {
        return;
      }
      if (document.activeElement !== textareaRef.current) {
        return;
      }
      if (matchesShortcut(event, modelShortcut)) {
        event.preventDefault();
        if (availableModels.length === 0) {
          return;
        }
        const currentIndex = availableModels.findIndex((model) => model.id === selectedModelId);
        const nextIndex = currentIndex >= 0 ? (currentIndex + 1) % availableModels.length : 0;
        const nextModel = availableModels[nextIndex];
        if (nextModel) {
          onSelectModel(nextModel.id);
        }
        return;
      }
      if (matchesShortcut(event, accessShortcut)) {
        event.preventDefault();
        const currentIndex = ACCESS_ORDER.indexOf(accessMode);
        const nextIndex = currentIndex >= 0 ? (currentIndex + 1) % ACCESS_ORDER.length : 0;
        const nextAccess = ACCESS_ORDER[nextIndex];
        if (nextAccess) {
          onSelectAccessMode(nextAccess);
        }
        return;
      }
      if (matchesShortcut(event, reasoningShortcut)) {
        event.preventDefault();
        if (!reasoningSupported || reasoningOptions.length === 0) {
          return;
        }
        const currentIndex = reasoningOptions.indexOf(selectedEffort ?? "");
        const nextIndex = currentIndex >= 0 ? (currentIndex + 1) % reasoningOptions.length : 0;
        const nextEffort = reasoningOptions[nextIndex];
        if (nextEffort) {
          onSelectEffort(nextEffort);
        }
        return;
      }
      if (collaborationModes.length > 0 && matchesShortcut(event, collaborationShortcut)) {
        event.preventDefault();
        const currentIndex = collaborationModes.findIndex(
          (mode) => mode.id === selectedCollaborationModeId
        );
        const nextIndex = currentIndex >= 0 ? (currentIndex + 1) % collaborationModes.length : 0;
        const nextMode = collaborationModes[nextIndex];
        if (nextMode) {
          onSelectCollaborationMode(nextMode.id);
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [
    accessMode,
    accessShortcut,
    collaborationModes,
    collaborationShortcut,
    modelShortcut,
    availableModels,
    onSelectCollaborationMode,
    onSelectAccessMode,
    onSelectEffort,
    onSelectModel,
    reasoningOptions,
    reasoningShortcut,
    reasoningSupported,
    selectedCollaborationModeId,
    selectedEffort,
    selectedModelId,
    textareaRef,
  ]);
}
