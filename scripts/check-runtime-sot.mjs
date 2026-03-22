#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import process from "node:process";

const repoRoot = process.cwd();

const HOST_CONTRACT_PATH = "packages/code-runtime-host-contract/src/codeRuntimeRpc.ts";
const HOST_CONTRACT_COMPAT_PATH = "packages/code-runtime-host-contract/src/codeRuntimeRpcCompat.ts";
const HOST_CONTRACT_EVENTS_PATH = "packages/code-runtime-host-contract/src/index.ts";
const SERVICE_LIB_PATH = "packages/code-runtime-service-rs/src/lib.rs";
const SERVICE_CAPABILITIES_PATH = "packages/code-runtime-service-rs/src/rpc/capabilities.rs";
const SERVICE_DISPATCH_PATHS = [
  "packages/code-runtime-service-rs/src/rpc/dispatch/mod.rs",
  "packages/code-runtime-service-rs/src/rpc_dispatch.rs",
];
const SERVICE_RUNTIME_EVENTS_PATH = "packages/code-runtime-service-rs/src/runtime_events.rs";
const TAURI_RPC_PATH = "apps/code-tauri/src-tauri/src/commands/rpc.rs";
const TAURI_LIB_PATH = "apps/code-tauri/src-tauri/src/lib.rs";
const TAURI_POLICY_PATH = "apps/code-tauri/src-tauri/src/commands/policy.rs";

const HOST_SPEC_VERSION = (() => {
  const hostContractAbsolutePath = path.join(repoRoot, HOST_CONTRACT_PATH);
  const hostContractSource = fs.readFileSync(hostContractAbsolutePath, "utf8");
  const versionMatch = hostContractSource.match(
    /CODE_RUNTIME_RPC_CONTRACT_VERSION\s*=\s*"([^"]+)"/u
  );
  if (!versionMatch?.[1]) {
    throw new Error(`failed to resolve runtime contract version from ${HOST_CONTRACT_PATH}`);
  }
  return versionMatch[1];
})();

const HOST_SPEC_PATH = `docs/runtime/spec/code-runtime-rpc-spec.${HOST_SPEC_VERSION}.json`;
const TAURI_SPEC_PATH = `docs/runtime/spec/code-runtime-rpc-spec.tauri.${HOST_SPEC_VERSION}.json`;
const TAURI_GAP_ALLOWLIST_PATH = `docs/runtime/spec/code-runtime-rpc-tauri-gap-allowlist.${HOST_SPEC_VERSION}.json`;

function readText(repoRelativePath) {
  const absolutePath = path.join(repoRoot, repoRelativePath);
  try {
    return fs.readFileSync(absolutePath, "utf8");
  } catch (error) {
    throw new Error(`failed to read ${repoRelativePath}: ${String(error)}`);
  }
}

function findExistingPath(repoRelativePaths, label) {
  for (const repoRelativePath of repoRelativePaths) {
    const absolutePath = path.join(repoRoot, repoRelativePath);
    if (fs.existsSync(absolutePath)) {
      return repoRelativePath;
    }
  }
  throw new Error(`failed to resolve ${label} from candidates: ${repoRelativePaths.join(", ")}`);
}

function readJson(repoRelativePath) {
  const absolutePath = path.join(repoRoot, repoRelativePath);
  try {
    return JSON.parse(fs.readFileSync(absolutePath, "utf8"));
  } catch (error) {
    throw new Error(`failed to parse JSON ${repoRelativePath}: ${String(error)}`);
  }
}

function collectRepoRelativePaths(rootRepoRelativePath, includeFile) {
  const absoluteRootPath = path.join(repoRoot, rootRepoRelativePath);
  const collected = [];

  function walk(currentAbsolutePath) {
    const entries = fs.readdirSync(currentAbsolutePath, { withFileTypes: true });
    for (const entry of entries) {
      const nextAbsolutePath = path.join(currentAbsolutePath, entry.name);
      if (entry.isDirectory()) {
        walk(nextAbsolutePath);
        continue;
      }
      const repoRelativePath = path.relative(repoRoot, nextAbsolutePath).replaceAll("\\", "/");
      if (includeFile(repoRelativePath, entry.name)) {
        collected.push(repoRelativePath);
      }
    }
  }

  walk(absoluteRootPath);
  return collected.sort((left, right) => left.localeCompare(right));
}

