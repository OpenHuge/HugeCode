export type LiveSkillKind =
  | "network_analysis"
  | "research_orchestration"
  | "file_tree"
  | "file_search"
  | "file_read"
  | "file_write"
  | "file_edit"
  | "shell_command"
  | "computer_observe"
  | (string & {});

export type LiveSkillSource = "builtin" | "managed" | "workspace" | (string & {});
