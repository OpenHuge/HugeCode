export function buildRuntimeClarifyInstruction(baseInstruction: string) {
  return `${baseInstruction}\n\nClarify before continuing:\n- What changed?\n- What should stay in bounds?\n- What outcome is required now?`;
}