function sectionBetween(content, startMarker, endMarker, label) {
  const startIndex = content.indexOf(startMarker);
  if (startIndex < 0) {
    throw new Error(`missing section start for ${label}`);
  }
  const endIndex = content.indexOf(endMarker, startIndex + startMarker.length);
  if (endIndex < 0) {
    throw new Error(`missing section end for ${label}`);
  }
  return content.slice(startIndex + startMarker.length, endIndex);
}

function extractQuotedStrings(section) {
  return [...new Set([...section.matchAll(/"([^"]+)"/gu)].map((match) => match[1]))].sort((a, b) =>
    a.localeCompare(b)
  );
}

function extractMethodStrings(section) {
  return [...new Set([...section.matchAll(/"(code_[a-z0-9_]+)"/gu)].map((match) => match[1]))].sort(
    (a, b) => a.localeCompare(b)
  );
}

function extractObjectStringMap(section) {
  const entries = [...section.matchAll(/([A-Za-z0-9_]+)\s*:\s*"([^"]+)"/gu)].map((match) => [
    match[1],
    match[2],
  ]);
  return Object.fromEntries(entries.sort(([left], [right]) => left.localeCompare(right)));
}

function extractTupleStringMap(section) {
  const normalizedSection = section.replace(/\s+/gu, " ");
  const entries = [...normalizedSection.matchAll(/\(\s*"([^"]+)",\s*"([^"]+)"\s*,?\s*\)/gu)].map(
    (match) => [match[1], match[2]]
  );
  return Object.fromEntries(entries.sort(([left], [right]) => left.localeCompare(right)));
}

function extractConstString(content, pattern, label) {
  const match = content.match(pattern);
  if (!match?.[1]) {
    throw new Error(`missing constant for ${label}`);
  }
  return match[1];
}

function extractReadonlyStringArray(content, constantName, sourceLabel) {
  const pattern = new RegExp(
    `export\\s+const\\s+${constantName}\\s*=\\s*\\[(?<values>[\\s\\S]*?)\\]\\s*as\\s*const;`,
    "u"
  );
  const match = content.match(pattern);
  const valuesSection = match?.groups?.values ?? "";
  if (!valuesSection.trim()) {
    throw new Error(`missing readonly string array ${constantName} in ${sourceLabel}`);
  }
  return extractQuotedStrings(valuesSection);
}

function parseHostContract() {
  const content = readText(HOST_CONTRACT_PATH);
  const compatContent = readText(HOST_CONTRACT_COMPAT_PATH);
  const methodSection = sectionBetween(
    content,
    "export const CODE_RUNTIME_RPC_METHODS = {",
    "} as const;",
    "host methods"
  );
  const featureSection = sectionBetween(
    content,
    "export const CODE_RUNTIME_RPC_FEATURES = Object.freeze([",
    "]) as readonly string[];",
    "host features"
  );
  const capabilityProfileSection = sectionBetween(
    content,
    "export const CODE_RUNTIME_RPC_CAPABILITY_PROFILES = Object.freeze({",
    "} as const);",
    "host capability profiles"
  );
  const errorCodeSection = sectionBetween(
    content,
    "export const CODE_RUNTIME_RPC_ERROR_CODES = {",
    "} as const;",
    "host error codes"
  );
  const compatAliasSection = sectionBetween(
    compatContent,
    "const CODE_RUNTIME_RPC_COMPAT_FIELD_REGISTRY_DEFINITION = defineCodeRuntimeRpcCompatFieldRegistry({",
    "} as const);",
    "host compat registry"
  );
  const methodLegacyAliasSection = sectionBetween(
    compatContent,
    "export const CODE_RUNTIME_RPC_METHOD_LEGACY_ALIASES = Object.freeze({",
    "});",
    "host method legacy aliases"
  );

  const methods = [
    ...new Set([...methodSection.matchAll(/:\s*"(code_[a-z0-9_]+)"/gu)].map((match) => match[1])),
  ].sort((a, b) => a.localeCompare(b));

  return {
    contractVersion: extractConstString(
      content,
      /CODE_RUNTIME_RPC_CONTRACT_VERSION\s*=\s*"([^"]+)"/u,
      "host contract version"
    ),
    freezeEffectiveAt: extractConstString(
      content,
      /CODE_RUNTIME_RPC_FREEZE_EFFECTIVE_AT\s*=\s*"([^"]+)"/u,
      "host freeze effective at"
    ),
    methods,
    methodLegacyAliases: extractQuotedStrings(methodLegacyAliasSection).filter(
      (method) => !method.startsWith("code_")
    ),
    features: extractQuotedStrings(featureSection),
    capabilityProfiles: extractObjectStringMap(capabilityProfileSection),
    errorCodes: extractObjectStringMap(errorCodeSection),
    compatAliases: extractObjectStringMap(compatAliasSection),
  };
}

