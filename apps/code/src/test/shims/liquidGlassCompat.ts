export const GlassMaterialVariant = {
  Regular: "regular",
} as const;

export async function isGlassSupported() {
  return false;
}

export async function setLiquidGlassEffect(_input: {
  cornerRadius?: number;
  enabled: boolean;
  variant?: string;
}) {}
