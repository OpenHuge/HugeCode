declare module "@desktop-host/core" {
  export function invoke<Result = unknown>(
    command: string,
    payload?: Record<string, unknown>
  ): Promise<Result>;
  export function isDesktopHostRuntime(): boolean;
  export function convertFileSrc(path: string): string;
}

declare module "@desktop-host/event" {
  export function listen<TPayload = unknown>(
    eventName: string,
    listener: (event: { payload: TPayload }) => void
  ): Promise<() => void>;
}

declare module "@desktop-host/dialogs" {
  export function open(input?: unknown): Promise<unknown>;
  export function ask(input?: unknown): Promise<unknown>;
}

declare module "@desktop-host/notifications" {
  export function isPermissionGranted(): boolean;
  export function requestPermission(): Promise<NotificationPermission>;
  export function sendNotification(title: string, options?: NotificationOptions): void;
}