function parseHostEventKinds() {
  const content = readText(HOST_CONTRACT_EVENTS_PATH);
  return extractReadonlyStringArray(
    content,
    "CODE_RUNTIME_HOST_EVENT_KINDS",
    HOST_CONTRACT_EVENTS_PATH
  );
}

function parseServiceContract() {
  const content = readText(SERVICE_LIB_PATH);
  const featureSection = sectionBetween(
    content,
    "const CODE_RUNTIME_RPC_FEATURES: &[&str] = &[",
    "];",
    "service features"
  );
  const errorCodeSection = sectionBetween(
    content,
    "const CODE_RUNTIME_RPC_ERROR_CODES: &[(&str, &str)] = &[",
    "];",
    "service error codes"
  );
  const capabilitiesContent = readText(SERVICE_CAPABILITIES_PATH);

  return {
    contractVersion: extractConstString(
      content,
      /CODE_RUNTIME_RPC_CONTRACT_VERSION:\s*&str\s*=\s*"([^"]+)"/u,
      "service contract version"
    ),
    freezeEffectiveAt: extractConstString(
      content,
      /CODE_RUNTIME_RPC_FREEZE_EFFECTIVE_AT:\s*&str\s*=\s*"([^"]+)"/u,
      "service freeze effective at"
    ),
    capabilityProfile: extractConstString(
      capabilitiesContent,
      /RPC_CAPABILITY_PROFILE_FULL_RUNTIME:\s*&str\s*=\s*"([^"]+)"/u,
      "service capability profile"
    ),
    features: extractQuotedStrings(featureSection),
    errorCodes: extractTupleStringMap(errorCodeSection),
  };
}

function parseServiceMethods() {
  const capabilitiesContent = readText(SERVICE_CAPABILITIES_PATH);
  const registryMethods = [
    ...new Set(
      [...capabilitiesContent.matchAll(/RpcMethodEntry::new\("(code_[a-z0-9_]+)"\)/gu)].map(
        (match) => match[1]
      )
    ),
  ].sort((a, b) => a.localeCompare(b));

  const dispatchEntryPath = findExistingPath(
    SERVICE_DISPATCH_PATHS,
    "service dispatch entry"
  ).replaceAll("\\", "/");
  const dispatchMethodFiles = collectRepoRelativePaths(
    "packages/code-runtime-service-rs/src",
    (repoRelativePath, fileName) =>
      fileName.endsWith(".rs") &&
      !fileName.includes("_tests") &&
      (repoRelativePath === dispatchEntryPath ||
        fileName.startsWith("rpc_dispatch") ||
        /\/rpc_dispatch[^/]*\.rs$/u.test(repoRelativePath) ||
        repoRelativePath.includes("/rpc/dispatch/") ||
        repoRelativePath.endsWith("/workspace_prompt.rs"))
  );
  const dispatchMethods = [
    ...new Set(
      dispatchMethodFiles.flatMap((repoRelativePath) =>
        extractMethodStrings(readText(repoRelativePath))
      )
    ),
  ].sort((a, b) => a.localeCompare(b));

  return {
    registryMethods,
    dispatchMethods,
  };
}

