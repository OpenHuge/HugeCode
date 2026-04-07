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
} from "@ku0/code-platform-interfaces";
import type { DesktopWindowDescriptor } from "./desktopShellState.js";

type WindowController = {
  closeWindow(windowId: number): boolean;
  focusWindow(windowId: number): boolean;
  getSessionForWebContents(webContents: unknown): unknown;
  getWindowLabelForWebContents(webContents: unknown): string;
  listWindows(): DesktopWindowDescriptor[];
  openWindow(): unknown;
  reopenSession(sessionId: string): boolean;
};

type TrayController = {
  getState(): { enabled: boolean; supported: boolean };
  update(): void;
};

type NotificationController = {
  showNotification(event: { sender: unknown }, input: DesktopNotificationInput): boolean;
};

type UpdaterController = {
  checkForUpdates(): DesktopUpdateState;
  getState(): DesktopUpdateState;
  restartToApplyUpdate(): boolean;
};

export type CreateDesktopHostHandlersInput = {
  appVersion: string | null;
  aiWebLab: {
    closeSession(): Promise<DesktopAiWebLabState | null> | DesktopAiWebLabState | null;
    extractArtifact(): Promise<DesktopAiWebLabArtifact | null> | DesktopAiWebLabArtifact | null;
    focusSession(): Promise<DesktopAiWebLabState | null> | DesktopAiWebLabState | null;
    getCatalog(): Promise<DesktopAiWebLabCatalog | null> | DesktopAiWebLabCatalog | null;
    getState(): Promise<DesktopAiWebLabState | null> | DesktopAiWebLabState | null;
    navigate(
      input: DesktopAiWebLabNavigationInput
    ): Promise<DesktopAiWebLabState | null> | DesktopAiWebLabState | null;
    openEntrypoint(
      providerId: AiWebLabProviderId,
      entrypointId: string
    ): Promise<DesktopAiWebLabState | null> | DesktopAiWebLabState | null;
    openSession(
      input?: DesktopAiWebLabOpenInput
    ): Promise<DesktopAiWebLabState | null> | DesktopAiWebLabState | null;
    setSessionMode(
      mode: DesktopAiWebLabSessionMode
    ): Promise<DesktopAiWebLabState | null> | DesktopAiWebLabState | null;
    setViewMode(
      mode: DesktopAiWebLabViewMode
    ): Promise<DesktopAiWebLabState | null> | DesktopAiWebLabState | null;
  };
  browserAssessment: {
    assess(
      input: DesktopBrowserAssessmentRequest
    ): Promise<DesktopBrowserAssessmentResult | null> | DesktopBrowserAssessmentResult | null;
    getLastResult():
      | Promise<DesktopBrowserAssessmentResult | null>
      | DesktopBrowserAssessmentResult
      | null;
  };
  browserExtraction: {
    extract(
      input?: DesktopBrowserExtractionRequest
    ): Promise<DesktopBrowserExtractionResult | null> | DesktopBrowserExtractionResult | null;
    getLastResult():
      | Promise<DesktopBrowserExtractionResult | null>
      | DesktopBrowserExtractionResult
      | null;
  };
  copySupportSnapshot(): boolean;
  consumePendingLaunchIntent(): DesktopLaunchIntent | null;
  getAppInfo(): DesktopAppInfo;
  getDiagnosticsInfo(): DesktopDiagnosticsInfo;
  listLocalChromeDebuggerEndpoints(): LocalChromeDebuggerEndpointDescriptor[];
  listRecentSessions(): unknown[];
  notificationController: NotificationController;
  openDialog(
    input?: DesktopOpenDialogInput
  ): Promise<DesktopOpenDialogResult> | DesktopOpenDialogResult;
  openExternalUrl(url: string): Promise<boolean> | boolean;
  openPathIn(input: DesktopOpenPathInInput): Promise<boolean> | boolean;
  openPath(path: string): Promise<boolean> | boolean;
  persistTrayEnabled(enabled: boolean): void;
  revealItemInDir(path: string): Promise<boolean> | boolean;
  trayController: TrayController;
  updaterController: UpdaterController;
  windowController: WindowController;
};

