import fs from "node:fs";
import path from "node:path";

const ARTIFACT_DIR_NAMES = new Set([
  ".turbo",
  "coverage",
  "dist",
  "node_modules",
  "playwright-report",
  "reports",
  "target",
  "test-results",
]);

const ARTIFACT_FILE_NAMES = new Set(["Cargo.lock", "tsconfig.tsbuildinfo"]);
const IGNORED_TOP_LEVEL_DIR_NAMES = new Set(["skills"]);
const README_FILE_NAMES = ["README.md", "readme.md"];
const WORKSPACE_HYGIENE_CONFIG_RELATIVE_PATH = "packages/.workspace-hygiene.json";
const CARGO_SCAN_IGNORED_DIR_NAMES = new Set([
  ...ARTIFACT_DIR_NAMES,
  ".git",
  ".next",
  ".out",
  ".pnpm-store",
]);

/**
 * @param {string} value
 * @returns {string}
 */
function toRepoPath(value) {
  return value.split(path.sep).join("/");
}

/**
 * @param {string} absolutePath
 * @returns {boolean}
 */
function exists(absolutePath) {
  return fs.existsSync(absolutePath);
}

/**
 * @param {string} absolutePath
 * @returns {boolean}
 */
function hasPackageJson(absolutePath) {
  return exists(path.join(absolutePath, "package.json"));
}

/**
 * @param {string} absolutePath
 * @returns {boolean}
 */
function hasCargoToml(absolutePath) {
  return exists(path.join(absolutePath, "Cargo.toml"));
}

/**
 * @param {string} absolutePath
 * @returns {boolean}
 */
function hasReadmeFile(absolutePath) {
  return README_FILE_NAMES.some((fileName) => exists(path.join(absolutePath, fileName)));
}

/**
 * @param {string} absolutePath
 * @returns {string[]}
 */
function listChildDirectories(absolutePath) {
  if (!exists(absolutePath)) {
    return [];
  }

  return fs
    .readdirSync(absolutePath, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();
}

/**
 * @param {string} absolutePath
 * @returns {string[]}
 */
function listChildFiles(absolutePath) {
  if (!exists(absolutePath)) {
    return [];
  }

  return fs
    .readdirSync(absolutePath, { withFileTypes: true })
    .filter((entry) => entry.isFile())
    .map((entry) => entry.name)
    .sort();
}

/**
 * @param {string} repoRoot
 * @returns {string[]}
 */
function collectCargoTomlPaths(repoRoot) {
  /** @type {string[]} */
  const cargoTomlPaths = [];

  /**
   * @param {string} absoluteDir
   */
  function walk(absoluteDir) {
    for (const entry of fs.readdirSync(absoluteDir, { withFileTypes: true })) {
      const absoluteEntryPath = path.join(absoluteDir, entry.name);
      if (entry.isDirectory()) {
        if (CARGO_SCAN_IGNORED_DIR_NAMES.has(entry.name)) {
          continue;
        }
        walk(absoluteEntryPath);
        continue;
      }
      if (entry.isFile() && entry.name === "Cargo.toml") {
        cargoTomlPaths.push(absoluteEntryPath);
      }
    }
  }

  walk(repoRoot);
  return cargoTomlPaths.sort();
}

/**
 * @param {string} repoRoot
 * @returns {Set<string>}
 */
function collectReferencedCargoPathDirs(repoRoot) {
  /** @type {Set<string>} */
  const referencedDirs = new Set();
  const cargoTomlPaths = collectCargoTomlPaths(repoRoot);
  const pathPattern = /\bpath\s*=\s*"([^"]+)"/gu;

  for (const cargoTomlPath of cargoTomlPaths) {
    const cargoTomlDir = path.dirname(cargoTomlPath);
    const content = fs.readFileSync(cargoTomlPath, "utf8");

    for (const match of content.matchAll(pathPattern)) {
      const relativeDependencyPath = match[1]?.trim();
      if (!relativeDependencyPath) {
        continue;
      }

      const absoluteDependencyPath = path.resolve(cargoTomlDir, relativeDependencyPath);
      if (!exists(absoluteDependencyPath)) {
        continue;
      }
      if (!fs.statSync(absoluteDependencyPath).isDirectory()) {
        continue;
      }

      referencedDirs.add(toRepoPath(path.relative(repoRoot, absoluteDependencyPath)));
    }
  }

  return referencedDirs;
}