function parseServiceRuntimeEventKinds() {
  const content = readText(SERVICE_RUNTIME_EVENTS_PATH);
  const eventAssignments = [
    ...content.matchAll(
      /\b(?:pub\(crate\)\s+)?const\s+(TURN_EVENT_[A-Z0-9_]+|RUNTIME_EVENT_UPDATED|NATIVE_STATE_FABRIC_UPDATED_EVENT)\s*:\s*&str\s*=\s*([^;]+);/gu
    ),
  ];

  if (eventAssignments.length === 0) {
    throw new Error(`failed to find runtime event constants in ${SERVICE_RUNTIME_EVENTS_PATH}`);
  }

  const resolvedEventValueByConstant = new Map();
  const eventValueByConstant = new Map(
    eventAssignments.map((match) => [match[1], String(match[2]).trim()])
  );

  function resolveRuntimeEventValue(constantName, trace = []) {
    if (resolvedEventValueByConstant.has(constantName)) {
      return resolvedEventValueByConstant.get(constantName);
    }

    if (trace.includes(constantName)) {
      throw new Error(
        `runtime event alias cycle detected in ${SERVICE_RUNTIME_EVENTS_PATH}: ${[...trace, constantName].join(" -> ")}`
      );
    }

    const rawValue = eventValueByConstant.get(constantName);
    if (!rawValue) {
      throw new Error(
        `runtime event alias "${constantName}" references unknown constant in ${SERVICE_RUNTIME_EVENTS_PATH}`
      );
    }

    const literalMatch = rawValue.match(/^"([^"]+)"$/u);
    if (literalMatch?.[1]) {
      resolvedEventValueByConstant.set(constantName, literalMatch[1]);
      return literalMatch[1];
    }

    const aliasMatch = rawValue.match(/^([A-Z0-9_]+)$/u);
    if (!aliasMatch?.[1]) {
      throw new Error(
        `unsupported runtime event constant expression "${rawValue}" for ${constantName} in ${SERVICE_RUNTIME_EVENTS_PATH}`
      );
    }

    const resolved = resolveRuntimeEventValue(aliasMatch[1], [...trace, constantName]);
    resolvedEventValueByConstant.set(constantName, resolved);
    return resolved;
  }

  return [
    ...new Set(
      [...eventValueByConstant.keys()].map((constantName) => resolveRuntimeEventValue(constantName))
    ),
  ].sort((a, b) => a.localeCompare(b));
}

function parseTauriContract() {
  const content = readText(TAURI_RPC_PATH);
  const featureSection = sectionBetween(
    content,
    "const CODE_RUNTIME_RPC_FEATURES: &[&str] = &[",
    "];",
    "tauri features"
  );
  const errorCodeSection = sectionBetween(
    content,
    "const CODE_RUNTIME_RPC_ERROR_CODES: &[(&str, &str)] = &[",
    "];",
    "tauri error codes"
  );
  const features = extractQuotedStrings(featureSection);
  const frozenFeature = extractConstString(
    content,
    /CODE_RUNTIME_RPC_FROZEN_FEATURE:\s*&str\s*=\s*"([^"]+)"/u,
    "tauri frozen feature"
  );
  if (featureSection.includes("CODE_RUNTIME_RPC_FROZEN_FEATURE")) {
    features.push(frozenFeature);
  }

  return {
    contractVersion: extractConstString(
      content,
      /CODE_RUNTIME_RPC_CONTRACT_VERSION:\s*&str\s*=\s*"([^"]+)"/u,
      "tauri contract version"
    ),
    freezeEffectiveAt: extractConstString(
      content,
      /CODE_RUNTIME_RPC_FREEZE_EFFECTIVE_AT:\s*&str\s*=\s*"([^"]+)"/u,
      "tauri freeze effective at"
    ),
    capabilityProfile: extractConstString(
      content,
      /CODE_RUNTIME_RPC_CAPABILITY_PROFILE:\s*&str\s*=\s*"([^"]+)"/u,
      "tauri capability profile"
    ),
    features: [...new Set(features)].sort((a, b) => a.localeCompare(b)),
    errorCodes: extractTupleStringMap(errorCodeSection),
  };
}

function parseTauriMethods() {
  const content = readText(TAURI_LIB_PATH);
  const macroSection = sectionBetween(
    content,
    "macro_rules! code_tauri_command_entries {",
    "macro_rules! command_handler_from_entries",
    "tauri command entries"
  );
  const registeredMethods = extractMethodStrings(macroSection);
  const policyContent = readText(TAURI_POLICY_PATH);
  const gatedSection = sectionBetween(
    policyContent,
    "pub(crate) fn rpc_method_enabled(method: &str) -> bool {",
    "_ => true,",
    "tauri rpc policy gates"
  );
  const gatedMethods = new Set(extractMethodStrings(gatedSection));
  return registeredMethods.filter((method) => !gatedMethods.has(method));
}

function normalizeMethodList(input) {
  if (!Array.isArray(input)) {
    return [];
  }
  return [...new Set(input.map((entry) => String(entry).trim()).filter(Boolean))].sort((a, b) =>
    a.localeCompare(b)
  );
}

function compareSets(expected, actual) {
  const expectedSet = new Set(expected);
  const actualSet = new Set(actual);
  return {
    missing: expected.filter((entry) => !actualSet.has(entry)),
    extra: actual.filter((entry) => !expectedSet.has(entry)),
  };
}

