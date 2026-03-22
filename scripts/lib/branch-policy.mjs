export const EXEMPT_BRANCH_NAMES = new Set(["main", "fastcode"]);
export const ALLOWED_BRANCH_PREFIXES = [
  "feat",
  "fix",
  "docs",
  "chore",
  "refactor",
  "test",
  "perf",
  "hotfix",
];

const SLUG_SEGMENT = "[A-Za-z0-9]+(?:[._-][A-Za-z0-9]+)*";
const WORKING_BRANCH_PATTERN = new RegExp(
  `^(?:${ALLOWED_BRANCH_PREFIXES.join("|")})\\/${SLUG_SEGMENT}(?:\\/${SLUG_SEGMENT})*$`,
  "u"
);

export function formatAllowedBranchPrefixes() {
  return ALLOWED_BRANCH_PREFIXES.join("|");
}

export function evaluateBranchPolicy(branchName) {
  const branch = typeof branchName === "string" ? branchName.trim() : "";

  if (branch.length === 0 || branch === "HEAD") {
    return {
      ok: true,
      status: "warn",
      branch: branch.length > 0 ? branch : null,
      detail: "Detached HEAD or unavailable branch name; branch policy is advisory only.",
      kind: "detached",
    };
  }

  if (EXEMPT_BRANCH_NAMES.has(branch)) {
    return {
      ok: true,
      status: "pass",
      branch,
      detail: `Branch "${branch}" is exempt from working-branch naming policy.`,
      kind: "exempt",
    };
  }

  if (WORKING_BRANCH_PATTERN.test(branch)) {
    return {
      ok: true,
      status: "pass",
      branch,
      detail: `Branch "${branch}" matches the required <type>/<task-slug> policy.`,
      kind: "working",
    };
  }

  return {
    ok: false,
    status: "fail",
    branch,
    detail: `Branch "${branch}" must match <type>/<task-slug> where <type> is one of ${formatAllowedBranchPrefixes()}, or be an exempt long-lived branch (${[...EXEMPT_BRANCH_NAMES].join(", ")}).`,
    kind: "invalid",
  };
}