/**
 * @param {string} repoRoot
 * @param {string} packagesRoot
 * @returns {string[]}
 */
function collectWorkspacePackageDirs(repoRoot, packagesRoot) {
  /** @type {string[]} */
  const workspacePackageDirs = [];

  /**
   * @param {string} absoluteDir
   */
  function walk(absoluteDir) {
    if (hasPackageJson(absoluteDir)) {
      workspacePackageDirs.push(toRepoPath(path.relative(repoRoot, absoluteDir)));
      return;
    }

    for (const childName of listChildDirectories(absoluteDir)) {
      if (ARTIFACT_DIR_NAMES.has(childName)) {
        continue;
      }
      walk(path.join(absoluteDir, childName));
    }
  }

  walk(packagesRoot);
  return workspacePackageDirs.sort();
}

/**
 * @param {string[]} childDirs
 * @param {string[]} childFiles
 * @returns {boolean}
 */
function isArtifactOnlyTopLevelDir(childDirs, childFiles) {
  if (childDirs.length === 0 && childFiles.length === 0) {
    return false;
  }

  return (
    childDirs.every((childName) => ARTIFACT_DIR_NAMES.has(childName)) &&
    childFiles.every((fileName) => ARTIFACT_FILE_NAMES.has(fileName))
  );
}

/**
 * @param {string[]} values
 * @param {number} maxItems
 * @returns {string}
 */
function summarizeValues(values, maxItems = 4) {
  if (values.length === 0) {
    return "";
  }

  const visible = values.slice(0, maxItems);
  const remaining = values.length - visible.length;
  return remaining > 0 ? `${visible.join(", ")} +${remaining} more` : visible.join(", ");
}

/**
 * @param {string} repoRoot
 * @returns {{topLevelDirectories: Record<string, {kind?: string; status?: string}>}}
 */
function loadWorkspaceHygieneConfig(repoRoot) {
  const absolutePath = path.join(repoRoot, WORKSPACE_HYGIENE_CONFIG_RELATIVE_PATH);
  if (!exists(absolutePath)) {
    return { topLevelDirectories: {} };
  }

  const parsed = JSON.parse(fs.readFileSync(absolutePath, "utf8"));
  const topLevelDirectories =
    parsed && typeof parsed === "object" && parsed.topLevelDirectories
      ? parsed.topLevelDirectories
      : {};

  return {
    topLevelDirectories:
      topLevelDirectories && typeof topLevelDirectories === "object" ? topLevelDirectories : {},
  };
}

/**
 * @returns {{
 *   workspacePackageDirs: string[];
 *   containerDirs: Array<{dir: string; nestedPackageDirs: string[]; unresolvedChildren: string[]}>;
 *   orphanCargoCrates: string[];
 *   staleArtifactDirs: string[];
 *   unresolvedTopLevelDirs: string[];
 *   declaredTopLevelDirsMissingReadme: string[];
 *   publicPackagesMissingReadme: string[];
 *   publicPackagesMissingTest: string[];
 * }}
 */
function createEmptyPackagesWorkspaceHygieneReport() {
  return {
    workspacePackageDirs: [],
    containerDirs: [],
    orphanCargoCrates: [],
    staleArtifactDirs: [],
    unresolvedTopLevelDirs: [],
    declaredTopLevelDirsMissingReadme: [],
    publicPackagesMissingReadme: [],
    publicPackagesMissingTest: [],
  };
}

/**
 * @param {string} repoRoot
 * @param {string[]} workspacePackageDirs
 * @returns {{publicPackagesMissingReadme: string[]; publicPackagesMissingTest: string[]}}
 */
function collectPublicPackageGaps(repoRoot, workspacePackageDirs) {
  /** @type {string[]} */
  const publicPackagesMissingReadme = [];
  /** @type {string[]} */
  const publicPackagesMissingTest = [];

  for (const workspacePackageDir of workspacePackageDirs) {
    const absoluteDir = path.join(repoRoot, workspacePackageDir);
    const packageJson = JSON.parse(fs.readFileSync(path.join(absoluteDir, "package.json"), "utf8"));
    if (packageJson.private === true) {
      continue;
    }

    const packageName =
      typeof packageJson.name === "string" && packageJson.name.trim().length > 0
        ? packageJson.name
        : workspacePackageDir;
    const hasReadme = README_FILE_NAMES.some((fileName) =>
      exists(path.join(absoluteDir, fileName))
    );
    const hasTestScript = typeof packageJson.scripts?.test === "string";

    if (!hasReadme) {
      publicPackagesMissingReadme.push(packageName);
    }
    if (!hasTestScript) {
      publicPackagesMissingTest.push(packageName);
    }
  }

  return {
    publicPackagesMissingReadme: publicPackagesMissingReadme.sort(),
    publicPackagesMissingTest: publicPackagesMissingTest.sort(),
  };
}

