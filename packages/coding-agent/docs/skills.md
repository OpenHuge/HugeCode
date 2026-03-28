# Skills

Track 2 keeps skill discovery compatible while moving prompt assembly out of session orchestration.

Current internal mapping:

- `DefaultResourceLoader` discovers skills and `AGENTS` context files.
- `PromptAssemblyService` turns discovered skills, context files, prompt templates, and extension prompt fragments into the final system prompt payload.

Compatibility intent:

- skill directory layout remains unchanged
- `SKILL.md` remains the canonical entry file for directory-based skills
- project-scoped resources override user-scoped resources, with diagnostics retained for collisions
