import type {
  AgentTaskAutoDriveScenarioProfile,
  AgentTaskMissionScenarioProfile,
} from "@ku0/code-runtime-host-contract";

export const BROWSER_REPRO_FIX_VERIFY_SCENARIO_PROFILE = "browser_repro_fix_verify";

export type MissionScenarioProfile = typeof BROWSER_REPRO_FIX_VERIFY_SCENARIO_PROFILE;

export type ScenarioProfileWithKeys = {
  scenarioKeys?: string[] | null;
};

const BROWSER_REPRO_FIX_VERIFY_HELD_OUT_GUIDANCE = [
  "Confirm the target repro or user-visible assertion in the real browser before editing code.",
  "After modifying code, return to the real browser, verify the target path again, and attach browser evidence.",
  "Do not declare arrival without browser evidence or an explicit blocked reason.",
];

const BROWSER_REPRO_FIX_VERIFY_SCENARIO_KEYS = [
  BROWSER_REPRO_FIX_VERIFY_SCENARIO_PROFILE,
  "act_and_verify",
  "continuation_on_gap",
  "browser_evidence_required",
];

function dedupe(values: string[]): string[] {
  return [...new Set(values.filter((value) => value.trim().length > 0))];
}

export function buildBrowserReproFixVerifyScenarioProfile():
  | AgentTaskAutoDriveScenarioProfile
  | AgentTaskMissionScenarioProfile {
  return {
    authorityScope: "workspace_graph",
    authoritySources: ["repo_authority", "workspace_graph", "browser_runtime"],
    representativeCommands: [],
    componentCommands: [],
    endToEndCommands: [],
    samplePaths: [],
    heldOutGuidance: BROWSER_REPRO_FIX_VERIFY_HELD_OUT_GUIDANCE,
    sourceSignals: ["browser_debug", "chatgpt_decision_lab"],
    scenarioKeys: BROWSER_REPRO_FIX_VERIFY_SCENARIO_KEYS,
    safeBackground: false,
  };
}

export function mergeScenarioProfileWithKeys<T extends ScenarioProfileWithKeys>(
  profile: T,
  extraKeys: string[]
): T {
  return {
    ...profile,
    scenarioKeys: dedupe([...(profile.scenarioKeys ?? []), ...extraKeys]),
  };
}

export function hasScenarioKey(
  profile: ScenarioProfileWithKeys | null | undefined,
  scenarioKey: string
): boolean {
  return profile?.scenarioKeys?.includes(scenarioKey) ?? false;
}

export function isBrowserReproFixVerifyScenario(
  profile: ScenarioProfileWithKeys | null | undefined
): boolean {
  return hasScenarioKey(profile, BROWSER_REPRO_FIX_VERIFY_SCENARIO_PROFILE);
}

export function getBrowserReproFixVerifyGuidance(): string[] {
  return BROWSER_REPRO_FIX_VERIFY_HELD_OUT_GUIDANCE;
}
