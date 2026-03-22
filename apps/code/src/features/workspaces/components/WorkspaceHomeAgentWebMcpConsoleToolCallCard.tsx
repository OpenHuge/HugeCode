import {
  type ExecutionAction,
  stringifyJson,
} from "./WorkspaceHomeAgentWebMcpConsoleSection.helpers";
import { joinClassNames } from "../../../utils/classNames";
import * as controlStyles from "./WorkspaceHomeAgentControl.styles.css";

type WorkspaceHomeAgentWebMcpConsoleToolCallCardProps = {
  selectedToolName: string;
  toolNames: string[];
  toolArgumentsDraft: string;
  selectedToolSchema: unknown;
  callToolAvailable: boolean;
  toolArgumentsError: string | null;
  hasToolSchemaErrors: boolean;
  executionLoading: boolean;
  activeExecution: ExecutionAction | null;
  onSelectedToolNameChange: (value: string) => void;
  onToolArgumentsDraftChange: (value: string) => void;
  onFormatToolArguments: () => void;
  onApplySchemaTemplate: () => void;
  onResetToolArguments: () => void;
  onRunTool: () => void;
};

export function WorkspaceHomeAgentWebMcpConsoleToolCallCard({
  selectedToolName,
  toolNames,
  toolArgumentsDraft,
  selectedToolSchema,
  callToolAvailable,
  toolArgumentsError,
  hasToolSchemaErrors,
  executionLoading,
  activeExecution,
  onSelectedToolNameChange,
  onToolArgumentsDraftChange,
  onFormatToolArguments,
  onApplySchemaTemplate,
  onResetToolArguments,
  onRunTool,
}: WorkspaceHomeAgentWebMcpConsoleToolCallCardProps) {
  return (
    <div className="workspace-home-webmcp-console-card">
      <div className={controlStyles.sectionTitle}>Tool Call</div>
      <label className={controlStyles.field}>
        <span>Tool</span>
        <select
          className={controlStyles.fieldControl}
          value={selectedToolName}
          onChange={(event) => onSelectedToolNameChange(event.target.value)}
        >
          <option value="">Select tool</option>
          {toolNames.map((name) => (
            <option key={name} value={name}>
              {name}
            </option>
          ))}
        </select>
      </label>
      <label className={controlStyles.field}>
        <span>Arguments JSON</span>
        <textarea
          className={joinClassNames(
            "workspace-home-webmcp-console-input",
            controlStyles.fieldTextarea
          )}
          value={toolArgumentsDraft}
          onChange={(event) => onToolArgumentsDraftChange(event.target.value)}
        />
      </label>
      <div className={controlStyles.field}>
        <span>Schema Preview</span>
        <pre className="workspace-home-webmcp-console-schema-preview">
          {stringifyJson(selectedToolSchema ?? {})}
        </pre>
      </div>
      <div className={controlStyles.actions}>
        <button
          type="button"
          className={controlStyles.actionButton}
          onClick={onFormatToolArguments}
        >
          Format JSON
        </button>
        <button
          type="button"
          className={controlStyles.actionButton}
          onClick={onApplySchemaTemplate}
          disabled={!selectedToolName}
        >
          Schema template
        </button>
        <button type="button" className={controlStyles.actionButton} onClick={onResetToolArguments}>
          Reset
        </button>
      </div>
      <button
        type="button"
        onClick={onRunTool}
        disabled={
          !callToolAvailable ||
          Boolean(toolArgumentsError) ||
          hasToolSchemaErrors ||
          executionLoading
        }
      >
        {executionLoading && activeExecution === "tool" ? "Running..." : "Run tool"}
      </button>
    </div>
  );
}
