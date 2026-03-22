import type { DebugEntry } from "../../../types";

export type FormattedDebugEntry = DebugEntry & {
  timeLabel: string;
  payloadText?: string;
};

export function DebugEntriesList({
  formattedEntries,
}: {
  formattedEntries: FormattedDebugEntry[];
}) {
  return (
    <div className="debug-list">
      {formattedEntries.length === 0 ? (
        <div className="debug-empty">No debug events yet.</div>
      ) : null}
      {formattedEntries.map((entry) => (
        <div key={entry.id} className="debug-row">
          <div className="debug-meta">
            <span className={`debug-source ${entry.source}`}>{entry.source}</span>
            <span className="debug-time">{entry.timeLabel}</span>
            <span className="debug-label">{entry.label}</span>
          </div>
          {entry.payloadText !== undefined ? (
            <pre className="debug-payload">{entry.payloadText}</pre>
          ) : null}
        </div>
      ))}
    </div>
  );
}
