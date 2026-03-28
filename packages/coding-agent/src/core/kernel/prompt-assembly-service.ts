import type {
  PromptAssemblyInput,
  PromptAssemblyService,
  PromptTemplateResource,
} from "./contracts.js";

class DefaultPromptAssemblyService implements PromptAssemblyService {
  private extensionPromptFragments: string[] = [];
  private discoveredPromptTemplates: PromptTemplateResource[] = [];

  setDiscoveredPromptTemplates(promptTemplates: PromptTemplateResource[]): void {
    this.discoveredPromptTemplates = promptTemplates;
  }

  setExtensionPromptFragments(fragments: string[]): void {
    this.extensionPromptFragments = fragments;
  }

  buildSystemPrompt(input: PromptAssemblyInput): string {
    const sections: string[] = [input.basePrompt.trim()];

    if (input.agentsFiles.length > 0) {
      sections.push(
        [
          "AGENTS Context",
          ...input.agentsFiles.map((file) => `- ${file.path}\n${file.content.trim()}`),
        ].join("\n")
      );
    }

    if (input.skills.length > 0) {
      sections.push(
        [
          "Skills",
          ...input.skills.map(
            (skill) => `- ${skill.name}: ${skill.description}\n${skill.content.trim()}`
          ),
        ].join("\n")
      );
    }

    const promptTemplates = input.promptTemplates ?? this.discoveredPromptTemplates;
    if (promptTemplates.length > 0) {
      sections.push(
        [
          "Prompt Templates",
          ...promptTemplates.map(
            (template) =>
              `- ${template.name}${template.description ? `: ${template.description}` : ""}`
          ),
        ].join("\n")
      );
    }

    const uniqueFragments = [
      ...new Set(this.extensionPromptFragments.map((item) => item.trim()).filter(Boolean)),
    ];
    if (uniqueFragments.length > 0) {
      sections.push(
        ["Extension Prompt Fragments", ...uniqueFragments.map((fragment) => `- ${fragment}`)].join(
          "\n"
        )
      );
    }

    return sections.filter(Boolean).join("\n\n");
  }
}

export function createPromptAssemblyService(): PromptAssemblyService {
  return new DefaultPromptAssemblyService();
}
