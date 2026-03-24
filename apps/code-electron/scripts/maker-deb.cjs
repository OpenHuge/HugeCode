"use strict";

const path = require("node:path");
const { chmod, stat } = require("node:fs/promises");
const { createRequire } = require("node:module");
const { MakerBase } = require("@electron-forge/maker-base");

function debianArch(nodeArch) {
  switch (nodeArch) {
    case "ia32":
      return "i386";
    case "x64":
      return "amd64";
    case "armv7l":
      return "armhf";
    case "arm":
      return "armel";
    default:
      return nodeArch;
  }
}

function normalizeDirectoryMode(mode) {
  if (typeof mode === "string" && /^0[0-7]+$/u.test(mode)) {
    return Number.parseInt(mode, 8);
  }
  return mode;
}

function patchFsExtraEnsureDir(packageJsonPath) {
  const requireFromPackage = createRequire(packageJsonPath);
  const fsExtra = requireFromPackage("fs-extra");

  if (fsExtra.__hugecodeEnsureDirPatched) {
    return;
  }

  const originalEnsureDir = fsExtra.ensureDir.bind(fsExtra);
  fsExtra.ensureDir = (targetPath, mode, ...rest) =>
    originalEnsureDir(targetPath, normalizeDirectoryMode(mode), ...rest);

  if (typeof fsExtra.ensureDirSync === "function") {
    const originalEnsureDirSync = fsExtra.ensureDirSync.bind(fsExtra);
    fsExtra.ensureDirSync = (targetPath, mode, ...rest) =>
      originalEnsureDirSync(targetPath, normalizeDirectoryMode(mode), ...rest);
  }

  fsExtra.__hugecodeEnsureDirPatched = true;
}

function patchDebianInstallerModule(installerModule) {
  const InstallerClass = installerModule.Installer;

  if (!InstallerClass || InstallerClass.prototype.__hugecodeCreatePackagePatched) {
    return;
  }

  const originalCreatePackage = InstallerClass.prototype.createPackage;
  InstallerClass.prototype.createPackage = async function patchedCreatePackage(...args) {
    const debianControlDir = path.join(this.stagingDir, "DEBIAN");

    try {
      await stat(debianControlDir);
      await chmod(debianControlDir, 0o755);
    } catch {
      // Debian control dir may not exist if staging failed earlier.
    }

    return originalCreatePackage.apply(this, args);
  };

  InstallerClass.prototype.__hugecodeCreatePackagePatched = true;
}

function loadPatchedDebianInstaller() {
  const requireFromMaker = createRequire(__filename);
  const debianInstallerPackageJsonPath = requireFromMaker.resolve(
    "electron-installer-debian/package.json"
  );
  const requireFromDebianInstaller = createRequire(debianInstallerPackageJsonPath);
  const installerCommonPackageJsonPath = requireFromDebianInstaller.resolve(
    "electron-installer-common/package.json"
  );

  patchFsExtraEnsureDir(installerCommonPackageJsonPath);
  patchFsExtraEnsureDir(debianInstallerPackageJsonPath);

  const installerModule = requireFromDebianInstaller("electron-installer-debian");
  patchDebianInstallerModule(installerModule);
  return installerModule;
}

class HugeCodeMakerDeb extends MakerBase {
  constructor(...args) {
    super(...args);
    this.name = "deb";
    this.defaultPlatforms = ["linux"];
    this.requiredExternalBinaries = ["dpkg", "fakeroot"];
  }

  isSupportedOnCurrentPlatform() {
    return this.isInstalled("electron-installer-debian");
  }

  async make({ dir, makeDir, targetArch }) {
    const installer = loadPatchedDebianInstaller();
    const outDir = path.resolve(makeDir, "deb", targetArch);
    await this.ensureDirectory(outDir);

    const { packagePaths } = await installer({
      options: {},
      ...this.config,
      arch: debianArch(targetArch),
      src: dir,
      dest: outDir,
      rename: undefined,
    });

    return packagePaths;
  }
}

module.exports = HugeCodeMakerDeb;
module.exports.default = HugeCodeMakerDeb;
