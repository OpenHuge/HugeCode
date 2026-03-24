import { resolve } from "node:path";
import {
  loadElectronReleaseContract,
  verifyElectronForgeUpdateContract,
  verifyElectronMakeArtifacts,
  verifyElectronPackagedUpdaterRuntime,
} from "./lib/electron-update-release-contract.mjs";

const repoRoot = resolve(import.meta.dirname, "..");
const requireMakeArtifacts = process.argv.includes("--require-make");

const contract = await loadElectronReleaseContract(repoRoot);
verifyElectronForgeUpdateContract(contract);
const runtimeResult = await verifyElectronPackagedUpdaterRuntime(repoRoot);
const makeResult = requireMakeArtifacts ? await verifyElectronMakeArtifacts(repoRoot) : null;

process.stdout.write(
  `Electron release contract verified: channel=${contract.releaseChannel} mode=${contract.updateMode} provider=${contract.provider} appAsar=${runtimeResult.appAsarPath}${makeResult ? ` artifacts=${makeResult.files.length}` : ""}\n`
);