/**
 * @param {string} repoRoot
 * @param {string} packagesRoot
 * @param {string} topLevelName
 * @param {Set<string>} workspacePackageDirSet
 * @param {Record<string, {kind?: string; status?: string}>} declaredTopLevelDirs
 * @returns {{
 *   container?: {dir: string; nestedPackageDirs: string[]; unresolvedChildren: string[]};
 *   orphanCargoCrate?: string;
 *   staleArtifactDir?: string;
 *   unresolvedTopLevelDir?: string;
 *   declaredTopLevelDirMissingReadme?: string;
 * } | null}
 */
function classifyTopLevelPackagesEntry(
  repoRoot,
  packagesRoot,
  topLevelName,
  workspacePackageDirSet,
  referencedCargoPathDirSet,
  declaredTopLevelDirs
) {
  if (IGNORED_TOP_LEVEL_DIR_NAMES.has(topLevelName)) {
    return null;
  }

  const absoluteDir = path.join(packagesRoot, topLevelName);
  const relativeDir = toRepoPath(path.relative(repoRoot, absoluteDir));
  const declaredTopLevelDir = declaredTopLevelDirs[topLevelName] ?? null;
  if (hasPackageJson(absoluteDir)) {
    return null;
  }
  if (hasCargoToml(absoluteDir)) {
    if (referencedCargoPathDirSet.has(relativeDir)) {
      return null;
    }
    return { orphanCargoCrate: relativeDir };
  }

  const childDirs = listChildDirectories(absoluteDir);
  const childFiles = listChildFiles(absoluteDir);
  const nestedPackageDirs = childDirs
    .map((childName) => toRepoPath(path.join(relativeDir, childName)))
    .filter((childDir) => workspacePackageDirSet.has(childDir))
    .sort();

  if (nestedPackageDirs.length > 0) {
    const unresolvedChildren = childDirs
      .filter((childName) => !ARTIFACT_DIR_NAMES.has(childName))
      .map((childName) => toRepoPath(path.join(relativeDir, childName)))
      .filter((childDir) => !nestedPackageDirs.includes(childDir))
      .sort();

    return {
      container: {
        dir: relativeDir,
        nestedPackageDirs,
        unresolvedChildren,
      },
    };
  }

  if (isArtifactOnlyTopLevelDir(childDirs, childFiles)) {
    return { staleArtifactDir: relativeDir };
  }

  if (declaredTopLevelDir) {
    if (!hasReadmeFile(absoluteDir)) {
      return { declaredTopLevelDirMissingReadme: relativeDir };
    }

    return null;
  }

  return { unresolvedTopLevelDir: relativeDir };
}

/**
 * @param {string} repoRoot
 * @returns {{
 *   workspacePackageDirs: string[];
 *   containerDirs: Array<{dir: string; nestedPackageDirs: string[]; unresolvedChildren: string[]}>;
 *   orphanCargoCrates: string[];
 *   staleArtifactDirs: string[];
 *   unresolvedTopLevelDirs: string[];
 *   declaredTopLevelDirsMissingReadme: string[];
 *   publicPackagesMissingReadme: string[];
 *   publicPackagesMissingTest: string[];
 * }}
 */
