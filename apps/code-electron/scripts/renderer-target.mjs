const FRONTEND_PACKAGES = {
  classic: {
    packageDir: "../code",
    outputDir: "../code/dist",
  },
  t3: {
    packageDir: "../code-t3",
    outputDir: "../code-t3/dist",
  },
};

export function resolveRendererTarget(env = process.env) {
  const requested = env.HUGECODE_FRONTEND?.trim().toLowerCase();
  return requested === "t3" ? FRONTEND_PACKAGES.t3 : FRONTEND_PACKAGES.classic;
}
