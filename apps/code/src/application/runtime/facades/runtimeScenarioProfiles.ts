import type {
  AgentTaskAutoDriveScenarioProfile,
  AgentTaskMissionScenarioProfile,
} from "@ku0/code-runtime-host-contract";

export const BROWSER_REPRO_FIX_VERIFY_SCENARIO_PROFILE = "browser_repro_fix_verify";
export const RESEARCH_ROUTE_DECIDE_SCENARIO_PROFILE = "research_route_decide";

export type MissionScenarioProfile =
  | typeof BROWSER_REPRO_FIX_VERIFY_SCENARIO_PROFILE
  | typeof RESEARCH_ROUTE_DECIDE_SCENARIO_PROFILE;

export type ScenarioProfileWithKeys = {
  scenarioKeys?: string[] | null;
};

const BROWSER_REPRO_FIX_VERIFY_HELD_OUT_GUIDANCE = [
  "Confirm the target repro or user-visible assertion in the real browser before editing code.",
  "After modifying code, return to the real browser, verify the target path again, and attach browser evidence.",
  "Do not declare arrival without browser evidence or an explicit blocked reason.",
];

const RESEARCH_ROUTE_DECIDE_HELD_OUT_GUIDANCE = [
  "Prefer official framework, platform, or vendor documentation over secondary summaries.",
  "Do not mark the route as complete without explicit source evidence and a decision rationale.",
  "If trusted-source evidence is missing, record a research gap or blocked reason instead of guessing.",
];

const BROWSER_REPRO_FIX_VERIFY_SCENARIO_KEYS = [
  BROWSER_REPRO_FIX_VERIFY_SCENARIO_PROFILE,
  "act_and_verify",
  "continuation_on_gap",
  "browser_evidence_required",
];

const RESEARCH_ROUTE_DECIDE_SCENARIO_KEYS = [
  RESEARCH_ROUTE_DECIDE_SCENARIO_PROFILE,
  "source_backed",
  "verify_only",
  "continuation_on_gap",
  "research_sources_required",
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

export function buildResearchRouteDecideScenarioProfile():
  | AgentTaskAutoDriveScenarioProfile
  | AgentTaskMissionScenarioProfile {
  return {
    authorityScope: "workspace_graph",
    authoritySources: ["repo_authority", "workspace_graph", "chatgpt_web"],
    representativeCommands: [],
    componentCommands: [],
    endToEndCommands: [],
    samplePaths: [],
    heldOutGuidance: RESEARCH_ROUTE_DECIDE_HELD_OUT_GUIDANCE,
    sourceSignals: ["external_research", "chatgpt_research_route_lab"],
    scenarioKeys: RESEARCH_ROUTE_DECIDE_SCENARIO_KEYS,
    safeBackground: true,
  };
}

export function buildMissionScenarioProfile(
  scenarioProfile: MissionScenarioProfile | null | undefined
): AgentTaskAutoDriveScenarioProfile | AgentTaskMissionScenarioProfile | null {
  if (scenarioProfile === RESEARCH_ROUTE_DECIDE_SCENARIO_PROFILE) {
    return buildResearchRouteDecideScenarioProfile();
  }
  if (scenarioProfile === BROWSER_REPRO_FIX_VERIFY_SCENARIO_PROFILE) {
    return buildBrowserReproFixVerifyScenarioProfile();
  }
  return null;
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

export function isResearchRouteDecideScenario(
  profile: ScenarioProfileWithKeys | null | undefined
): boolean {
  return hasScenarioKey(profile, RESEARCH_ROUTE_DECIDE_SCENARIO_PROFILE);
}

export function getBrowserReproFixVerifyGuidance(): string[] {
  return BROWSER_REPRO_FIX_VERIFY_HELD_OUT_GUIDANCE;
}

export function getResearchRouteDecideGuidance(): string[] {
  return RESEARCH_ROUTE_DECIDE_HELD_OUT_GUIDANCE;
}
