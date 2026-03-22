fn build_live_skill_aliases(skill_id: &str) -> Vec<String> {
    live_skill_aliases(skill_id)
        .iter()
        .map(|alias| (*alias).to_string())
        .collect()
}

pub fn list_live_skills(config: &ServiceConfig) -> Vec<LiveSkillSummaryEntry> {
    vec![
        LiveSkillSummaryEntry {
            id: BUILTIN_LIVE_NETWORK_SKILL_ID.to_string(),
            name: "Network Analysis".to_string(),
            description:
                "Fetch and summarize live network signals for coding and architecture tasks."
                    .to_string(),
            kind: "network_analysis".to_string(),
            source: "builtin".to_string(),
            version: BUILTIN_LIVE_NETWORK_SKILL_VERSION.to_string(),
            enabled: true,
            supports_network: config.live_skills_network_enabled,
            tags: vec![
                "network".to_string(),
                "research".to_string(),
                "analysis".to_string(),
            ],
            aliases: build_live_skill_aliases(BUILTIN_LIVE_NETWORK_SKILL_ID),
        },
        LiveSkillSummaryEntry {
            id: BUILTIN_LIVE_RESEARCH_ORCHESTRATOR_SKILL_ID.to_string(),
            name: "Research Orchestrator".to_string(),
            description:
                "Run bounded multi-query research orchestration with sub-agent session tracking."
                    .to_string(),
            kind: "research_orchestration".to_string(),
            source: "builtin".to_string(),
            version: BUILTIN_LIVE_RESEARCH_ORCHESTRATOR_SKILL_VERSION.to_string(),
            enabled: true,
            supports_network: config.live_skills_network_enabled,
            tags: vec![
                "research".to_string(),
                "orchestration".to_string(),
                "network".to_string(),
            ],
            aliases: build_live_skill_aliases(BUILTIN_LIVE_RESEARCH_ORCHESTRATOR_SKILL_ID),
        },
        LiveSkillSummaryEntry {
            id: BUILTIN_LIVE_CORE_TREE_SKILL_ID.to_string(),
            name: "Core Tree".to_string(),
            description:
                "List workspace-relative files and directories with depth and match controls."
                    .to_string(),
            kind: "file_tree".to_string(),
            source: "builtin".to_string(),
            version: BUILTIN_LIVE_CORE_SKILL_VERSION.to_string(),
            enabled: true,
            supports_network: false,
            tags: vec![
                "core".to_string(),
                "tree".to_string(),
                "filesystem".to_string(),
            ],
            aliases: build_live_skill_aliases(BUILTIN_LIVE_CORE_TREE_SKILL_ID),
        },
        LiveSkillSummaryEntry {
            id: BUILTIN_LIVE_CORE_GREP_SKILL_ID.to_string(),
            name: "Core Grep".to_string(),
            description:
                "Search workspace files with literal or regex matching and context controls."
                    .to_string(),
            kind: "file_search".to_string(),
            source: "builtin".to_string(),
            version: BUILTIN_LIVE_CORE_SKILL_VERSION.to_string(),
            enabled: true,
            supports_network: false,
            tags: vec![
                "core".to_string(),
                "search".to_string(),
                "grep".to_string(),
                "filesystem".to_string(),
            ],
            aliases: build_live_skill_aliases(BUILTIN_LIVE_CORE_GREP_SKILL_ID),
        },
        LiveSkillSummaryEntry {
            id: BUILTIN_LIVE_CORE_READ_SKILL_ID.to_string(),
            name: "Core Read".to_string(),
            description: "Read file contents from the selected workspace.".to_string(),
            kind: "file_read".to_string(),
            source: "builtin".to_string(),
            version: BUILTIN_LIVE_CORE_SKILL_VERSION.to_string(),
            enabled: true,
            supports_network: false,
            tags: vec![
                "core".to_string(),
                "read".to_string(),
                "filesystem".to_string(),
            ],
            aliases: build_live_skill_aliases(BUILTIN_LIVE_CORE_READ_SKILL_ID),
        },
        LiveSkillSummaryEntry {
            id: BUILTIN_LIVE_CORE_WRITE_SKILL_ID.to_string(),
            name: "Core Write".to_string(),
            description: "Write or create files inside the selected workspace.".to_string(),
            kind: "file_write".to_string(),
            source: "builtin".to_string(),
            version: BUILTIN_LIVE_CORE_SKILL_VERSION.to_string(),
            enabled: true,
            supports_network: false,
            tags: vec![
                "core".to_string(),
                "write".to_string(),
                "filesystem".to_string(),
            ],
            aliases: build_live_skill_aliases(BUILTIN_LIVE_CORE_WRITE_SKILL_ID),
        },
        LiveSkillSummaryEntry {
            id: BUILTIN_LIVE_CORE_EDIT_SKILL_ID.to_string(),
            name: "Core Edit".to_string(),
            description: "Apply deterministic find/replace updates to workspace files.".to_string(),
            kind: "file_edit".to_string(),
            source: "builtin".to_string(),
            version: BUILTIN_LIVE_CORE_SKILL_VERSION.to_string(),
            enabled: true,
            supports_network: false,
            tags: vec![
                "core".to_string(),
                "edit".to_string(),
                "filesystem".to_string(),
            ],
            aliases: build_live_skill_aliases(BUILTIN_LIVE_CORE_EDIT_SKILL_ID),
        },
        LiveSkillSummaryEntry {
            id: BUILTIN_LIVE_CORE_BASH_SKILL_ID.to_string(),
            name: "Core Bash".to_string(),
            description:
                "Execute a workspace-scoped command via the runtime shell (PowerShell/cmd on Windows, POSIX shell elsewhere) with timeout and output cap."
                    .to_string(),
            kind: "shell_command".to_string(),
            source: "builtin".to_string(),
            version: BUILTIN_LIVE_CORE_SKILL_VERSION.to_string(),
            enabled: true,
            supports_network: false,
            tags: vec!["core".to_string(), "bash".to_string(), "shell".to_string()],
            aliases: build_live_skill_aliases(BUILTIN_LIVE_CORE_BASH_SKILL_ID),
        },
        LiveSkillSummaryEntry {
            id: BUILTIN_LIVE_CORE_JS_REPL_SKILL_ID.to_string(),
            name: "Core JS REPL".to_string(),
            description:
                "Execute workspace-scoped JavaScript snippets through a persistent Node.js REPL session with codex.tmpDir, codex.tool(...), codex.emitImage(...), bounded output, timeout, and runtime guardrails. Approving core-js-repl covers nested codex.tool(...) calls executed inside that REPL session."
                    .to_string(),
            kind: "javascript_repl".to_string(),
            source: "builtin".to_string(),
            version: BUILTIN_LIVE_CORE_SKILL_VERSION.to_string(),
            enabled: true,
            supports_network: false,
            tags: vec![
                "core".to_string(),
                "javascript".to_string(),
                "node".to_string(),
                "playwright".to_string(),
            ],
            aliases: build_live_skill_aliases(BUILTIN_LIVE_CORE_JS_REPL_SKILL_ID),
        },
        LiveSkillSummaryEntry {
            id: BUILTIN_LIVE_CORE_JS_REPL_RESET_SKILL_ID.to_string(),
            name: "Core JS REPL Reset".to_string(),
            description:
                "Reset the persistent Node.js REPL session and allocate a fresh codex.tmpDir for the selected workspace."
                    .to_string(),
            kind: "javascript_repl_reset".to_string(),
            source: "builtin".to_string(),
            version: BUILTIN_LIVE_CORE_SKILL_VERSION.to_string(),
            enabled: true,
            supports_network: false,
            tags: vec![
                "core".to_string(),
                "javascript".to_string(),
                "node".to_string(),
                "reset".to_string(),
            ],
            aliases: build_live_skill_aliases(BUILTIN_LIVE_CORE_JS_REPL_RESET_SKILL_ID),
        },
        LiveSkillSummaryEntry {
            id: BUILTIN_LIVE_CORE_DIAGNOSTICS_SKILL_ID.to_string(),
            name: "Core Diagnostics".to_string(),
            description:
                "Collect structured Rust and TypeScript workspace diagnostics through runtime providers."
                    .to_string(),
            kind: "workspace_diagnostics".to_string(),
            source: "builtin".to_string(),
            version: BUILTIN_LIVE_CORE_SKILL_VERSION.to_string(),
            enabled: true,
            supports_network: false,
            tags: vec![
                "core".to_string(),
                "diagnostics".to_string(),
                "lint".to_string(),
                "verify".to_string(),
            ],
            aliases: build_live_skill_aliases(BUILTIN_LIVE_CORE_DIAGNOSTICS_SKILL_ID),
        },
        LiveSkillSummaryEntry {
            id: BUILTIN_LIVE_CORE_COMPUTER_OBSERVE_SKILL_ID.to_string(),
            name: "Core Computer Observe".to_string(),
            description:
                "Capture a read-only environment observation for computer-use diagnosis without control actions."
                    .to_string(),
            kind: "computer_observe".to_string(),
            source: "builtin".to_string(),
            version: BUILTIN_LIVE_CORE_SKILL_VERSION.to_string(),
            enabled: true,
            supports_network: false,
            tags: vec![
                "core".to_string(),
                "computer".to_string(),
                "observe".to_string(),
            ],
            aliases: build_live_skill_aliases(BUILTIN_LIVE_CORE_COMPUTER_OBSERVE_SKILL_ID),
        },
    ]
}
