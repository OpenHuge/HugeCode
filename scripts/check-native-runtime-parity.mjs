#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";

const repoRoot = process.cwd();
const SERVICE_NATIVE_RUNTIME_PATH = "packages/code-runtime-service-rs/src/native_runtime.rs";
const SERVICE_CAPABILITIES_PATH = "packages/code-runtime-service-rs/src/rpc/capabilities.rs";
const NATIVE_CONTRACT_PATH = "packages/native-runtime-host-contract/src/nativeRuntimeRpc.ts";

function readFile(repoRelativePath) {
  const absolutePath = path.join(repoRoot, repoRelativePath);
  try {
    return fs.readFileSync(absolutePath, "utf8");
  } catch (error) {
    throw new Error(`Failed to read ${repoRelativePath}: ${String(error)}`);
  }
}

function extractQuotedEntries(source) {
  return [...source.matchAll(/"([^"]+)"/g)].map((match) => match[1]);
}

function extractRustStringArray(source, constName) {
  const pattern = new RegExp(
    `pub\\(crate\\)\\s+const\\s+${constName}:\\s*&\\[&str\\]\\s*=\\s*&\\[(?<body>[\\s\\S]*?)\\];`,
    "u"
  );
  const match = source.match(pattern);
  if (!match?.groups?.body) {
    throw new Error(`Unable to locate Rust string array constant: ${constName}`);
  }
  return extractQuotedEntries(match.groups.body);
}

function extractTsStringArray(source, constName) {
  const pattern = new RegExp(
    `(?:export\\s+)?const\\s+${constName}[\\s\\S]*?=\\s*\\[(?<body>[\\s\\S]*?)\\]\\s+as\\s+const`,
    "u"
  );
  const match = source.match(pattern);
  if (!match?.groups?.body) {
    throw new Error(`Unable to locate TS string array constant: ${constName}`);
  }
  return extractQuotedEntries(match.groups.body);
}

function extractServiceNativeCapabilityFeatures(source) {
  return [...source.matchAll(/features\.push\("([^"]+)"\.to_string\(\)\);/g)].map(
    (match) => match[1]
  );
}

function uniqueSorted(values) {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))].sort((a, b) =>
    a.localeCompare(b)
  );
}

function diffSets(left, right) {
  const rightSet = new Set(right);
  return left.filter((value) => !rightSet.has(value));
}

function compareSet(name, serviceValues, contractValues, violations) {
  const service = uniqueSorted(serviceValues);
  const contract = uniqueSorted(contractValues);
  const missingInContract = diffSets(service, contract);
  const extraInContract = diffSets(contract, service);
  if (missingInContract.length === 0 && extraInContract.length === 0) {
    return;
  }
  violations.push({
    name,
    missingInContract,
    extraInContract,
  });
}

function main() {
  const serviceNativeRuntime = readFile(SERVICE_NATIVE_RUNTIME_PATH);
  const serviceCapabilities = readFile(SERVICE_CAPABILITIES_PATH);
  const nativeContract = readFile(NATIVE_CONTRACT_PATH);

  const serviceNativeOnlyMethods = extractRustStringArray(
    serviceNativeRuntime,
    "NATIVE_ONLY_RPC_METHODS"
  );
  const serviceEventMethods = extractRustStringArray(
    serviceNativeRuntime,
    "NATIVE_RUNTIME_EVENT_METHODS"
  );
  const serviceNativeCapabilityFeatures =
    extractServiceNativeCapabilityFeatures(serviceCapabilities);

  const contractNativeOnlyMethods = extractTsStringArray(
    nativeContract,
    "NATIVE_RUNTIME_NATIVE_ONLY_METHOD_LIST"
  );
  const contractEventMethods = extractTsStringArray(nativeContract, "NATIVE_RUNTIME_EVENT_METHODS");
  const contractNativeCapabilityFeatures = extractTsStringArray(
    nativeContract,
    "NATIVE_RUNTIME_CAPABILITY_FEATURES"
  );

  const violations = [];
  compareSet(
    "native-only rpc methods",
    serviceNativeOnlyMethods,
    contractNativeOnlyMethods,
    violations
  );
  compareSet("native event methods", serviceEventMethods, contractEventMethods, violations);
  compareSet(
    "native capability feature flags",
    serviceNativeCapabilityFeatures,
    contractNativeCapabilityFeatures,
    violations
  );

  if (violations.length > 0) {
    for (const violation of violations) {
      if (violation.missingInContract.length > 0) {
      }
      if (violation.extraInContract.length > 0) {
      }
    }
    process.exit(1);
  }
}

main();
