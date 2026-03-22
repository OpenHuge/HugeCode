import { style } from "@vanilla-extract/css";

export const root = style({
  display: "flex",
  flexDirection: "column",
  gap: "6px",
});

export const actions = style({
  display: "inline-flex",
  alignItems: "center",
  gap: "8px",
  flexWrap: "wrap",
});

export const description = style({
  maxWidth: "56ch",
});
