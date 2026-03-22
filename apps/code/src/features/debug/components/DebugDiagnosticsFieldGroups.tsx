import type { ReactNode } from "react";

export type DebugDiagnosticsFieldDescriptor = {
  label: string;
  value: ReactNode;
};

type DebugDiagnosticsMetricGridProps = {
  fields: readonly DebugDiagnosticsFieldDescriptor[];
  gridClassName: string;
  itemClassName: string;
};

export function DebugDiagnosticsMetricGrid({
  fields,
  gridClassName,
  itemClassName,
}: DebugDiagnosticsMetricGridProps) {
  return (
    <div className={gridClassName}>
      {fields.map((field) => (
        <div key={field.label} className={itemClassName}>
          <span>{field.label}</span>
          <strong>{field.value}</strong>
        </div>
      ))}
    </div>
  );
}

type DebugDiagnosticsDefinitionListProps = {
  fields: readonly DebugDiagnosticsFieldDescriptor[];
  className?: string;
};

export function DebugDiagnosticsDefinitionList({
  fields,
  className,
}: DebugDiagnosticsDefinitionListProps) {
  return (
    <dl className={className}>
      {fields.map((field) => (
        <div key={field.label}>
          <dt>{field.label}</dt>
          <dd>{field.value}</dd>
        </div>
      ))}
    </dl>
  );
}
