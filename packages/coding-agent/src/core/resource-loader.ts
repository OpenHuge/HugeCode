import { readFile, readdir, stat } from "node:fs/promises";
import { existsSync } from "node:fs";
import { basename, extname, join, resolve } from "node:path";
import type { ResourceDiagnostic } from "./diagnostics.js";
import type {
  AgentsContextFile,
  ExtensionResource,
  PromptTemplateResource,
  ResourceDiscoveryResult,
  SkillResource,
  ThemeDefinition,
} from "./kernel/contracts.js";
import { loadThemeFromPath } from "../modes/interactive/theme/theme.js";

const EXTENSION_FILE_EXTENSIONS = new Set([".js", ".mjs", ".cjs", ".ts", ".mts", ".cts"]);
const MARKDOWN_FILE_EXTENSIONS = new Set([".md", ".mdx"]);

export interface DefaultResourceLoaderOptions {
  cwd?: string;
  agentDir?: string;
  additionalExtensionPaths?: string[];
  additionalSkillPaths?: string[];
  additionalPromptTemplatePaths?: string[];
  additionalThemePaths?: string[];
  builtInThemePaths?: string[];
}

interface CandidateResource<TResource> {
  key: string;
  priority: number;
  resource: TResource;
}

interface FrontmatterDocument {
  attributes: Record<string, string>;
  body: string;
}

export class DefaultResourceLoader {
  private readonly cwd: string;
  private readonly agentDir: string;
  private readonly additionalExtensionPaths: string[];
  private readonly additionalSkillPaths: string[];
  private readonly additionalPromptTemplatePaths: string[];
  private readonly additionalThemePaths: string[];
  private readonly builtInThemePaths: string[];

  constructor(options: DefaultResourceLoaderOptions) {
    this.cwd = options.cwd ?? process.cwd();
    this.agentDir = options.agentDir ?? join(this.cwd, ".pi");
    this.additionalExtensionPaths = options.additionalExtensionPaths ?? [];
    this.additionalSkillPaths = options.additionalSkillPaths ?? [];
    this.additionalPromptTemplatePaths = options.additionalPromptTemplatePaths ?? [];
    this.additionalThemePaths = options.additionalThemePaths ?? [];
    this.builtInThemePaths = options.builtInThemePaths ?? [];
  }

  async discover(): Promise<ResourceDiscoveryResult> {
    const diagnostics: ResourceDiagnostic[] = [];

    const extensions = await this.discoverExtensions();
    const prompts = await this.discoverPrompts(diagnostics);
    const skills = await this.discoverSkills(diagnostics);
    const themes = await this.discoverThemes(diagnostics);
    const agentsFiles = await this.discoverAgentsContextFiles();

    return {
      extensions,
      prompts,
      skills,
      themes,
      agentsFiles,
      diagnostics,
    };
  }

  private async discoverExtensions(): Promise<ExtensionResource[]> {
    const paths = [
      ...this.additionalExtensionPaths.map((filePath) => ({ filePath, priority: 300 })),
      { filePath: join(this.cwd, ".pi", "extensions"), priority: 200 },
      { filePath: join(this.agentDir, "extensions"), priority: 100 },
    ];

    const discovered: ExtensionResource[] = [];
    for (const entry of paths) {
      const files = await this.collectFiles(entry.filePath, (filePath) =>
        EXTENSION_FILE_EXTENSIONS.has(extname(filePath))
      );
      for (const filePath of files) {
        discovered.push({
          name: basename(filePath, extname(filePath)),
          filePath,
        });
      }
    }

    return discovered;
  }

