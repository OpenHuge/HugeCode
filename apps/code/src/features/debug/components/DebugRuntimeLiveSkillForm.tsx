import { Button } from "../../../design-system";
import { Checkbox } from "../../../design-system";
import { Input } from "../../../design-system";
import type { DebugRuntimeLiveSkillFormProps } from "./DebugRuntimeProbes.types";

export function DebugRuntimeLiveSkillForm(props: DebugRuntimeLiveSkillFormProps) {
  return (
    <>
      <div className="debug-runtime-live-skill">
        <Input
          type="text"
          value={props.liveSkillId}
          onChange={(event) => props.onLiveSkillIdChange(event.target.value)}
          placeholder="live skill id"
          aria-label="Live skill id"
          disabled={props.isRuntimeProbeBusy}
          fieldClassName="debug-runtime-live-skill-field"
        />
        <Input
          type="text"
          value={props.liveSkillInput}
          onChange={(event) => props.onLiveSkillInputChange(event.target.value)}
          placeholder="live skill input"
          aria-label="Live skill input"
          disabled={props.isRuntimeProbeBusy}
          fieldClassName="debug-runtime-live-skill-field"
        />
        <Button
          variant="ghost"
          size="sm"
          onClick={props.onRunLiveSkillProbe}
          disabled={props.isRuntimeProbeBusy}
        >
          Run skill
        </Button>
      </div>
      {props.isCoreTreeSkillSelected ? (
        <div className="debug-runtime-live-skill-options">
          <Input
            type="text"
            value={props.liveSkillPath}
            onChange={(event) => props.onLiveSkillPathChange(event.target.value)}
            placeholder="workspace-relative path (default: .)"
            aria-label="Live skill path"
            disabled={props.isRuntimeProbeBusy}
            fieldClassName="debug-runtime-live-skill-field"
          />
          <Input
            type="text"
            value={props.liveSkillQuery}
            onChange={(event) => props.onLiveSkillQueryChange(event.target.value)}
            placeholder="filter query (optional)"
            aria-label="Live skill query"
            disabled={props.isRuntimeProbeBusy}
            fieldClassName="debug-runtime-live-skill-field"
          />
          <Input
            type="text"
            inputMode="numeric"
            value={props.liveSkillMaxDepth}
            onChange={(event) => props.onLiveSkillMaxDepthChange(event.target.value)}
            placeholder="max depth (optional)"
            aria-label="Live skill max depth"
            disabled={props.isRuntimeProbeBusy}
            fieldClassName="debug-runtime-live-skill-field"
          />
          <Input
            type="text"
            inputMode="numeric"
            value={props.liveSkillMaxResults}
            onChange={(event) => props.onLiveSkillMaxResultsChange(event.target.value)}
            placeholder="max results (optional)"
            aria-label="Live skill max results"
            disabled={props.isRuntimeProbeBusy}
            fieldClassName="debug-runtime-live-skill-field"
          />
          <Checkbox
            className="debug-runtime-live-skill-checkbox"
            label="include hidden paths"
            checked={props.liveSkillIncludeHidden}
            onCheckedChange={props.onLiveSkillIncludeHiddenChange}
            aria-label="Live skill include hidden"
            disabled={props.isRuntimeProbeBusy}
          />
        </div>
      ) : null}
    </>
  );
}