function compareRecordMaps(expected, actual) {
  const expectedEntries = Object.entries(expected).sort(([left], [right]) =>
    left.localeCompare(right)
  );
  const actualEntries = Object.entries(actual).sort(([left], [right]) => left.localeCompare(right));

  const missingKeys = expectedEntries
    .filter(([key]) => !(key in actual))
    .map(([key]) => key)
    .sort((a, b) => a.localeCompare(b));
  const extraKeys = actualEntries
    .filter(([key]) => !(key in expected))
    .map(([key]) => key)
    .sort((a, b) => a.localeCompare(b));

  const mismatchedValues = expectedEntries
    .filter(([key, value]) => key in actual && String(actual[key]) !== String(value))
    .map(([key, value]) => ({
      key,
      expected: String(value),
      actual: String(actual[key]),
    }));

  return {
    missingKeys,
    extraKeys,
    mismatchedValues,
    isEqual: missingKeys.length === 0 && extraKeys.length === 0 && mismatchedValues.length === 0,
  };
}

function computeMethodSetHash(methods) {
  const normalized = normalizeMethodList(methods);
  const FNV_OFFSET_BASIS = 0xcbf29ce484222325n;
  const FNV_PRIME = 0x100000001b3n;
  const MASK_64 = 0xffffffffffffffffn;

  let hash = FNV_OFFSET_BASIS;
  for (const method of normalized) {
    const bytes = new TextEncoder().encode(method);
    for (const byte of bytes) {
      hash ^= BigInt(byte);
      hash = (hash * FNV_PRIME) & MASK_64;
    }
    hash ^= 0xffn;
    hash = (hash * FNV_PRIME) & MASK_64;
  }

  return hash.toString(16).padStart(16, "0");
}

