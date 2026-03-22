export type RuntimeClientMode = "tauri" | "runtime-gateway-web" | "unavailable";

export type RuntimeCapabilitiesSummary = {
  mode: RuntimeClientMode;
  methods: string[];
  features: string[];
  wsEndpointPath: string | null;
  error: string | null;
};
