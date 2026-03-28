export type ResourceKind = "extension" | "skill" | "prompt" | "theme" | "context";

export interface ResourceDiagnostic {
  code: "resource-collision" | "resource-invalid" | "resource-load-failed";
  severity: "warning" | "error";
  message: string;
  kind: ResourceKind;
  filePath?: string;
  resourceName?: string;
  shadowedBy?: string;
}
