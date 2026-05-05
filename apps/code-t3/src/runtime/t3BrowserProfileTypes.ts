export type T3BrowserProvider = "chatgpt" | "gemini" | "hugerouter" | "custom";

export type OpenT3BrowserProviderInput = {
  assistant?: "chatgpt" | "ldxp" | null;
  captureMode?: "operator-delivery" | null;
  customUrl?: string | null;
  isolatedAppId?: string | null;
  profileId: string;
  providerId: T3BrowserProvider;
};
