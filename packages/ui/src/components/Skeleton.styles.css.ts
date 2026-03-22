import { keyframes, style, styleVariants } from "@vanilla-extract/css";

const pulse = keyframes({
  "0%, 100%": { opacity: 1 },
  "50%": { opacity: 0.5 },
});

export const skeletonBase = style({
  animationName: pulse,
  animationDuration: "2s",
  animationTimingFunction: "cubic-bezier(0.4, 0, 0.6, 1)",
  animationIterationCount: "infinite",
  backgroundColor: "var(--color-surface-2)",
});

export const skeletonVariants = styleVariants({
  text: {
    height: "1rem", // ~16px
    width: "100%",
    borderRadius: "var(--radius-sm, 6px)",
  },
  circular: {
    height: "3rem", // ~48px
    width: "3rem",
    borderRadius: "var(--radius-full, 9999px)",
  },
  rectangular: {
    height: "3rem", // ~48px
    width: "100%",
    borderRadius: "var(--radius-md, 8px)",
  },
});
