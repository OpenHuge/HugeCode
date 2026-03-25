import { spawnSync } from "node:child_process";

const FALLBACK_BASE_REFS = [
  "origin/main",
  "main",
  "origin/master",
  "master",
  "origin/fastcode",
  "fastcode",
];

function normalizeRef(ref) {
  return typeof ref === "string" ? ref.trim() : "";
}

function isRemoteRef(ref) {
  return ref.startsWith("origin/");
}

function isDefaultBranchRef(ref) {
  const normalized = normalizeRef(ref);
  if (normalized.length === 0) {
    return false;
  }

  if (FALLBACK_BASE_REFS.includes(normalized)) {
    return true;
  }

  if (isRemoteRef(normalized)) {
    return FALLBACK_BASE_REFS.includes(normalized.slice("origin/".length));
  }

  return false;
}

export function tryReadGitStdout(repoRoot, args) {
  const result = spawnSync("git", args, {
    cwd: repoRoot,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
  if (result.status !== 0) {
    return null;
  }
  return result.stdout.trim();
}

export function hasCommitRef(repoRoot, ref) {
  const normalized = normalizeRef(ref);
  if (normalized.length === 0) {
    return false;
  }

  const result = spawnSync("git", ["rev-parse", "--verify", "--quiet", `${normalized}^{commit}`], {
    cwd: repoRoot,
    stdio: "ignore",
  });
  return result.status === 0;
}

function resolveCurrentBranch(repoRoot) {
  return normalizeRef(tryReadGitStdout(repoRoot, ["branch", "--show-current"]));
}

function resolveUpstreamRef(repoRoot) {
  return normalizeRef(
    tryReadGitStdout(repoRoot, ["rev-parse", "--abbrev-ref", "--symbolic-full-name", "@{upstream}"])
  );
}

function resolveOriginHeadCandidates(repoRoot) {
  const symbolicRef = normalizeRef(
    tryReadGitStdout(repoRoot, ["symbolic-ref", "--quiet", "refs/remotes/origin/HEAD"])
  );
  if (symbolicRef.length === 0 || !symbolicRef.startsWith("refs/remotes/")) {
    return [];
  }

  const shortRef = symbolicRef.slice("refs/remotes/".length);
  const localRef = shortRef.startsWith("origin/") ? shortRef.slice("origin/".length) : shortRef;
  return [...new Set([shortRef, localRef].filter(Boolean))];
}

function resolveSiblingBranchCandidates(repoRoot, currentBranch) {
  const refsRaw = tryReadGitStdout(repoRoot, [
    "for-each-ref",
    "--format=%(refname:short)",
    "--points-at",
    "HEAD",
    "refs/heads",
    "refs/remotes/origin",
  ]);
  if (!refsRaw) {
    return [];
  }

  const refs = refsRaw
    .split(/\r?\n/u)
    .map((entry) => entry.trim())
    .filter(Boolean)
    .filter((entry) => entry !== currentBranch)
    .filter((entry) => entry !== "origin/HEAD")
    .filter((entry) => !isDefaultBranchRef(entry));

  const localRefs = refs.filter((entry) => !isRemoteRef(entry));
  const remoteRefs = refs.filter((entry) => isRemoteRef(entry));
  return [...localRefs, ...remoteRefs];
}

export function resolveGitComparisonBase({
  repoRoot,
  explicitRef = process.env.TURBO_BASE_REF,
  githubBaseRef = process.env.GITHUB_BASE_REF,
  includeHeadFallback = false,
} = {}) {
  const currentBranch = resolveCurrentBranch(repoRoot);
  const upstreamRef = resolveUpstreamRef(repoRoot);

  const candidates = [];

  const normalizedExplicitRef = normalizeRef(explicitRef);
  if (normalizedExplicitRef.length > 0) {
    candidates.push({ ref: normalizedExplicitRef, kind: "explicit" });
  }

  const normalizedGithubBaseRef = normalizeRef(githubBaseRef);
  if (normalizedGithubBaseRef.length > 0) {
    candidates.push(
      { ref: `origin/${normalizedGithubBaseRef}`, kind: "github-base" },
      { ref: normalizedGithubBaseRef, kind: "github-base" }
    );
  }

  if (upstreamRef.length > 0 && upstreamRef !== currentBranch) {
    candidates.push({ ref: upstreamRef, kind: "upstream" });
  }

  for (const siblingRef of resolveSiblingBranchCandidates(repoRoot, currentBranch)) {
    candidates.push({
      ref: siblingRef,
      kind: isRemoteRef(siblingRef) ? "sibling-remote" : "sibling-local",
    });
  }

  for (const originHeadRef of resolveOriginHeadCandidates(repoRoot)) {
    candidates.push({ ref: originHeadRef, kind: "default-branch" });
  }

  for (const fallbackRef of FALLBACK_BASE_REFS) {
    candidates.push({ ref: fallbackRef, kind: "fallback" });
  }

  if (includeHeadFallback) {
    candidates.push({ ref: "HEAD~1", kind: "fallback" });
  }

  const seenRefs = new Set();
  for (const candidate of candidates) {
    const ref = normalizeRef(candidate.ref);
    if (ref.length === 0 || ref === currentBranch || seenRefs.has(ref)) {
      continue;
    }
    seenRefs.add(ref);
    if (hasCommitRef(repoRoot, ref)) {
      return { ref, kind: candidate.kind };
    }
  }

  return { ref: null, kind: "none" };
}
