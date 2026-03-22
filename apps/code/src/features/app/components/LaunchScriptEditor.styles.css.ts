import { style } from "@vanilla-extract/css";

export const title = style({
  fontSize: "var(--font-size-meta)",
  fontWeight: "600",
  color: "var(--ds-text-stronger)",
  marginBottom: "8px",
});

export const inputField = style({
  width: "100%",
  marginBottom: "8px",
  vars: {
    "--ds-input-radius": "var(--ds-radius-sm)",
    "--ds-input-border": "var(--ds-border-subtle)",
    "--ds-input-surface": "var(--ds-shell-control-bg)",
    "--ds-input-text": "var(--ds-text-strong)",
    "--ds-input-placeholder": "var(--ds-text-muted)",
    "--ds-border-accent": "color-mix(in srgb, var(--ds-border-accent-soft) 58%, transparent)",
  },
});

export const inputControl = style({
  fontSize: "var(--font-size-meta)",
});

export const textarea = style({
  vars: {
    "--ds-textarea-radius": "var(--ds-radius-sm)",
    "--ds-textarea-border": "var(--ds-border-subtle)",
    "--ds-textarea-surface": "var(--ds-shell-control-bg)",
    "--ds-textarea-text": "var(--ds-text-strong)",
    "--ds-textarea-placeholder": "var(--ds-text-muted)",
    "--ds-textarea-focus": "color-mix(in srgb, var(--ds-border-accent-soft) 58%, transparent)",
  },
  width: "100%",
  minHeight: "96px",
  fontSize: "var(--font-size-meta)",
  resize: "vertical",
});

export const error = style({
  marginTop: "8px",
  fontSize: "var(--font-size-fine)",
  color: "var(--ds-state-error-text, var(--ds-text-danger))",
  border:
    "1px solid var(--ds-state-error-border, color-mix(in srgb, var(--status-error) 44%, transparent))",
  background: "var(--ds-state-error-bg, color-mix(in srgb, var(--status-error) 12%, transparent))",
  borderRadius: "var(--ds-radius-sm)",
  padding: "6px 8px",
  boxShadow: "inset 0 1px 0 color-mix(in srgb, var(--status-error) 20%, transparent)",
});

export const actions = style({
  marginTop: "10px",
  display: "flex",
  justifyContent: "flex-end",
  gap: "8px",
});

export const deleteButton = style({
  color: "var(--ds-text-danger)",
  selectors: {
    "&:hover:not(:disabled)": {
      background: "color-mix(in srgb, var(--status-error) 12%, transparent)",
    },
  },
});

export const iconPicker = style({
  display: "grid",
  gridTemplateColumns: "repeat(5, minmax(0, 1fr))",
  gap: "6px",
  marginBottom: "10px",
});

export const iconOption = style({
  borderRadius: "var(--ds-radius-sm)",
  border: "1px solid color-mix(in srgb, var(--ds-border-subtle) 76%, transparent)",
  background: "var(--ds-shell-control-bg)",
  color: "var(--ds-text-strong)",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  padding: "6px",
  boxShadow: "var(--ds-shell-control-shadow)",
  transition:
    "border-color var(--duration-normal) var(--ds-motion-ease-standard, var(--ease-smooth)), background var(--duration-normal) var(--ds-motion-ease-standard, var(--ease-smooth)), box-shadow var(--duration-normal) var(--ds-motion-ease-standard, var(--ease-smooth))",
  selectors: {
    "&:focus-visible": {
      outline: "2px solid var(--ds-focus-ring)",
      outlineOffset: "1px",
    },
  },
});

export const iconOptionSelected = style({
  borderColor: "color-mix(in srgb, var(--ds-border-accent-soft) 66%, transparent)",
  background: "var(--ds-shell-control-bg-active)",
  color: "var(--ds-text-stronger)",
  boxShadow: "var(--ds-shell-control-shadow-hover)",
});

export const newSection = style({
  marginTop: "12px",
  paddingTop: "10px",
  borderTop: "1px solid var(--ds-border-muted)",
});
