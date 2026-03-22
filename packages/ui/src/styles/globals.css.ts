import { globalStyle } from "@vanilla-extract/css";

globalStyle("*", {
  boxSizing: "border-box",
});

globalStyle("*:focus-visible", {
  outline: "2px solid var(--color-ring)",
  outlineOffset: "2px",
});

globalStyle("*:focus:not(:focus-visible)", {
  outline: "none",
});
