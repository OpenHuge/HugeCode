import type {
  DesktopBrowserExtractionRequest,
  DesktopBrowserExtractionResult,
} from "@ku0/code-platform-interfaces";
import { getDesktopHostBridge } from "./desktopHostBridge";

export type {
  RuntimeBrowserReadinessSource,
  RuntimeBrowserReadinessState,
  RuntimeBrowserReadinessSummary,
} from "../facades/runtimeBrowserReadiness";
export { readBrowserReadiness } from "../facades/runtimeBrowserReadiness";

export type { DesktopBrowserExtractionRequest, DesktopBrowserExtractionResult };

export async function extractBrowserContent(
  input?: DesktopBrowserExtractionRequest
): Promise<DesktopBrowserExtractionResult | null> {
  return (await getDesktopHostBridge()?.browserExtraction?.extract?.(input)) ?? null;
}

export async function getLastBrowserExtractionResult(): Promise<DesktopBrowserExtractionResult | null> {
  return (await getDesktopHostBridge()?.browserExtraction?.getLastResult?.()) ?? null;
}
