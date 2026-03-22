import type { ApprovalRequest } from "../../../types";

const HIDDEN_APPROVAL_PARAM_KEYS = new Set(["threadId", "thread_id", "turnId", "turn_id"]);

function readRequestField(params: Record<string, unknown>, keys: string[]): string | null {
  for (const key of keys) {
    const value = params[key];
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }
  return null;
}

export function getApprovalRequestThreadId(request: ApprovalRequest): string | null {
  return readRequestField(request.params, ["threadId", "thread_id"]);
}

export function formatApprovalLabel(value: string) {
  return value
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/_/g, " ")
    .trim();
}

export function formatApprovalMethodLabel(method: string) {
  const trimmed = method
    .replace(/^runtime\/requestApproval\/?/, "")
    .replace(/^workspace\/requestApproval\/?/, "")
    .replace(/^codex\/requestApproval\/?/, "");
  return trimmed || method;
}

export function getApprovalPresentationEntries(request: ApprovalRequest) {
  return Object.entries(request.params).filter(([key]) => !HIDDEN_APPROVAL_PARAM_KEYS.has(key));
}

export function renderApprovalParamValue(key: string, value: unknown) {
  if (value === null || value === undefined) {
    return { text: "None", isCode: false };
  }
  if (key === "command" && typeof value === "string") {
    return { text: value, isCode: true };
  }
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return { text: String(value), isCode: false };
  }
  if (Array.isArray(value)) {
    if (value.every((entry) => ["string", "number", "boolean"].includes(typeof entry))) {
      return { text: value.map(String).join(", "), isCode: false };
    }
    return { text: JSON.stringify(value, null, 2), isCode: true };
  }
  return { text: JSON.stringify(value, null, 2), isCode: true };
}

export function isEditableApprovalTarget(target: EventTarget | null) {
  return (
    target instanceof HTMLElement &&
    (target.isContentEditable ||
      target.tagName === "INPUT" ||
      target.tagName === "TEXTAREA" ||
      target.tagName === "SELECT")
  );
}

export function isApprovalHotkeyAllowed(event: KeyboardEvent) {
  if (event.key !== "Enter") {
    return false;
  }
  const active = document.activeElement;
  if (!(active instanceof HTMLElement)) {
    return true;
  }
  if (isEditableApprovalTarget(active)) {
    return false;
  }
  if (
    active.tagName === "BUTTON" ||
    active.tagName === "A" ||
    active.getAttribute("role") === "button" ||
    active.getAttribute("role") === "link"
  ) {
    return false;
  }
  return true;
}