export function collectPackagesWorkspaceHygiene(repoRoot) {
  const packagesRoot = path.join(repoRoot, "packages");
  if (!exists(packagesRoot)) {
    return createEmptyPackagesWorkspaceHygieneReport();
  }

  const workspacePackageDirs = collectWorkspacePackageDirs(repoRoot, packagesRoot);
  const workspacePackageDirSet = new Set(workspacePackageDirs);
  const referencedCargoPathDirSet = collectReferencedCargoPathDirs(repoRoot);
  const workspaceHygieneConfig = loadWorkspaceHygieneConfig(repoRoot);
  /** @type {Array<{dir: string; nestedPackageDirs: string[]; unresolvedChildren: string[]}>} */
  const containerDirs = [];
  /** @type {string[]} */
  const orphanCargoCrates = [];
  /** @type {string[]} */
  const staleArtifactDirs = [];
  /** @type {string[]} */
  const unresolvedTopLevelDirs = [];
  /** @type {string[]} */
  const declaredTopLevelDirsMissingReadme = [];
  const publicPackageGaps = collectPublicPackageGaps(repoRoot, workspacePackageDirs);

  for (const topLevelName of listChildDirectories(packagesRoot)) {
    const classification = classifyTopLevelPackagesEntry(
      repoRoot,
      packagesRoot,
      topLevelName,
      workspacePackageDirSet,
      referencedCargoPathDirSet,
      workspaceHygieneConfig.topLevelDirectories
    );
    if (classification === null) {
      continue;
    }
    if (classification.container) {
      containerDirs.push(classification.container);
    }
    if (classification.orphanCargoCrate) {
      orphanCargoCrates.push(classification.orphanCargoCrate);
    }
    if (classification.staleArtifactDir) {
      staleArtifactDirs.push(classification.staleArtifactDir);
    }
    if (classification.unresolvedTopLevelDir) {
      unresolvedTopLevelDirs.push(classification.unresolvedTopLevelDir);
    }
    if (classification.declaredTopLevelDirMissingReadme) {
      declaredTopLevelDirsMissingReadme.push(classification.declaredTopLevelDirMissingReadme);
    }
  }

  return {
    workspacePackageDirs,
    containerDirs,
    orphanCargoCrates: orphanCargoCrates.sort(),
    staleArtifactDirs: staleArtifactDirs.sort(),
    unresolvedTopLevelDirs: unresolvedTopLevelDirs.sort(),
    declaredTopLevelDirsMissingReadme: declaredTopLevelDirsMissingReadme.sort(),
    publicPackagesMissingReadme: publicPackageGaps.publicPackagesMissingReadme,
    publicPackagesMissingTest: publicPackageGaps.publicPackagesMissingTest,
  };
}

/**
 * @param {ReturnType<typeof collectPackagesWorkspaceHygiene>} report
 * @returns {{status: "PASS" | "WARN"; detail: string}}
 */
export function summarizePackagesWorkspaceHygiene(report) {
  const parts = [];

  if (report.staleArtifactDirs.length > 0) {
    parts.push(
      `stale dirs=${report.staleArtifactDirs.length} (${summarizeValues(report.staleArtifactDirs)})`
    );
  }
  if (report.orphanCargoCrates.length > 0) {
    parts.push(
      `orphan cargo crates=${report.orphanCargoCrates.length} (${summarizeValues(report.orphanCargoCrates)})`
    );
  }

  const unresolvedContainerChildren = report.containerDirs.flatMap(
    (entry) => entry.unresolvedChildren
  );
  if (unresolvedContainerChildren.length > 0) {
    parts.push(
      `unresolved container children=${unresolvedContainerChildren.length} (${summarizeValues(unresolvedContainerChildren)})`
    );
  }
  if (report.unresolvedTopLevelDirs.length > 0) {
    parts.push(
      `unresolved dirs=${report.unresolvedTopLevelDirs.length} (${summarizeValues(report.unresolvedTopLevelDirs)})`
    );
  }
  if (report.declaredTopLevelDirsMissingReadme.length > 0) {
    parts.push(
      `declared dirs missing README=${report.declaredTopLevelDirsMissingReadme.length} (${summarizeValues(report.declaredTopLevelDirsMissingReadme)})`
    );
  }
  if (report.publicPackagesMissingReadme.length > 0) {
    parts.push(
      `public packages missing README=${report.publicPackagesMissingReadme.length} (${summarizeValues(report.publicPackagesMissingReadme)})`
    );
  }
  if (report.publicPackagesMissingTest.length > 0) {
    parts.push(
      `public packages missing test=${report.publicPackagesMissingTest.length} (${summarizeValues(report.publicPackagesMissingTest)})`
    );
  }

  if (parts.length === 0) {
    return {
      status: "PASS",
      detail: `Workspace packages=${report.workspacePackageDirs.length}; no stale directories or public-package hygiene gaps detected.`,
    };
  }

  return {
    status: "WARN",
    detail: `Workspace packages=${report.workspacePackageDirs.length}; ${parts.join("; ")}.`,
  };
}
