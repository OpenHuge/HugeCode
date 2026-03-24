import { resolve } from "node:path";
import {
  loadElectronReleaseContract,
  verifyElectronForgeUpdateContract,
  verifyElectronMakeArtifacts,
  verifyElectronPackagedUpdaterRuntime,
} from "./lib/electron-update-release-contract.mjs";

const repoRoot = resolve(import.meta.dirname, "..");
const contract = await loadElectronReleaseContract(repoRoot);
verifyElectronForgeUpdateContract(contract);
const runtimeResult = await verifyElectronPackagedUpdaterRuntime(repoRoot);
const makeResult = await verifyElectronMakeArtifacts(repoRoot);

function writeLine(message) {
  process.stdout.write(`${message}\n`);
}

writeLine(
  `Electron publish dry-run: channel=${contract.releaseChannel} mode=${contract.updateMode} provider=${contract.provider}.`
);

if (contract.updateMode === "enabled_stable_public_service") {
  writeLine(
    "Electron publish dry-run: stable builds use update.electronjs.org and must publish signed GitHub release assets, not prereleases."
  );
} else if (contract.updateMode === "enabled_beta_static_feed") {
  writeLine(
    `Electron publish dry-run: beta auto-update uses static storage rooted at ${contract.staticUpdateBaseUrlRoot}.`
  );
  writeLine(
    `Electron publish dry-run: current platform feed path resolves to ${contract.betaStaticFeedUrl}.`
  );
} else {
  writeLine(
    "Electron publish dry-run: beta auto-update is intentionally manual because HUGECODE_ELECTRON_UPDATE_BASE_URL is not configured."
  );
}

writeLine(
  `Electron publish dry-run: packaged updater runtime present at ${runtimeResult.appAsarPath}.`
);
writeLine(
  `Electron publish dry-run: verified ${makeResult.files.length} release artifact(s) for ${process.platform}/${process.arch}.`
);
