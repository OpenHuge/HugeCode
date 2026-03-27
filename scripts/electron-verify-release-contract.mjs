import { resolve } from "node:path";
import {
  verifyElectronForgeFuseContract,
  loadElectronReleaseContract,
  verifyElectronPackagedAppIntegrity,
  verifyElectronForgeUpdateContract,
  verifyElectronMakeArtifacts,
  verifyElectronPackagedRendererTransport,
  verifyElectronPackagedUpdaterRuntime,
} from "./lib/electron-update-release-contract.mjs";

const repoRoot = resolve(import.meta.dirname, "..");
const requireMakeArtifacts = process.argv.includes("--require-make");

const contract = await loadElectronReleaseContract(repoRoot);
verifyElectronForgeUpdateContract(contract);
verifyElectronForgeFuseContract(contract);
const runtimeResult = await verifyElectronPackagedUpdaterRuntime(repoRoot);
const rendererTransportResult = await verifyElectronPackagedRendererTransport(repoRoot);
const appIntegrityResult = await verifyElectronPackagedAppIntegrity(repoRoot);
const makeResult = requireMakeArtifacts
  ? await verifyElectronMakeArtifacts(repoRoot, { skipDmg: contract.skipDmg })
  : null;

process.stdout.write(
  `Electron release contract verified: channel=${contract.releaseChannel} mode=${contract.updateMode} provider=${contract.provider} appAsar=${runtimeResult.appAsarPath} renderer=${rendererTransportResult.rendererTransport}${appIntegrityResult.appPath ? ` app=${appIntegrityResult.appPath}` : ""}${makeResult ? ` artifacts=${makeResult.files.length}` : ""}\n`
);
