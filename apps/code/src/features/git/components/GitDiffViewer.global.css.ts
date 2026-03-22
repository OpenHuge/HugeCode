import { type GlobalStyleRule, globalStyle } from "@vanilla-extract/css";
import { layers } from "../../../styles/system/layers.css";
import * as styles from "./GitDiffViewer.styles.css";

function feature(selector: string, rule: GlobalStyleRule) {
  globalStyle(selector, {
    "@layer": { [layers.features]: rule },
  } as unknown as GlobalStyleRule);
}

feature(`${styles.pullRequestMarkdown} :where(h1, h2, h3, h4, h5, h6)`, { marginTop: "16px" });
feature(`${styles.pullRequestMarkdown} :where(p, ul, ol, pre)`, { marginTop: "10px" });
feature(`${styles.pullRequestComment} :where(p, ul, ol, pre)`, { marginTop: "8px" });

feature(`${styles.output} pre`, { margin: "0" });
feature(`${styles.output} diffs-container`, {
  display: "block",
  maxWidth: "100%",
  minWidth: "0",
  width: "100%",
});
feature(`${styles.outputFlat} diffs-container`, { background: "transparent" });
feature(`${styles.outputFlat} .git-diff-container`, {
  width: "100%",
  maxWidth: "100%",
  minWidth: "0",
});

feature(`${styles.output} .diff-line`, {
  display: "grid",
  gridTemplateColumns: "64px 1fr",
  alignItems: "start",
  gap: "12px",
  padding: "2px 6px 2px 4px",
  borderRadius: "0",
  whiteSpace: "pre-wrap",
});
feature(`${styles.output} button.diff-line`, {
  width: "100%",
  border: "0",
  background: "transparent",
  color: "inherit",
  font: "inherit",
  textAlign: "left",
});
feature(`${styles.output} .diff-line.is-selectable`, { cursor: "pointer" });
feature(`${styles.output} .diff-line.is-selectable:hover`, {
  background: "color-mix(in srgb, var(--ds-surface-active) 40%, transparent)",
  boxShadow:
    "inset 3px 0 0 color-mix(in srgb, var(--ds-border-accent-soft) 62%, var(--ds-border-subtle))",
});
feature(`${styles.output} .diff-line.is-selected`, {
  background: "color-mix(in srgb, var(--ds-surface-active) 56%, transparent)",
  position: "relative",
  boxShadow:
    "inset 3px 0 0 color-mix(in srgb, var(--ds-border-accent) 66%, var(--ds-border-accent-soft))",
});
feature(`${styles.output} .diff-line.is-selected::before`, {
  content: '""',
  position: "absolute",
  left: "0",
  top: "0",
  bottom: "0",
  width: "3px",
  background: "color-mix(in srgb, var(--ds-border-accent) 66%, var(--ds-border-accent-soft))",
});
feature(`${styles.output} .diff-line.is-selected .diff-gutter`, { color: "var(--ds-text-strong)" });
feature(
  `${styles.output} .diff-line.is-selected.is-range-start, ${styles.output} .diff-line.is-selected.is-range-end, ${styles.output} .diff-line.is-selected.is-range-start.is-range-end`,
  { borderRadius: "0" }
);
feature(`${styles.output} .diff-line.is-selectable:focus-visible`, {
  outline: "2px solid var(--ds-focus-ring)",
});
feature(`${styles.output} .diff-gutter`, {
  display: "grid",
  gridTemplateColumns: "1fr 1fr",
  gap: "6px",
  color: "var(--ds-text-fainter)",
  textAlign: "right",
  fontVariantNumeric: "tabular-nums",
});
feature(`${styles.output} .diff-line-number`, { minWidth: "0" });
feature(`${styles.output} .diff-line-content`, {
  minWidth: "0",
  overflowWrap: "anywhere",
  wordBreak: "break-word",
});

const tokenScope = `${styles.output} .diff-line-content`;
feature(
  `${tokenScope} .token.comment, ${tokenScope} .token.prolog, ${tokenScope} .token.doctype, ${tokenScope} .token.cdata`,
  {
    color: "var(--ds-text-accent)",
  }
);
feature(`${tokenScope} .token.punctuation`, { color: "var(--ds-text-subtle)" });
feature(
  `${tokenScope} .token.property, ${tokenScope} .token.tag, ${tokenScope} .token.constant, ${tokenScope} .token.symbol, ${tokenScope} .token.deleted`,
  {
    color: "var(--ds-syntax-danger)",
  }
);
feature(`${tokenScope} .token.boolean, ${tokenScope} .token.number`, {
  color: "var(--ds-syntax-warning)",
});
feature(
  `${tokenScope} .token.selector, ${tokenScope} .token.attr-name, ${tokenScope} .token.string, ${tokenScope} .token.char, ${tokenScope} .token.builtin, ${tokenScope} .token.inserted`,
  {
    color: "var(--ds-syntax-success)",
  }
);
feature(
  `${tokenScope} .token.operator, ${tokenScope} .token.entity, ${tokenScope} .token.url, ${tokenScope} .token.variable`,
  {
    color: "var(--ds-syntax-variable)",
  }
);
feature(
  `${tokenScope} .token.atrule, ${tokenScope} .token.attr-value, ${tokenScope} .token.keyword`,
  {
    color: "var(--ds-syntax-keyword)",
  }
);
feature(`${tokenScope} .token.function, ${tokenScope} .token.class-name`, {
  color: "var(--ds-syntax-function)",
});
