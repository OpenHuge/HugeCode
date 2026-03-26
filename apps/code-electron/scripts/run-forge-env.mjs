import { delimiter } from "node:path";

export function sanitizeSpawnEnv(env) {
  return Object.fromEntries(
    Object.entries(env).filter(
      ([key, value]) =>
        !key.startsWith("=") &&
        !key.includes("\u0000") &&
        typeof value === "string" &&
        !value.includes("\u0000")
    )
  );
}

export function withNodeBinPath(env, { nodeBinDir, pathDelimiter = delimiter }) {
  const sanitizedEnv = sanitizeSpawnEnv(env);
  const pathKey = Object.keys(sanitizedEnv).find((key) => key.toLowerCase() === "path") ?? "PATH";
  const currentPath = sanitizedEnv[pathKey];

  return {
    ...sanitizedEnv,
    [pathKey]: currentPath ? `${nodeBinDir}${pathDelimiter}${currentPath}` : nodeBinDir,
  };
}

export function withForgeTempDir(env, { forgeTempRoot }) {
  return {
    ...sanitizeSpawnEnv(env),
    TMPDIR: forgeTempRoot,
    TMP: forgeTempRoot,
    TEMP: forgeTempRoot,
  };
}

export function createForgeSpawnEnv({
  env,
  nodeBinDir,
  forgeTempRoot,
  pathDelimiter,
  overrides = {},
}) {
  return {
    ...withForgeTempDir(withNodeBinPath(env, { nodeBinDir, pathDelimiter }), {
      forgeTempRoot,
    }),
    ...sanitizeSpawnEnv(overrides),
  };
}
