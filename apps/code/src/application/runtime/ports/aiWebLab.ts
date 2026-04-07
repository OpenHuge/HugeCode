import type {
  AiWebLabProviderId,
  DesktopAiWebLabArtifact,
  DesktopAiWebLabCatalog,
  DesktopAiWebLabNavigationInput,
  DesktopAiWebLabOpenInput,
  DesktopAiWebLabSessionMode,
  DesktopAiWebLabState,
  DesktopAiWebLabViewMode,
} from "@ku0/code-platform-interfaces";
import { getDesktopHostBridge } from "./desktopHostBridge";

export type {
  AiWebLabProviderId,
  DesktopAiWebLabArtifact,
  DesktopAiWebLabCatalog,
  DesktopAiWebLabNavigationInput,
  DesktopAiWebLabOpenInput,
  DesktopAiWebLabSessionMode,
  DesktopAiWebLabState,
  DesktopAiWebLabViewMode,
};

export async function getAiWebLabCatalog(): Promise<DesktopAiWebLabCatalog | null> {
  return (await getDesktopHostBridge()?.aiWebLab?.getCatalog?.()) ?? null;
}

export async function getAiWebLabState(): Promise<DesktopAiWebLabState | null> {
  return (await getDesktopHostBridge()?.aiWebLab?.getState?.()) ?? null;
}

export async function openAiWebLabSession(
  input?: DesktopAiWebLabOpenInput
): Promise<DesktopAiWebLabState | null> {
  return (await getDesktopHostBridge()?.aiWebLab?.openSession?.(input)) ?? null;
}

export async function openAiWebLabEntrypoint(
  providerId: AiWebLabProviderId,
  entrypointId: string
): Promise<DesktopAiWebLabState | null> {
  return (
    (await getDesktopHostBridge()?.aiWebLab?.openEntrypoint?.(providerId, entrypointId)) ?? null
  );
}

export async function focusAiWebLabSession(): Promise<DesktopAiWebLabState | null> {
  return (await getDesktopHostBridge()?.aiWebLab?.focusSession?.()) ?? null;
}

export async function closeAiWebLabSession(): Promise<DesktopAiWebLabState | null> {
  return (await getDesktopHostBridge()?.aiWebLab?.closeSession?.()) ?? null;
}

export async function setAiWebLabViewMode(
  mode: DesktopAiWebLabViewMode
): Promise<DesktopAiWebLabState | null> {
  return (await getDesktopHostBridge()?.aiWebLab?.setViewMode?.(mode)) ?? null;
}

export async function setAiWebLabSessionMode(
  mode: DesktopAiWebLabSessionMode
): Promise<DesktopAiWebLabState | null> {
  return (await getDesktopHostBridge()?.aiWebLab?.setSessionMode?.(mode)) ?? null;
}

export async function navigateAiWebLab(
  input: DesktopAiWebLabNavigationInput
): Promise<DesktopAiWebLabState | null> {
  return (await getDesktopHostBridge()?.aiWebLab?.navigate?.(input)) ?? null;
}

export async function extractAiWebLabArtifact(): Promise<DesktopAiWebLabArtifact | null> {
  return (await getDesktopHostBridge()?.aiWebLab?.extractArtifact?.()) ?? null;
}
