import { type GlobalStyleRule, globalStyle } from "@vanilla-extract/css";
import { layers } from "../../../../../styles/system/layers.css";

function feature(selector: string, rule: Record<string, unknown>) {
  globalStyle(selector, { "@layer": { [layers.features]: rule } } as unknown as GlobalStyleRule);
}

feature(".account-pools-summary", { display: "none" });

feature(".account-pools-management .settings-field-label--section", {
  marginBottom: "0",
  fontSize: "var(--font-size-fine)",
  letterSpacing: "0.06em",
  textTransform: "uppercase",
  color: "var(--ds-text-faint)",
});

feature(".account-pools-create-row, .account-pools-bulk-actions", {
  flexWrap: "wrap",
  alignItems: "stretch",
  gap: "9px",
});
feature(
  ".account-pools-create-row > button, .account-pools-list .settings-override-field > button",
  {
    flex: "0 0 auto",
    whiteSpace: "nowrap",
  }
);

feature(".account-pools-bulk-actions", {
  padding: "10px 11px",
  borderRadius: "var(--ds-radius-md)",
  border: "1px solid color-mix(in srgb, var(--ds-border-muted) 76%, transparent)",
  background: "color-mix(in srgb, var(--ds-surface-control) 62%, var(--ds-surface-card-base))",
  "@media": { "(max-width: 720px)": { padding: "10px" } },
});
feature(".account-pools-bulk-actions > button", {
  minHeight: "30px",
  padding: "6px 10px",
  borderRadius: "calc(var(--ds-radius-sm) + 1px)",
  fontSize: "var(--font-size-fine)",
});

feature(".account-pools-list", { display: "flex", flexDirection: "column", gap: "10px" });
feature(".account-pools-list .settings-override-row", {
  position: "relative",
  borderRadius: "calc(var(--ds-radius-md) + 1px)",
  border: "1px solid color-mix(in srgb, var(--ds-border-muted) 80%, transparent)",
  background: "color-mix(in srgb, var(--ds-surface-card-base) 86%, transparent)",
  boxShadow: "inset 0 1px 0 color-mix(in srgb, var(--ds-border-subtle) 28%, transparent)",
  "@media": {
    "(max-width: 720px)": {
      flexDirection: "column",
      alignItems: "stretch",
      gap: "10px",
      padding: "11px",
    },
  },
});
feature(".account-pools-list .settings-override-row:hover", {
  borderColor: "color-mix(in srgb, var(--ds-border-subtle) 64%, transparent)",
  background: "color-mix(in srgb, var(--ds-surface-card) 74%, var(--ds-surface-card-base))",
  boxShadow: "inset 0 1px 0 color-mix(in srgb, var(--ds-border-subtle) 30%, transparent)",
});
feature(".account-pools-list .settings-override-info", { gap: "6px" });
feature(".account-pools-list .settings-project-name", {
  fontSize: "var(--font-size-label)",
  fontWeight: "660",
});
feature(".account-pools-list .settings-project-path", { fontSize: "var(--font-size-fine)" });
feature(".account-pools-list .settings-override-actions", {
  minWidth: "min(620px, 100%)",
  gap: "10px",
  "@media": { "(max-width: 720px)": { minWidth: "0" } },
});
feature(".account-pools-list .settings-override-field", { flexWrap: "wrap", gap: "8px" });

feature(".account-pools-content .settings-help-error", {
  borderRadius: "var(--ds-radius-md)",
  border: "1px solid color-mix(in srgb, var(--status-error) 34%, var(--ds-border-muted))",
  background: "color-mix(in srgb, var(--status-error) 9%, var(--ds-surface-card-base))",
  color: "color-mix(in srgb, var(--status-error) 76%, white)",
  padding: "8px 10px",
});

feature(".account-pools-summary", {
  "@media": {
    "(max-width: 720px)": {
      gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
      gap: "7px",
    },
  },
});
