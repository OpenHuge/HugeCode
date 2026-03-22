import { Button, Input } from "../../../../../design-system";
import * as controlStyles from "../../SettingsFormControls.css";
import type { AcpKeyValueEntry, AcpKeyValueValidationIssue } from "./acpBackendForm";
import * as styles from "./AcpBackendEditorDialog.css";

type KeyValueListEditorProps = {
  entries: AcpKeyValueEntry[];
  emptyState: string;
  addLabel: string;
  keyLabel: string;
  valueLabel: string;
  validationIssues?: AcpKeyValueValidationIssue[];
  onChange: (entries: AcpKeyValueEntry[]) => void;
};

function createEntryId(prefix: string): string {
  return `${prefix}-${Math.random().toString(36).slice(2, 10)}`;
}

export function KeyValueListEditor({
  entries,
  emptyState,
  addLabel,
  keyLabel,
  valueLabel,
  validationIssues = [],
  onChange,
}: KeyValueListEditorProps) {
  const fieldClassName = `${controlStyles.inputField} ${controlStyles.inputFieldCompact}`;
  const issuesByEntryId = validationIssues.reduce<Record<string, string[]>>((result, issue) => {
    const nextIssues = result[issue.entryId] ?? [];
    result[issue.entryId] = nextIssues.includes(issue.message)
      ? nextIssues
      : [...nextIssues, issue.message];
    return result;
  }, {});

  const handleEntryChange = (
    index: number,
    patch: Partial<Pick<AcpKeyValueEntry, "key" | "value">>
  ) => {
    onChange(
      entries.map((entry, entryIndex) => (entryIndex === index ? { ...entry, ...patch } : entry))
    );
  };

  const handleEntryRemove = (index: number) => {
    onChange(entries.filter((_, entryIndex) => entryIndex !== index));
  };

  const handleEntryAdd = () => {
    onChange([...entries, { id: createEntryId("kv"), key: "", value: "" }]);
  };

  return (
    <div className={styles.keyValueList}>
      {entries.length === 0 ? <div className="settings-help">{emptyState}</div> : null}
      {entries.map((entry, index) => (
        <div key={entry.id} className={styles.keyValueEntry}>
          <div className={styles.keyValueRow}>
            <Input
              type="text"
              aria-label={`${keyLabel} ${index + 1}`}
              fieldClassName={fieldClassName}
              inputSize="sm"
              value={entry.key}
              onValueChange={(value) => {
                handleEntryChange(index, { key: value });
              }}
            />
            <Input
              type="text"
              aria-label={`${valueLabel} ${index + 1}`}
              fieldClassName={fieldClassName}
              inputSize="sm"
              value={entry.value}
              onValueChange={(value) => {
                handleEntryChange(index, { value });
              }}
            />
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="settings-button-compact"
              onClick={() => {
                handleEntryRemove(index);
              }}
              aria-label={`Remove ${keyLabel.toLowerCase()} ${index + 1}`}
            >
              Remove
            </Button>
          </div>
          {(issuesByEntryId[entry.id] ?? []).map((message) => (
            <div key={`${entry.id}-${message}`} className={styles.keyValueRowError}>
              {message}
            </div>
          ))}
        </div>
      ))}
      <div className={styles.keyValueActions}>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          className="settings-button-compact"
          onClick={handleEntryAdd}
        >
          {addLabel}
        </Button>
      </div>
    </div>
  );
}
