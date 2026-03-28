import { describe, expect, it } from "vitest";
import { createPromptAssemblyService } from "../src/core/kernel/prompt-assembly-service.js";

describe("PromptAssemblyService", () => {
  it("assembles base prompt, agents context, skills, and extension prompt fragments", () => {
    const service = createPromptAssemblyService();
    service.setExtensionPromptFragments([
      "Use project tools first.",
      "Use project tools first.",
      "",
    ]);

    const prompt = service.buildSystemPrompt({
      basePrompt: "You are a coding agent.",
      agentsFiles: [
        { path: "/tmp/AGENTS.md", content: "Repo policy" },
        { path: "/tmp/CLAUDE.md", content: "Project details" },
      ],
      skills: [
        {
          name: "browser-tools",
          description: "Inspect pages",
          content: "Use browser tools carefully.",
          filePath: "/tmp/skills/browser-tools/SKILL.md",
        },
      ],
    });

    expect(prompt).toContain("You are a coding agent.");
    expect(prompt).toContain("AGENTS Context");
    expect(prompt).toContain("/tmp/AGENTS.md");
    expect(prompt).toContain("Repo policy");
    expect(prompt).toContain("Skills");
    expect(prompt).toContain("browser-tools");
    expect(prompt.match(/Use project tools first\./g)).toHaveLength(1);
  });
});
