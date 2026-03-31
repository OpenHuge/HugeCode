import { getRuntimeClient } from "./runtimeClient";
import type { AppSettings } from "../types";

export async function getRuntimeAppSettings(): Promise<AppSettings> {
  return getRuntimeClient().appSettingsGet();
}

export async function updateRuntimeAppSettings(settings: AppSettings): Promise<AppSettings> {
  return getRuntimeClient().appSettingsUpdate(settings);
}
