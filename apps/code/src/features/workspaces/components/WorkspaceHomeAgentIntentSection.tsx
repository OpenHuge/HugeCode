import type {
  AgentIntentPriority,
  AgentIntentState,
} from "../../../application/runtime/types/webMcpBridge";
import {
  INTENT_PRIORITY_OPTIONS,
  normalizeDateInput,
  toDateValue,
} from "./workspaceHomeAgentControlState";
import * as controlStyles from "./WorkspaceHomeAgentControl.styles.css";

type WorkspaceHomeAgentIntentSectionProps = {
  intent: AgentIntentState;
  onIntentPatch: (patch: Partial<AgentIntentState>) => void;
};

export function WorkspaceHomeAgentIntentSection({
  intent,
  onIntentPatch,
}: WorkspaceHomeAgentIntentSectionProps) {
  return (
    <div className={controlStyles.controlSection}>
      <div className={controlStyles.sectionTitle}>Intent</div>
      <div className={controlStyles.controlGrid}>
        <label className={controlStyles.field}>
          <span>Objective</span>
          <textarea
            className={controlStyles.fieldTextarea}
            value={intent.objective}
            onChange={(event) => onIntentPatch({ objective: event.target.value })}
            rows={2}
          />
        </label>
        <label className={controlStyles.field}>
          <span>Constraints</span>
          <textarea
            className={controlStyles.fieldTextarea}
            value={intent.constraints}
            onChange={(event) => onIntentPatch({ constraints: event.target.value })}
            rows={2}
          />
        </label>
        <label className={controlStyles.field}>
          <span>Success criteria</span>
          <textarea
            className={controlStyles.fieldTextarea}
            value={intent.successCriteria}
            onChange={(event) => onIntentPatch({ successCriteria: event.target.value })}
            rows={2}
          />
        </label>
        <label className={controlStyles.field}>
          <span>Manager notes</span>
          <textarea
            className={controlStyles.fieldTextarea}
            value={intent.managerNotes}
            onChange={(event) => onIntentPatch({ managerNotes: event.target.value })}
            rows={2}
          />
        </label>
        <label className={controlStyles.field}>
          <span>Priority</span>
          <select
            className={controlStyles.fieldControl}
            value={intent.priority}
            onChange={(event) =>
              onIntentPatch({ priority: event.target.value as AgentIntentPriority })
            }
          >
            {INTENT_PRIORITY_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
        <label className={controlStyles.field}>
          <span>Deadline</span>
          <input
            className={controlStyles.fieldControl}
            type="date"
            value={toDateValue(intent.deadline)}
            onChange={(event) =>
              onIntentPatch({ deadline: normalizeDateInput(event.target.value) })
            }
          />
        </label>
      </div>
    </div>
  );
}
