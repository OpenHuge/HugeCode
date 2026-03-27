import { getDesktopHostBridge } from "../application/runtime/ports/desktopHostBridge";
import { logRuntimeWarning } from "./tauriRuntimeTurnHelpers";

export async function sendNotification(
  title: string,
  body: string,
  options?: {
    id?: number;
    group?: string;
    actionTypeId?: string;
    sound?: string;
    autoCancel?: boolean;
    extra?: Record<string, unknown>;
  }
): Promise<void> {
  const shown = await getDesktopHostBridge()?.notifications?.show?.({
    body,
    title,
  });
  if (shown !== false && shown !== undefined) {
    return;
  }

  if (typeof Notification !== "function") {
    return;
  }

  try {
    let permission = Notification.permission;
    if (permission === "default") {
      permission = await Notification.requestPermission();
    }
    if (permission !== "granted") {
      logRuntimeWarning("Notification permission not granted.", { permission });
      return;
    }

    const notification = new Notification(title, {
      body,
      tag: options?.group,
    });
    if (options?.autoCancel !== false) {
      notification.onshow = () => {
        setTimeout(() => {
          notification.close();
        }, 8_000);
      };
    }
  } catch (error) {
    logRuntimeWarning("Notification delivery failed.", { error });
  }
}
