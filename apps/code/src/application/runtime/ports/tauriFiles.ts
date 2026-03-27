export { readWorkspaceFile } from "../../../services/tauriRuntimeWorkspaceFilesBridge";
export { pickAttachmentFiles } from "../../../services/tauriWorkspaceBridge";
export { pickImageFiles } from "../../../services/tauriWorkspaceBridge";

function normalizeFilePath(path: string) {
  if (path.startsWith("file://")) {
    return path;
  }

  const normalizedPath = path.replace(/\\/g, "/");
  if (/^[A-Za-z]:\//.test(normalizedPath)) {
    return `file:///${encodeURI(normalizedPath)}`;
  }
  if (normalizedPath.startsWith("/")) {
    return `file://${encodeURI(normalizedPath)}`;
  }
  return `file://${encodeURI(`/${normalizedPath}`)}`;
}

export function convertFileSrc(path: string) {
  return normalizeFilePath(path);
}
