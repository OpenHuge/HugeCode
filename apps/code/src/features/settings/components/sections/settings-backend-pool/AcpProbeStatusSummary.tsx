type AcpProbeStatusSummaryProps = {
  healthy?: boolean | null;
  lastError?: string | null;
  lastProbeAt?: number | null;
  emptyLabel?: string;
};

function formatProbeTimestamp(value: number | null | undefined): string {
  if (value === null || value === undefined) {
    return "Not probed yet";
  }
  return new Date(value).toLocaleString();
}

export function AcpProbeStatusSummary({
  healthy,
  lastError,
  lastProbeAt,
  emptyLabel = "No ACP probe has completed yet.",
}: AcpProbeStatusSummaryProps) {
  const hasProbe = lastProbeAt !== null && lastProbeAt !== undefined;

  if (!hasProbe && !lastError) {
    return <div className="settings-help">{emptyLabel}</div>;
  }

  return (
    <>
      <div className="settings-help">
        Probe: {healthy === false ? "unhealthy" : "healthy"}. Last probe:{" "}
        {formatProbeTimestamp(lastProbeAt)}
      </div>
      {lastError ? <div className="settings-help settings-help-error">{lastError}</div> : null}
    </>
  );
}
