import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { DefaultResourceLoader } from "../src/core/resource-loader.js";

describe("DefaultResourceLoader", () => {
  let tempDir: string;
  let agentDir: string;
  let cwd: string;

  beforeEach(() => {
    tempDir = join(
      tmpdir(),
      `coding-agent-loader-${Date.now()}-${Math.random().toString(36).slice(2)}`
    );
    agentDir = join(tempDir, "agent");
    cwd = join(tempDir, "workspace", "project");
    mkdirSync(agentDir, { recursive: true });
    mkdirSync(cwd, { recursive: true });
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  it("discovers skills, prompts, themes, and extensions with project precedence", async () => {
    const userPromptDir = join(agentDir, "prompts");
    const projectPromptDir = join(cwd, ".pi", "prompts");
    const userSkillDir = join(agentDir, "skills", "collision-skill");
    const projectSkillDir = join(cwd, ".pi", "skills", "collision-skill");
    const userThemeDir = join(agentDir, "themes");
    const projectThemeDir = join(cwd, ".pi", "themes");
    const userExtDir = join(agentDir, "extensions");
    const projectExtDir = join(cwd, ".pi", "extensions");

    mkdirSync(userPromptDir, { recursive: true });
    mkdirSync(projectPromptDir, { recursive: true });
    mkdirSync(userSkillDir, { recursive: true });
    mkdirSync(projectSkillDir, { recursive: true });
    mkdirSync(userThemeDir, { recursive: true });
    mkdirSync(projectThemeDir, { recursive: true });
    mkdirSync(userExtDir, { recursive: true });
    mkdirSync(projectExtDir, { recursive: true });

    writeFileSync(join(userPromptDir, "commit.md"), "---\ndescription: user\n---\nUser prompt");
    writeFileSync(
      join(projectPromptDir, "commit.md"),
      "---\ndescription: project\n---\nProject prompt"
    );

    writeFileSync(
      join(userSkillDir, "SKILL.md"),
      "---\nname: collision-skill\ndescription: user\n---\nUser skill"
    );
    writeFileSync(
      join(projectSkillDir, "SKILL.md"),
      "---\nname: collision-skill\ndescription: project\n---\nProject skill"
    );

    writeFileSync(
      join(userThemeDir, "collision.json"),
      JSON.stringify({ name: "collision-theme", accent: "#111111" })
    );
    writeFileSync(
      join(projectThemeDir, "collision.json"),
      JSON.stringify({ name: "collision-theme", accent: "#ff00ff" })
    );

    writeFileSync(
      join(userExtDir, "user.mjs"),
      "export default function(api) { api.registerCommand('user-only', { description: 'user' }); }"
    );
    writeFileSync(
      join(projectExtDir, "project.mjs"),
      "export default function(api) { api.registerCommand('project-only', { description: 'project' }); }"
    );

    const loader = new DefaultResourceLoader({ cwd, agentDir });
    const discovery = await loader.discover();

    expect(discovery.prompts.map((item) => item.name)).toContain("commit");
    expect(discovery.prompts.find((item) => item.name === "commit")?.filePath).toBe(
      join(projectPromptDir, "commit.md")
    );
    expect(discovery.skills.find((item) => item.name === "collision-skill")?.filePath).toBe(
      join(projectSkillDir, "SKILL.md")
    );
    expect(discovery.themes.find((item) => item.name === "collision-theme")?.filePath).toBe(
      join(projectThemeDir, "collision.json")
    );
    expect(discovery.extensions.map((item) => item.name).sort()).toEqual(["project", "user"]);
    expect(discovery.diagnostics.some((item) => item.code === "resource-collision")).toBe(true);
  });

  it("discovers AGENTS context from global and project ancestors", async () => {
    const workspaceRoot = join(tempDir, "workspace");
    mkdirSync(workspaceRoot, { recursive: true });

    writeFileSync(join(agentDir, "AGENTS.md"), "global agents");
    writeFileSync(join(workspaceRoot, "AGENTS.md"), "workspace agents");
    writeFileSync(join(cwd, "CLAUDE.md"), "project claude");

    const loader = new DefaultResourceLoader({ cwd, agentDir });
    const discovery = await loader.discover();

    expect(discovery.agentsFiles.map((item) => item.content)).toEqual([
      "global agents",
      "workspace agents",
      "project claude",
    ]);
  });
});
