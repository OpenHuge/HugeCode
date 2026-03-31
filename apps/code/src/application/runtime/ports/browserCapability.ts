import type {
  DesktopBrowserAssessmentRequest,
  DesktopBrowserAssessmentResult,
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

export type {
  DesktopBrowserAssessmentRequest,
  DesktopBrowserAssessmentResult,
  DesktopBrowserExtractionRequest,
  DesktopBrowserExtractionResult,
};

export async function assessBrowserSurface(
  input: DesktopBrowserAssessmentRequest
): Promise<DesktopBrowserAssessmentResult | null> {
  return (await getDesktopHostBridge()?.browserAssessment?.assess?.(input)) ?? null;
}

export async function getLastBrowserAssessmentResult(): Promise<DesktopBrowserAssessmentResult | null> {
  return (await getDesktopHostBridge()?.browserAssessment?.getLastResult?.()) ?? null;
}

export async function extractBrowserContent(
  input?: DesktopBrowserExtractionRequest
): Promise<DesktopBrowserExtractionResult | null> {
  return (await getDesktopHostBridge()?.browserExtraction?.extract?.(input)) ?? null;
}

export async function getLastBrowserExtractionResult(): Promise<DesktopBrowserExtractionResult | null> {
  return (await getDesktopHostBridge()?.browserExtraction?.getLastResult?.()) ?? null;
}
