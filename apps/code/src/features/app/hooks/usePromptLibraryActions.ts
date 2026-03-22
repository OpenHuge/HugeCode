import { useCallback } from "react";
import { revealItemInDir } from "../../../application/runtime/ports/tauriOpener";

type PromptCreateInput = {
  scope: "workspace" | "global";
  name: string;
  description?: string | null;
  argumentHint?: string | null;
  content: string;
};

type PromptUpdateInput = {
  path: string;
  name: string;
  description?: string | null;
  argumentHint?: string | null;
  content: string;
};

type PromptMoveInput = {
  path: string;
  scope: "workspace" | "global";
};

type UsePromptLibraryActionsParams = {
  createPrompt: (data: PromptCreateInput) => Promise<unknown>;
  updatePrompt: (data: PromptUpdateInput) => Promise<unknown>;
  deletePrompt: (path: string) => Promise<unknown>;
  movePrompt: (data: PromptMoveInput) => Promise<unknown>;
  getWorkspacePromptsDir: () => Promise<string>;
  getGlobalPromptsDir: () => Promise<string | null>;
  onError: (error: unknown) => void;
};

export function usePromptLibraryActions({
  createPrompt,
  updatePrompt,
  deletePrompt,
  movePrompt,
  getWorkspacePromptsDir,
  getGlobalPromptsDir,
  onError,
}: UsePromptLibraryActionsParams) {
  const handleCreatePrompt = useCallback(
    async (data: PromptCreateInput) => {
      try {
        await createPrompt(data);
      } catch (error) {
        onError(error);
      }
    },
    [createPrompt, onError]
  );

  const handleUpdatePrompt = useCallback(
    async (data: PromptUpdateInput) => {
      try {
        await updatePrompt(data);
      } catch (error) {
        onError(error);
      }
    },
    [onError, updatePrompt]
  );

  const handleDeletePrompt = useCallback(
    async (path: string) => {
      try {
        await deletePrompt(path);
      } catch (error) {
        onError(error);
      }
    },
    [deletePrompt, onError]
  );

  const handleMovePrompt = useCallback(
    async (data: PromptMoveInput) => {
      try {
        await movePrompt(data);
      } catch (error) {
        onError(error);
      }
    },
    [movePrompt, onError]
  );

  const handleRevealWorkspacePrompts = useCallback(async () => {
    try {
      const path = await getWorkspacePromptsDir();
      await revealItemInDir(path);
    } catch (error) {
      onError(error);
    }
  }, [getWorkspacePromptsDir, onError]);

  const handleRevealGeneralPrompts = useCallback(async () => {
    try {
      const path = await getGlobalPromptsDir();
      if (!path) {
        return;
      }
      await revealItemInDir(path);
    } catch (error) {
      onError(error);
    }
  }, [getGlobalPromptsDir, onError]);

  return {
    handleCreatePrompt,
    handleUpdatePrompt,
    handleDeletePrompt,
    handleMovePrompt,
    handleRevealWorkspacePrompts,
    handleRevealGeneralPrompts,
  };
}
