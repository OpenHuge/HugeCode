import type { IpcMainInvokeEvent } from "electron";
import type {
  AiWebLabProviderId,
  DesktopAppInfo,
  DesktopAiWebLabArtifact,
  DesktopAiWebLabCatalog,
  DesktopAiWebLabNavigationInput,
  DesktopAiWebLabOpenInput,
  DesktopAiWebLabSessionMode,
  DesktopAiWebLabState,
  DesktopAiWebLabViewMode,
  DesktopBrowserAssessmentRequest,
  DesktopBrowserAssessmentResult,
  DesktopBrowserExtractionRequest,
  DesktopBrowserExtractionResult,
  DesktopDiagnosticsInfo,
  DesktopLaunchIntent,
  LocalChromeDebuggerEndpointDescriptor,
  DesktopNotificationInput,
  DesktopOpenDialogInput,
  DesktopOpenDialogResult,
  DesktopOpenPathInInput,
  DesktopUpdateState,
  OpenDesktopWindowInput,
} from "@ku0/code-platform-interfaces";
import { DESKTOP_HOST_IPC_CHANNELS } from "@ku0/code-platform-interfaces";

type IpcInvokeEventLike = IpcMainInvokeEvent;

type IpcMainLike = {
  handle(
    channel: string,
    listener: (event: IpcInvokeEventLike, ...args: unknown[]) => unknown
  ): void;
};

type DesktopWindowDescriptor = {
  focused: boolean;
  hidden?: boolean;
  sessionId: string;
  windowId: number;
  windowLabel: string;
  workspaceLabel: string | null;
};

type DesktopTrayState = {
  enabled: boolean;
  supported: boolean;
};

type DesktopHostIpcHandlers = {
  closeAiWebLabSession(): Promise<DesktopAiWebLabState | null> | DesktopAiWebLabState | null;
  assessBrowserSurface(
    input: DesktopBrowserAssessmentRequest
  ): Promise<DesktopBrowserAssessmentResult | null> | DesktopBrowserAssessmentResult | null;
  closeWindow(windowId: number): Promise<boolean> | boolean;
  checkForUpdates(): Promise<DesktopUpdateState> | DesktopUpdateState;
  copySupportSnapshot(): Promise<boolean> | boolean;
  consumePendingLaunchIntent(): Promise<DesktopLaunchIntent | null> | DesktopLaunchIntent | null;
  extractBrowserContent(
    input?: DesktopBrowserExtractionRequest
  ): Promise<DesktopBrowserExtractionResult | null> | DesktopBrowserExtractionResult | null;
  extractAiWebLabArtifact():
    | Promise<DesktopAiWebLabArtifact | null>
    | DesktopAiWebLabArtifact
    | null;
  focusWindow(windowId: number): Promise<boolean> | boolean;
  focusAiWebLabSession(): Promise<DesktopAiWebLabState | null> | DesktopAiWebLabState | null;
  getAppInfo(): Promise<DesktopAppInfo | null> | DesktopAppInfo | null;
  getAiWebLabCatalog(): Promise<DesktopAiWebLabCatalog | null> | DesktopAiWebLabCatalog | null;
  getAiWebLabState(): Promise<DesktopAiWebLabState | null> | DesktopAiWebLabState | null;
  getDiagnosticsInfo(): Promise<DesktopDiagnosticsInfo | null> | DesktopDiagnosticsInfo | null;
  getAppVersion(): Promise<string | null> | string | null;
  getLastBrowserAssessmentResult():
    | Promise<DesktopBrowserAssessmentResult | null>
    | DesktopBrowserAssessmentResult
    | null;
  getLastBrowserExtractionResult():
    | Promise<DesktopBrowserExtractionResult | null>
    | DesktopBrowserExtractionResult
    | null;
  listLocalChromeDebuggerEndpoints():
    | Promise<LocalChromeDebuggerEndpointDescriptor[]>
    | LocalChromeDebuggerEndpointDescriptor[];
  getCurrentSession(event: IpcInvokeEventLike): Promise<unknown> | unknown;
  getTrayState(): Promise<DesktopTrayState> | DesktopTrayState;
  getUpdateState(): Promise<DesktopUpdateState> | DesktopUpdateState;
  getWindowLabel(event: IpcInvokeEventLike): Promise<string> | string;
  listRecentSessions(): Promise<unknown[]> | unknown[];
  listWindows(): Promise<DesktopWindowDescriptor[]> | DesktopWindowDescriptor[];
  navigateAiWebLab(
    input: DesktopAiWebLabNavigationInput
  ): Promise<DesktopAiWebLabState | null> | DesktopAiWebLabState | null;
  openDialog(
    input?: DesktopOpenDialogInput
  ): Promise<DesktopOpenDialogResult> | DesktopOpenDialogResult;
  openExternalUrl(url: string): Promise<boolean> | boolean;
  openAiWebLabEntrypoint(
    providerId: AiWebLabProviderId,
    entrypointId: string
  ): Promise<DesktopAiWebLabState | null> | DesktopAiWebLabState | null;
  openAiWebLabSession(
    input?: DesktopAiWebLabOpenInput
  ): Promise<DesktopAiWebLabState | null> | DesktopAiWebLabState | null;
  openPathIn(input: DesktopOpenPathInInput): Promise<boolean> | boolean;
  openPath(path: string): Promise<boolean> | boolean;
  openWindow(input?: OpenDesktopWindowInput): Promise<unknown> | unknown;
  reopenSession(sessionId: string): Promise<boolean> | boolean;
  revealItemInDir(path: string): Promise<boolean> | boolean;
  restartToApplyUpdate(): Promise<boolean> | boolean;
  setAiWebLabSessionMode(
    mode: DesktopAiWebLabSessionMode
  ): Promise<DesktopAiWebLabState | null> | DesktopAiWebLabState | null;
  setAiWebLabViewMode(
    mode: DesktopAiWebLabViewMode
  ): Promise<DesktopAiWebLabState | null> | DesktopAiWebLabState | null;
  setTrayEnabled(enabled: boolean): Promise<DesktopTrayState> | DesktopTrayState;
  showNotification(
    event: IpcInvokeEventLike,
    input: DesktopNotificationInput
  ): Promise<boolean> | boolean;
};