function formatList(values) {
  return values.map((value) => `- ${value}`).join("\n");
}
function main() {
  const host = parseHostContract();
  const hostEventKinds = parseHostEventKinds();
  const hostSpecExpectedMethods = normalizeMethodList(host.methods);
  const service = parseServiceContract();
  const { registryMethods, dispatchMethods } = parseServiceMethods();
  const serviceRuntimeEventKinds = parseServiceRuntimeEventKinds();
  const tauri = parseTauriContract();
  const tauriMethods = parseTauriMethods();

  const hostSpec = readJson(HOST_SPEC_PATH);
  const tauriSpec = readJson(TAURI_SPEC_PATH);
  const tauriGapAllowlist = readJson(TAURI_GAP_ALLOWLIST_PATH);

  const errors = [];
  const notices = [];

  if (service.contractVersion !== host.contractVersion) {
    errors.push(
      `service contractVersion mismatch: host=${host.contractVersion}, service=${service.contractVersion}`
    );
  }
  if (tauri.contractVersion !== host.contractVersion) {
    errors.push(
      `tauri contractVersion mismatch: host=${host.contractVersion}, tauri=${tauri.contractVersion}`
    );
  }
  if (service.freezeEffectiveAt !== host.freezeEffectiveAt) {
    errors.push(
      `service freezeEffectiveAt mismatch: host=${host.freezeEffectiveAt}, service=${service.freezeEffectiveAt}`
    );
  }
  if (tauri.freezeEffectiveAt !== host.freezeEffectiveAt) {
    errors.push(
      `tauri freezeEffectiveAt mismatch: host=${host.freezeEffectiveAt}, tauri=${tauri.freezeEffectiveAt}`
    );
  }
  const expectedFullRuntimeProfile = host.capabilityProfiles.FULL_RUNTIME;
  const expectedDesktopCoreProfile = host.capabilityProfiles.DESKTOP_CORE;
  if (!expectedFullRuntimeProfile || !expectedDesktopCoreProfile) {
    errors.push("host capability profiles are missing FULL_RUNTIME and/or DESKTOP_CORE");
  } else {
    if (service.capabilityProfile !== expectedFullRuntimeProfile) {
      errors.push(
        `service capability profile mismatch: host=${expectedFullRuntimeProfile}, service=${service.capabilityProfile}`
      );
    }
    if (tauri.capabilityProfile !== expectedDesktopCoreProfile) {
      errors.push(
        `tauri capability profile mismatch: host=${expectedDesktopCoreProfile}, tauri=${tauri.capabilityProfile}`
      );
    }
  }

  const hostVsServiceMethods = compareSets(host.methods, registryMethods);
  if (hostVsServiceMethods.missing.length > 0 || hostVsServiceMethods.extra.length > 0) {
    errors.push(
      [
        "host methods and service registry methods diverged",
        hostVsServiceMethods.missing.length > 0
          ? `missing in service registry:\n${formatList(hostVsServiceMethods.missing)}`
          : null,
        hostVsServiceMethods.extra.length > 0
          ? `unexpected in service registry:\n${formatList(hostVsServiceMethods.extra)}`
          : null,
      ]
        .filter(Boolean)
        .join("\n")
    );
  }

  const hostVsServiceRuntimeEventKinds = compareSets(hostEventKinds, serviceRuntimeEventKinds);
  if (
    hostVsServiceRuntimeEventKinds.missing.length > 0 ||
    hostVsServiceRuntimeEventKinds.extra.length > 0
  ) {
    errors.push(
      [
        "host runtime event kinds and service runtime event kinds diverged",
        hostVsServiceRuntimeEventKinds.missing.length > 0
          ? `missing in service runtime events:\n${formatList(hostVsServiceRuntimeEventKinds.missing)}`
          : null,
        hostVsServiceRuntimeEventKinds.extra.length > 0
          ? `unexpected in service runtime events:\n${formatList(hostVsServiceRuntimeEventKinds.extra)}`
          : null,
      ]
        .filter(Boolean)
        .join("\n")
    );
  }

  const registryVsDispatchMethods = compareSets(registryMethods, dispatchMethods);
  if (registryVsDispatchMethods.missing.length > 0 || registryVsDispatchMethods.extra.length > 0) {
    errors.push(
      [
        "service registry methods and rpc dispatch methods diverged",
        registryVsDispatchMethods.missing.length > 0
          ? `missing in dispatch:\n${formatList(registryVsDispatchMethods.missing)}`
          : null,
        registryVsDispatchMethods.extra.length > 0
          ? `unexpected in dispatch:\n${formatList(registryVsDispatchMethods.extra)}`
          : null,
      ]
        .filter(Boolean)
        .join("\n")
    );
  }

  const hostVsServiceFeatures = compareSets(host.features, service.features);
  if (hostVsServiceFeatures.missing.length > 0 || hostVsServiceFeatures.extra.length > 0) {
    errors.push(
      [
        "host features and service features diverged",
        hostVsServiceFeatures.missing.length > 0
          ? `missing in service:\n${formatList(hostVsServiceFeatures.missing)}`
          : null,
        hostVsServiceFeatures.extra.length > 0
          ? `unexpected in service:\n${formatList(hostVsServiceFeatures.extra)}`
          : null,
      ]
        .filter(Boolean)
        .join("\n")
    );
  }

  if (tauri.capabilityProfile === expectedDesktopCoreProfile) {
    const hostFeatureSet = new Set(host.features);
    const unexpectedDesktopCoreFeatures = tauri.features.filter(
      (feature) => !hostFeatureSet.has(feature)
    );
    if (unexpectedDesktopCoreFeatures.length > 0) {
      errors.push(
        `tauri desktop-core profile includes unknown features:\n${formatList(
          unexpectedDesktopCoreFeatures
        )}`
      );
    }

    const requiredDesktopCoreFeatures = [
      "method_not_found_error_code",
      "rpc_capabilities_handshake",
      `contract_frozen_${host.freezeEffectiveAt.replaceAll("-", "_")}`,
    ];
    const missingDesktopCoreFeatures = requiredDesktopCoreFeatures.filter(
      (feature) => !tauri.features.includes(feature)
    );
    if (missingDesktopCoreFeatures.length > 0) {
      errors.push(
        `tauri desktop-core profile is missing required baseline features:\n${formatList(
          missingDesktopCoreFeatures
        )}`
      );
    }
  } else {
    const hostVsTauriFeatures = compareSets(host.features, tauri.features);
    if (hostVsTauriFeatures.missing.length > 0 || hostVsTauriFeatures.extra.length > 0) {
      errors.push(
        [
          "host features and tauri features diverged",
          hostVsTauriFeatures.missing.length > 0
            ? `missing in tauri:\n${formatList(hostVsTauriFeatures.missing)}`
            : null,
          hostVsTauriFeatures.extra.length > 0
            ? `unexpected in tauri:\n${formatList(hostVsTauriFeatures.extra)}`
            : null,
        ]
          .filter(Boolean)
          .join("\n")
      );
    }
  }

  const hostVsServiceErrorCodes = compareRecordMaps(host.errorCodes, service.errorCodes);
  if (!hostVsServiceErrorCodes.isEqual) {
    errors.push(
      [
        "host error codes and service error codes diverged",
        hostVsServiceErrorCodes.missingKeys.length > 0
          ? `missing keys in service:\n${formatList(hostVsServiceErrorCodes.missingKeys)}`
          : null,
        hostVsServiceErrorCodes.extraKeys.length > 0
          ? `unexpected keys in service:\n${formatList(hostVsServiceErrorCodes.extraKeys)}`
          : null,
        hostVsServiceErrorCodes.mismatchedValues.length > 0
          ? `mismatched values:\n${hostVsServiceErrorCodes.mismatchedValues
              .map(
                ({ key, expected, actual }) => `- ${key}: expected=${expected}, actual=${actual}`
              )
              .join("\n")}`
          : null,
      ]
        .filter(Boolean)
        .join("\n")
    );
  }

  const hostVsTauriErrorCodes = compareRecordMaps(host.errorCodes, tauri.errorCodes);
  if (!hostVsTauriErrorCodes.isEqual) {
    errors.push(
      [
        "host error codes and tauri error codes diverged",
        hostVsTauriErrorCodes.missingKeys.length > 0
          ? `missing keys in tauri:\n${formatList(hostVsTauriErrorCodes.missingKeys)}`
          : null,
        hostVsTauriErrorCodes.extraKeys.length > 0
          ? `unexpected keys in tauri:\n${formatList(hostVsTauriErrorCodes.extraKeys)}`
          : null,
        hostVsTauriErrorCodes.mismatchedValues.length > 0
          ? `mismatched values:\n${hostVsTauriErrorCodes.mismatchedValues
              .map(
                ({ key, expected, actual }) => `- ${key}: expected=${expected}, actual=${actual}`
              )
              .join("\n")}`
          : null,
      ]
        .filter(Boolean)
        .join("\n")
    );
  }

  if (!hostSpec?.rpc || typeof hostSpec.rpc !== "object") {
    errors.push(`invalid host spec payload: ${HOST_SPEC_PATH}`);
  } else {
    const hostSpecMethods = normalizeMethodList(hostSpec.rpc.methods);
    const hostSpecMethodDiff = compareSets(hostSpecExpectedMethods, hostSpecMethods);
    if (hostSpecMethodDiff.missing.length > 0 || hostSpecMethodDiff.extra.length > 0) {
      errors.push(
        [
          "host spec methods diverged from host contract methods",
          hostSpecMethodDiff.missing.length > 0
            ? `missing in host spec:\n${formatList(hostSpecMethodDiff.missing)}`
            : null,
          hostSpecMethodDiff.extra.length > 0
            ? `unexpected in host spec:\n${formatList(hostSpecMethodDiff.extra)}`
            : null,
        ]
          .filter(Boolean)
          .join("\n")
      );
    }

    const hostSpecHash = String(hostSpec.rpc.methodSetHash ?? "").trim();
    const recomputedHostHash = computeMethodSetHash(hostSpecExpectedMethods);
    if (hostSpecHash !== recomputedHostHash) {
      errors.push(
        `host spec methodSetHash mismatch: spec=${hostSpecHash}, expected=${recomputedHostHash}`
      );
    }
  }

  if (!tauriSpec?.rpc || typeof tauriSpec.rpc !== "object") {
    errors.push(`invalid tauri spec payload: ${TAURI_SPEC_PATH}`);
  } else {
    const tauriSpecMethods = normalizeMethodList(tauriSpec.rpc.methods);
    const tauriSpecMethodDiff = compareSets(hostSpecExpectedMethods, tauriSpecMethods);
    if (tauriSpecMethodDiff.missing.length > 0 || tauriSpecMethodDiff.extra.length > 0) {
      errors.push(
        [
          "tauri frozen spec methods diverged from host contract methods",
          tauriSpecMethodDiff.missing.length > 0
            ? `missing in tauri spec:\n${formatList(tauriSpecMethodDiff.missing)}`
            : null,
          tauriSpecMethodDiff.extra.length > 0
            ? `unexpected in tauri spec:\n${formatList(tauriSpecMethodDiff.extra)}`
            : null,
        ]
          .filter(Boolean)
          .join("\n")
      );
    }

    const tauriSpecHash = String(tauriSpec.rpc.methodSetHash ?? "").trim();
    const recomputedTauriSpecHash = computeMethodSetHash(tauriSpecMethods);
    if (tauriSpecHash !== recomputedTauriSpecHash) {
      errors.push(
        `tauri spec methodSetHash mismatch: spec=${tauriSpecHash}, expected=${recomputedTauriSpecHash}`
      );
    }

    if (String(tauriSpec.rpc.contractVersion ?? "") !== host.contractVersion) {
      errors.push(
        `tauri spec contractVersion mismatch: spec=${tauriSpec.rpc.contractVersion}, host=${host.contractVersion}`
      );
    }
    if (String(tauriSpec.rpc.freezeEffectiveAt ?? "") !== host.freezeEffectiveAt) {
      errors.push(
        `tauri spec freezeEffectiveAt mismatch: spec=${tauriSpec.rpc.freezeEffectiveAt}, host=${host.freezeEffectiveAt}`
      );
    }
    if (String(tauriSpec.rpc.profile ?? "") !== tauri.capabilityProfile) {
      errors.push(
        `tauri spec profile mismatch: spec=${tauriSpec.rpc.profile}, tauri=${tauri.capabilityProfile}`
      );
    }
  }

  const hostToTauriMethodDiff = compareSets(host.methods, tauriMethods);
  if (hostToTauriMethodDiff.extra.length > 0) {
    errors.push(
      `tauri registered methods include non-canonical/unknown entries:\n${formatList(
        hostToTauriMethodDiff.extra
      )}`
    );
  }

  const strictTauriParity =
    process.env.RUNTIME_SOT_REQUIRE_TAURI_FULL === "1" ||
    process.env.RUNTIME_SOT_REQUIRE_TAURI_FULL === "true";

  const allowlistMissingMethods = normalizeMethodList(tauriGapAllowlist?.missingMethods);
  if (strictTauriParity) {
    if (hostToTauriMethodDiff.missing.length > 0) {
      errors.push(
        `tauri full parity is required (RUNTIME_SOT_REQUIRE_TAURI_FULL=1), missing methods:\n${formatList(
          hostToTauriMethodDiff.missing
        )}`
      );
    }
  } else {
    const unknownMissingMethods = hostToTauriMethodDiff.missing.filter(
      (method) => !allowlistMissingMethods.includes(method)
    );
    if (unknownMissingMethods.length > 0) {
      errors.push(
        `tauri missing method set grew beyond allowlist:\n${formatList(unknownMissingMethods)}`
      );
    }

    const obsoleteAllowlistEntries = allowlistMissingMethods.filter(
      (method) => !hostToTauriMethodDiff.missing.includes(method)
    );
    if (obsoleteAllowlistEntries.length > 0) {
      notices.push(
        `tauri gap allowlist contains resolved methods (shrink allowlist):\n${formatList(
          obsoleteAllowlistEntries
        )}`
      );
    }
  }

  const allowlistUnknownMethods = allowlistMissingMethods.filter(
    (method) => !host.methods.includes(method)
  );
  if (allowlistUnknownMethods.length > 0) {
    errors.push(
      `tauri gap allowlist includes unknown methods not present in host contract:\n${formatList(
        allowlistUnknownMethods
      )}`
    );
  }

  if (
    tauriGapAllowlist?.freezeEffectiveAt &&
    tauriGapAllowlist.freezeEffectiveAt !== host.freezeEffectiveAt
  ) {
    errors.push(
      `tauri gap allowlist freezeEffectiveAt mismatch: allowlist=${tauriGapAllowlist.freezeEffectiveAt}, host=${host.freezeEffectiveAt}`
    );
  }
  if (
    Number.isFinite(Number(tauriGapAllowlist?.hostMethodCount)) &&
    Number(tauriGapAllowlist.hostMethodCount) !== host.methods.length
  ) {
    errors.push(
      `tauri gap allowlist hostMethodCount mismatch: allowlist=${tauriGapAllowlist.hostMethodCount}, host=${host.methods.length}`
    );
  }

  if (notices.length > 0) {
    for (const notice of notices) {
      process.stderr.write(`[runtime-sot] notice: ${notice}\n`);
    }
  }

  if (errors.length > 0) {
    for (const error of errors) {
      process.stderr.write(`[runtime-sot] error: ${error}\n`);
    }
    process.exit(1);
  }

  if (strictTauriParity) {
  } else {
  }

  process.stdout.write("[runtime-sot] ok\n");
}

try {
  main();
} catch (error) {
  if (error instanceof Error && error.message.trim().length > 0) {
    process.stderr.write(`[runtime-sot] fatal: ${error.message}\n`);
  }
  process.exit(1);
}