  private async discoverSkills(diagnostics: ResourceDiagnostic[]): Promise<SkillResource[]> {
    const candidates: CandidateResource<SkillResource>[] = [];

    const skillInputs = [
      ...this.additionalSkillPaths.map((filePath) => ({ filePath, priority: 300 })),
      { filePath: join(this.cwd, ".pi", "skills"), priority: 200 },
      { filePath: join(this.agentDir, "skills"), priority: 100 },
    ];

    for (const input of skillInputs) {
      for (const filePath of await this.collectSkillFiles(input.filePath)) {
        const parsed = await this.parseMarkdownResource(filePath);
        const name = parsed.attributes.name ?? this.deriveMarkdownName(filePath);
        const description = parsed.attributes.description ?? "";
        candidates.push({
          key: name,
          priority: input.priority,
          resource: {
            name,
            description,
            content: parsed.body,
            filePath,
          },
        });
      }
    }

    return this.resolveResourcePrecedence(candidates, "skill", diagnostics);
  }

  private async discoverPrompts(
    diagnostics: ResourceDiagnostic[]
  ): Promise<PromptTemplateResource[]> {
    const candidates: CandidateResource<PromptTemplateResource>[] = [];
    const promptInputs = [
      ...this.additionalPromptTemplatePaths.map((filePath) => ({ filePath, priority: 300 })),
      { filePath: join(this.cwd, ".pi", "prompts"), priority: 200 },
      { filePath: join(this.agentDir, "prompts"), priority: 100 },
    ];

    for (const input of promptInputs) {
      for (const filePath of await this.collectFiles(input.filePath, (candidate) =>
        MARKDOWN_FILE_EXTENSIONS.has(extname(candidate))
      )) {
        const parsed = await this.parseMarkdownResource(filePath);
        candidates.push({
          key: this.deriveMarkdownName(filePath),
          priority: input.priority,
          resource: {
            name: this.deriveMarkdownName(filePath),
            description: parsed.attributes.description,
            content: parsed.body,
            filePath,
          },
        });
      }
    }

    return this.resolveResourcePrecedence(candidates, "prompt", diagnostics);
  }

  private async discoverThemes(diagnostics: ResourceDiagnostic[]): Promise<ThemeDefinition[]> {
    const candidates: CandidateResource<ThemeDefinition>[] = [];
    const themeInputs = [
      ...this.additionalThemePaths.map((filePath) => ({ filePath, priority: 300 })),
      ...this.builtInThemePaths.map((filePath) => ({ filePath, priority: 0 })),
      { filePath: join(this.cwd, ".pi", "themes"), priority: 200 },
      { filePath: join(this.agentDir, "themes"), priority: 100 },
    ];

    for (const input of themeInputs) {
      for (const filePath of await this.collectFiles(
        input.filePath,
        (candidate) => extname(candidate) === ".json"
      )) {
        try {
          const theme = await loadThemeFromPath(filePath);
          candidates.push({
            key: theme.name,
            priority: input.priority,
            resource: theme,
          });
        } catch (error) {
          diagnostics.push({
            code: "resource-invalid",
            severity: "warning",
            kind: "theme",
            filePath,
            message:
              error instanceof Error ? error.message : `Failed to parse theme at ${filePath}`,
          });
        }
      }
    }

    return this.resolveResourcePrecedence(candidates, "theme", diagnostics);
  }

  private async discoverAgentsContextFiles(): Promise<AgentsContextFile[]> {
    const files: AgentsContextFile[] = [];
    const seen = new Set<string>();

    const globalContext = await this.loadContextFileFromDir(this.agentDir);
    if (globalContext) {
      files.push(globalContext);
      seen.add(globalContext.path);
    }

    const ancestorFiles: AgentsContextFile[] = [];
    let currentDir = resolve(this.cwd);
    const rootDir = resolve("/");
    while (true) {
      const contextFile = await this.loadContextFileFromDir(currentDir);
      if (contextFile && !seen.has(contextFile.path)) {
        ancestorFiles.unshift(contextFile);
        seen.add(contextFile.path);
      }

      if (currentDir === rootDir) break;
      const parentDir = resolve(currentDir, "..");
      if (parentDir === currentDir) break;
      currentDir = parentDir;
    }

    files.push(...ancestorFiles);
    return files;
  }

