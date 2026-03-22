import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";

function toPosixPath(filePath) {
  return filePath.split(path.sep).join(path.posix.sep);
}

function resolveProjectRootDir(projectAbsolutePath) {
  try {
    const parsed = JSON.parse(fs.readFileSync(projectAbsolutePath, "utf8"));
    const configuredRootDir = parsed?.compilerOptions?.rootDir;
    if (typeof configuredRootDir !== "string" || configuredRootDir.trim().length === 0) {
      return null;
    }
    return path.resolve(path.dirname(projectAbsolutePath), configuredRootDir);
  } catch {
    return null;
  }
}

export function createValidateTempManager() {
  const tempParents = new Set();

  return {
    createChangedFilesTypecheckConfig({ repoRoot, packageDir, projectPath, changedFiles }) {
      const packageRoot = path.join(repoRoot, packageDir);
      const tempParentDir = path.join(packageRoot, ".validate-temp");
      fs.mkdirSync(tempParentDir, { recursive: true });
      tempParents.add(tempParentDir);
      const projectAbsolutePath = path.join(packageRoot, projectPath);
      if (!fs.existsSync(projectAbsolutePath)) {
        return null;
      }

      const projectRootDir = resolveProjectRootDir(projectAbsolutePath);
      const eligibleChangedFiles = projectRootDir
        ? changedFiles.filter((changedFile) => {
            const absoluteChangedFile = path.resolve(packageRoot, changedFile);
            const relativeToRootDir = path.relative(projectRootDir, absoluteChangedFile);
            return (
              relativeToRootDir.length > 0 &&
              !relativeToRootDir.startsWith(`..${path.sep}`) &&
              relativeToRootDir !== ".."
            );
          })
        : changedFiles;
      if (eligibleChangedFiles.length === 0) {
        try {
          fs.rmSync(tempParentDir, { recursive: true, force: true });
        } catch {
          // ignore cleanup failures for empty temp directories
        }
        return {
          configAbsolutePath: null,
          skipPackageFallback: true,
        };
      }

      const tempDir = resolveValidateTempDir(tempParentDir, packageDir);
      const hashSeed = `${packageDir}:${projectPath}:${eligibleChangedFiles.join(",")}`;
      const hash = createHash("sha1").update(hashSeed).digest("hex").slice(0, 8);
      const fileName = `tsconfig.changed-files.${process.pid}.${hash}.json`;
      const configAbsolutePath = path.join(tempDir, fileName);
      const extendsPath = toPosixPath(path.relative(tempDir, projectAbsolutePath));
      const files = eligibleChangedFiles.map((changedFile) =>
        toPosixPath(path.relative(tempDir, path.resolve(packageRoot, changedFile)))
      );
      const configContent = {
        extends: extendsPath,
        files,
      };
      fs.writeFileSync(configAbsolutePath, `${JSON.stringify(configContent, null, 2)}\n`, "utf8");

      return {
        configAbsolutePath,
        skipPackageFallback: false,
      };
    },
    cleanup() {
      for (const tempParentDir of tempParents) {
        try {
          fs.rmSync(tempParentDir, { recursive: true, force: true });
        } catch {
          // ignore temp cleanup failures on process exit
        }
      }
    },
  };
}

function resolveValidateTempDir(tempRoot, packageDir) {
  const packageKey = createHash("sha1").update(packageDir).digest("hex").slice(0, 10);
  const tempDir = path.join(tempRoot, `${path.basename(packageDir)}-${packageKey}`);
  fs.mkdirSync(tempDir, { recursive: true });
  return tempDir;
}
