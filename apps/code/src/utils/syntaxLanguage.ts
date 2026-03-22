const EXTENSION_TO_LANGUAGE: Record<string, string> = {
  bash: "bash",
  c: "c",
  cpp: "cpp",
  css: "css",
  go: "go",
  h: "c",
  hpp: "cpp",
  html: "markup",
  java: "java",
  js: "javascript",
  json: "json",
  jsx: "jsx",
  kt: "kotlin",
  md: "markdown",
  mjs: "javascript",
  rs: "rust",
  sass: "scss",
  scss: "scss",
  sh: "bash",
  swift: "swift",
  toml: "toml",
  ts: "typescript",
  tsx: "tsx",
  txt: "text",
  yaml: "yaml",
  yml: "yaml",
};

export function languageFromPath(path?: string | null) {
  if (!path) {
    return null;
  }
  const fileName = path.split("/").pop() ?? path;
  const dotIndex = fileName.lastIndexOf(".");
  if (dotIndex <= 0 || dotIndex === fileName.length - 1) {
    return null;
  }
  const ext = fileName.slice(dotIndex + 1).toLowerCase();
  return EXTENSION_TO_LANGUAGE[ext] ?? null;
}