  private async loadContextFileFromDir(dir: string): Promise<AgentsContextFile | null> {
    for (const candidate of ["AGENTS.md", "CLAUDE.md"]) {
      const filePath = join(dir, candidate);
      if (!existsSync(filePath)) continue;
      return {
        path: filePath,
        content: await readFile(filePath, "utf8"),
      };
    }

    return null;
  }

  private async collectSkillFiles(inputPath: string): Promise<string[]> {
    if (!existsSync(inputPath)) {
      return [];
    }

    const entryStat = await stat(inputPath);
    if (entryStat.isFile()) {
      return MARKDOWN_FILE_EXTENSIONS.has(extname(inputPath)) ? [inputPath] : [];
    }

    const directEntries = await readdir(inputPath, { withFileTypes: true });
    const files: string[] = [];
    for (const entry of directEntries) {
      const childPath = join(inputPath, entry.name);
      if (entry.isFile() && MARKDOWN_FILE_EXTENSIONS.has(extname(entry.name))) {
        files.push(childPath);
      }
      if (entry.isDirectory()) {
        const skillFile = join(childPath, "SKILL.md");
        if (existsSync(skillFile)) {
          files.push(skillFile);
        }
      }
    }

    return files;
  }

  private async collectFiles(
    inputPath: string,
    predicate: (filePath: string) => boolean
  ): Promise<string[]> {
    if (!existsSync(inputPath)) {
      return [];
    }

    const entryStat = await stat(inputPath);
    if (entryStat.isFile()) {
      return predicate(inputPath) ? [inputPath] : [];
    }

    const files: string[] = [];
    const entries = await readdir(inputPath, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isFile()) continue;
      const filePath = join(inputPath, entry.name);
      if (predicate(filePath)) {
        files.push(filePath);
      }
    }

    return files;
  }

  private async parseMarkdownResource(filePath: string): Promise<FrontmatterDocument> {
    const content = await readFile(filePath, "utf8");
    if (!content.startsWith("---\n")) {
      return { attributes: {}, body: content.trim() };
    }

    const closingIndex = content.indexOf("\n---\n", 4);
    if (closingIndex === -1) {
      return { attributes: {}, body: content.trim() };
    }

    const header = content.slice(4, closingIndex);
    const body = content.slice(closingIndex + 5).trim();
    const attributes: Record<string, string> = {};
    for (const line of header.split("\n")) {
      const separatorIndex = line.indexOf(":");
      if (separatorIndex === -1) continue;
      const key = line.slice(0, separatorIndex).trim();
      const value = line.slice(separatorIndex + 1).trim();
      if (key.length > 0) {
        attributes[key] = value;
      }
    }

    return { attributes, body };
  }

  private deriveMarkdownName(filePath: string): string {
    const fileName = basename(filePath, extname(filePath));
    return fileName === "SKILL" ? basename(resolve(filePath, "..")) : fileName;
  }

  private resolveResourcePrecedence<TResource extends { filePath?: string }>(
    candidates: CandidateResource<TResource>[],
    kind: ResourceDiagnostic["kind"],
    diagnostics: ResourceDiagnostic[]
  ): TResource[] {
    const byKey = new Map<string, CandidateResource<TResource>>();

    for (const candidate of candidates) {
      const current = byKey.get(candidate.key);
      if (!current || candidate.priority > current.priority) {
        if (current) {
          diagnostics.push({
            code: "resource-collision",
            severity: "warning",
            kind,
            resourceName: candidate.key,
            filePath: current.resource.filePath,
            shadowedBy: candidate.resource.filePath,
            message: `${kind} "${candidate.key}" was overridden by a higher-priority resource`,
          });
        }
        byKey.set(candidate.key, candidate);
        continue;
      }

      diagnostics.push({
        code: "resource-collision",
        severity: "warning",
        kind,
        resourceName: candidate.key,
        filePath: candidate.resource.filePath,
        shadowedBy: current.resource.filePath,
        message: `${kind} "${candidate.key}" was ignored because a higher-priority resource already exists`,
      });
    }

    return [...byKey.values()].map((candidate) => candidate.resource);
  }
}