export type RegisterDesktopHostIpcInput = {
  channels: typeof DESKTOP_HOST_IPC_CHANNELS;
  handlers: DesktopHostIpcHandlers;
  ipcMain: IpcMainLike;
  isTrustedSender(event: IpcInvokeEventLike): boolean;
};

export function registerDesktopHostIpc(input: RegisterDesktopHostIpcInput) {
  const { channels, handlers, ipcMain, isTrustedSender } = input;

  function handleTrusted(
    channel: string,
    listener: (event: IpcInvokeEventLike, ...args: unknown[]) => unknown
  ) {
    ipcMain.handle(channel, async (event, ...args) => {
      if (!isTrustedSender(event)) {
        throw new Error("Blocked untrusted desktop IPC sender.");
      }

      return listener(event, ...args);
    });
  }

  handleTrusted(channels.getAppInfo, async () => {
    return handlers.getAppInfo();
  });

  handleTrusted(channels.getAppVersion, async () => {
    return handlers.getAppVersion();
  });

  handleTrusted(channels.getAiWebLabCatalog, async () => {
    return handlers.getAiWebLabCatalog();
  });

  handleTrusted(channels.getAiWebLabState, async () => {
    return handlers.getAiWebLabState();
  });

  handleTrusted(channels.openAiWebLabSession, async (_event, aiWebLabInput) => {
    return handlers.openAiWebLabSession(aiWebLabInput as DesktopAiWebLabOpenInput | undefined);
  });

  handleTrusted(channels.openAiWebLabEntrypoint, async (_event, providerId, entrypointId) => {
    return handlers.openAiWebLabEntrypoint(
      providerId as AiWebLabProviderId,
      entrypointId as string
    );
  });

  handleTrusted(channels.focusAiWebLabSession, async () => {
    return handlers.focusAiWebLabSession();
  });

  handleTrusted(channels.closeAiWebLabSession, async () => {
    return handlers.closeAiWebLabSession();
  });

  handleTrusted(channels.setAiWebLabViewMode, async (_event, mode) => {
    return handlers.setAiWebLabViewMode(mode as DesktopAiWebLabViewMode);
  });

  handleTrusted(channels.setAiWebLabSessionMode, async (_event, mode) => {
    return handlers.setAiWebLabSessionMode(mode as DesktopAiWebLabSessionMode);
  });

  handleTrusted(channels.navigateAiWebLab, async (_event, aiWebLabNavigationInput) => {
    return handlers.navigateAiWebLab(aiWebLabNavigationInput as DesktopAiWebLabNavigationInput);
  });

  handleTrusted(channels.extractAiWebLabArtifact, async () => {
    return handlers.extractAiWebLabArtifact();
  });

  handleTrusted(channels.listLocalChromeDebuggerEndpoints, async () => {
    return handlers.listLocalChromeDebuggerEndpoints();
  });

  handleTrusted(channels.assessBrowserSurface, async (_event, assessmentInput) => {
    return handlers.assessBrowserSurface(assessmentInput as DesktopBrowserAssessmentRequest);
  });

  handleTrusted(channels.getLastBrowserAssessmentResult, async () => {
    return handlers.getLastBrowserAssessmentResult();
  });

  handleTrusted(channels.extractBrowserContent, async (_event, extractionInput) => {
    return handlers.extractBrowserContent(
      extractionInput as DesktopBrowserExtractionRequest | undefined
    );
  });

  handleTrusted(channels.getLastBrowserExtractionResult, async () => {
    return handlers.getLastBrowserExtractionResult();
  });

  handleTrusted(channels.getDiagnosticsInfo, async () => {
    return handlers.getDiagnosticsInfo();
  });

  handleTrusted(channels.copySupportSnapshot, async () => {
    return handlers.copySupportSnapshot();
  });

  handleTrusted(channels.consumePendingLaunchIntent, async () => {
    return handlers.consumePendingLaunchIntent();
  });

  handleTrusted(channels.getCurrentSession, async (event) => {
    return handlers.getCurrentSession(event);
  });

  handleTrusted(channels.listRecentSessions, async () => {
    return handlers.listRecentSessions();
  });

  handleTrusted(channels.reopenSession, async (_event, sessionId) => {
    return handlers.reopenSession(sessionId as string);
  });

  handleTrusted(channels.getWindowLabel, async (event) => {
    return handlers.getWindowLabel(event);
  });

  handleTrusted(channels.listWindows, async () => {
    return handlers.listWindows();
  });

  handleTrusted(channels.openWindow, async (_event, openWindowInput) => {
    return handlers.openWindow(openWindowInput as OpenDesktopWindowInput | undefined);
  });

  handleTrusted(channels.focusWindow, async (_event, windowId) => {
    return handlers.focusWindow(windowId as number);
  });

  handleTrusted(channels.closeWindow, async (_event, windowId) => {
    return handlers.closeWindow(windowId as number);
  });

  handleTrusted(channels.getTrayState, async () => {
    return handlers.getTrayState();
  });

  handleTrusted(channels.setTrayEnabled, async (_event, enabled) => {
    return handlers.setTrayEnabled(enabled === true);
  });

  handleTrusted(channels.showNotification, async (event, notificationInput) => {
    return handlers.showNotification(event, notificationInput as DesktopNotificationInput);
  });

  handleTrusted(channels.openDialog, async (_event, dialogInput) => {
    return handlers.openDialog(dialogInput as DesktopOpenDialogInput | undefined);
  });

  handleTrusted(channels.getUpdateState, async () => {
    return handlers.getUpdateState();
  });

  handleTrusted(channels.checkForUpdates, async () => {
    return handlers.checkForUpdates();
  });

  handleTrusted(channels.restartToApplyUpdate, async () => {
    return handlers.restartToApplyUpdate();
  });

  handleTrusted(channels.openExternalUrl, async (_event, url) => {
    return handlers.openExternalUrl(url as string);
  });

  handleTrusted(channels.openPathIn, async (_event, openPathInput) => {
    return handlers.openPathIn(openPathInput as DesktopOpenPathInInput);
  });

  handleTrusted(channels.openPath, async (_event, path) => {
    return handlers.openPath(path as string);
  });

  handleTrusted(channels.revealItemInDir, async (_event, path) => {
    return handlers.revealItemInDir(path as string);
  });
}