export function createDesktopHostHandlers(input: CreateDesktopHostHandlersInput) {
  return {
    checkForUpdates() {
      return input.updaterController.checkForUpdates();
    },
    closeAiWebLabSession() {
      return input.aiWebLab.closeSession();
    },
    assessBrowserSurface(assessmentInput: DesktopBrowserAssessmentRequest) {
      return input.browserAssessment.assess(assessmentInput);
    },
    closeWindow: input.windowController.closeWindow,
    copySupportSnapshot() {
      return input.copySupportSnapshot();
    },
    consumePendingLaunchIntent() {
      return input.consumePendingLaunchIntent();
    },
    extractBrowserContent(extractionInput?: DesktopBrowserExtractionRequest) {
      return input.browserExtraction.extract(extractionInput);
    },
    extractAiWebLabArtifact() {
      return input.aiWebLab.extractArtifact();
    },
    focusWindow: input.windowController.focusWindow,
    focusAiWebLabSession() {
      return input.aiWebLab.focusSession();
    },
    getAppInfo() {
      return input.getAppInfo();
    },
    getAiWebLabCatalog() {
      return input.aiWebLab.getCatalog();
    },
    getAiWebLabState() {
      return input.aiWebLab.getState();
    },
    getDiagnosticsInfo() {
      return input.getDiagnosticsInfo();
    },
    getLastBrowserAssessmentResult() {
      return input.browserAssessment.getLastResult();
    },
    getLastBrowserExtractionResult() {
      return input.browserExtraction.getLastResult();
    },
    listLocalChromeDebuggerEndpoints() {
      return input.listLocalChromeDebuggerEndpoints();
    },
    getAppVersion() {
      return input.appVersion;
    },
    getCurrentSession(event: { sender: unknown }) {
      return input.windowController.getSessionForWebContents(event.sender);
    },
    getTrayState() {
      return input.trayController.getState();
    },
    getUpdateState() {
      return input.updaterController.getState();
    },
    getWindowLabel(event: { sender: unknown }) {
      return input.windowController.getWindowLabelForWebContents(event.sender);
    },
    listRecentSessions() {
      return input.listRecentSessions();
    },
    listWindows: input.windowController.listWindows,
    navigateAiWebLab(aiWebLabNavigationInput: DesktopAiWebLabNavigationInput) {
      return input.aiWebLab.navigate(aiWebLabNavigationInput);
    },
    openDialog: input.openDialog,
    openExternalUrl: input.openExternalUrl,
    openAiWebLabEntrypoint(providerId: AiWebLabProviderId, entrypointId: string) {
      return input.aiWebLab.openEntrypoint(providerId, entrypointId);
    },
    openAiWebLabSession(aiWebLabInput?: DesktopAiWebLabOpenInput) {
      return input.aiWebLab.openSession(aiWebLabInput);
    },
    openPathIn: input.openPathIn,
    openPath: input.openPath,
    openWindow: input.windowController.openWindow,
    reopenSession: input.windowController.reopenSession,
    revealItemInDir: input.revealItemInDir,
    restartToApplyUpdate() {
      return input.updaterController.restartToApplyUpdate();
    },
    setAiWebLabSessionMode(mode: DesktopAiWebLabSessionMode) {
      return input.aiWebLab.setSessionMode(mode);
    },
    setAiWebLabViewMode(mode: DesktopAiWebLabViewMode) {
      return input.aiWebLab.setViewMode(mode);
    },
    setTrayEnabled(enabled: boolean) {
      input.persistTrayEnabled(enabled);
      input.trayController.update();
      return input.trayController.getState();
    },
    showNotification(event: { sender: unknown }, notificationInput: DesktopNotificationInput) {
      return input.notificationController.showNotification(event, notificationInput);
    },
  };
}
