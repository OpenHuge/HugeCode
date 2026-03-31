import { getDesktopHostBridge } from "../desktopHostBridge";

type DialogKind = "error" | "info" | "warning";

type AskOptions = {
  cancelLabel?: string;
  kind?: DialogKind;
  okLabel?: string;
  title?: string;
};

type MessageOptions = {
  kind?: DialogKind;
  title?: string;
};

type OpenOptions = {
  directory?: boolean;
  multiple?: boolean;
};

type OpenResult = string | string[] | null;

function emptySelection(multiple: boolean): OpenResult {
  return multiple ? [] : null;
}

export async function ask(message: string, _options?: AskOptions): Promise<boolean> {
  if (typeof window === "undefined" || typeof window.confirm !== "function") {
    return false;
  }
  return window.confirm(message);
}

export async function message(messageText: string, _options?: MessageOptions): Promise<void> {
  if (typeof window === "undefined" || typeof window.alert !== "function") {
    return;
  }
  window.alert(messageText);
}

export async function open(options: OpenOptions = {}): Promise<OpenResult> {
  const dialogResult = await getDesktopHostBridge()?.dialogs?.open?.({
    directory: options.directory === true,
    multiple: options.multiple === true,
  });
  if (dialogResult !== undefined) {
    return dialogResult ?? emptySelection(options.multiple === true);
  }

  return emptySelection(options.multiple === true);
}
