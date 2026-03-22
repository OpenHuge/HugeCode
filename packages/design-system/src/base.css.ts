import { applyGlobalStyle } from "./styleUtils";

const darkLikeBodySelector =
  ':root[data-theme="dark"] body, :root[data-theme="dim"] body, .dark body, .dim body';
const darkLikeSelectionSelector =
  ':root[data-theme="dark"] ::selection, :root[data-theme="dim"] ::selection, .dark ::selection, .dim ::selection';
const darkLikeProseSelector =
  ':root[data-theme="dark"] .prose pre, :root[data-theme="dim"] .prose pre, .dark .prose pre, .dim .prose pre';
const darkLikeBlockMoveSelector =
  ':root[data-theme="dark"] .document-editor .ProseMirror > [data-block-id].block-just-moved, :root[data-theme="dim"] .document-editor .ProseMirror > [data-block-id].block-just-moved, .dark .document-editor .ProseMirror > [data-block-id].block-just-moved, .dim .document-editor .ProseMirror > [data-block-id].block-just-moved';

applyGlobalStyle("*", {
  boxSizing: "border-box",
  borderColor: "var(--color-border)",
});

applyGlobalStyle("body", {
  backgroundColor: "var(--color-background)",
  color: "var(--color-foreground)",
  backgroundImage: "none",
  backgroundRepeat: "repeat",
  WebkitFontSmoothing: "antialiased",
  MozOsxFontSmoothing: "grayscale",
});

applyGlobalStyle(darkLikeBodySelector, {
  backgroundImage: "none",
});

applyGlobalStyle("html", {
  scrollBehavior: "smooth",
});

applyGlobalStyle("::selection", {
  backgroundColor: "rgba(93, 127, 214, 0.22)",
  color: "inherit",
});

applyGlobalStyle(darkLikeSelectionSelector, {
  backgroundColor: "rgba(93, 127, 214, 0.28)",
});

applyGlobalStyle(darkLikeProseSelector, {
  backgroundColor: "rgb(20 20 25)",
});

applyGlobalStyle(".document-editor .ProseMirror > [data-block-id].block-just-moved", {
  animation: "block-move-flash 1s ease-out forwards",
});

applyGlobalStyle(darkLikeBlockMoveSelector, {
  animation: "block-move-flash 500ms ease-out forwards",
});

applyGlobalStyle(".scrollbar-auto-hide", {
  scrollbarWidth: "thin",
  scrollbarColor: "transparent transparent",
  transition: "scrollbar-color var(--duration-normal) var(--ease-smooth)",
});

applyGlobalStyle(
  ".scrollbar-auto-hide:hover, .scrollbar-auto-hide:focus-within, .scrollbar-auto-hide.is-scrolling",
  {
    scrollbarColor: "var(--color-border) transparent",
  }
);

applyGlobalStyle(".scrollbar-auto-hide::-webkit-scrollbar", {
  width: "8px",
  height: "8px",
});

applyGlobalStyle(".scrollbar-auto-hide::-webkit-scrollbar-track", {
  background: "transparent",
});

applyGlobalStyle(".scrollbar-auto-hide::-webkit-scrollbar-thumb", {
  background: "transparent",
  borderRadius: "4px",
  border: "2px solid transparent",
  backgroundClip: "content-box",
  transition: "background var(--duration-normal) var(--ease-smooth)",
});

applyGlobalStyle(
  ".scrollbar-auto-hide:hover::-webkit-scrollbar-thumb, .scrollbar-auto-hide:focus-within::-webkit-scrollbar-thumb, .scrollbar-auto-hide.is-scrolling::-webkit-scrollbar-thumb",
  {
    background: "var(--color-border)",
    border: "2px solid transparent",
    backgroundClip: "content-box",
  }
);

applyGlobalStyle(".scrollbar-auto-hide::-webkit-scrollbar-thumb:hover", {
  background: "var(--color-muted-foreground)",
  border: "2px solid transparent",
  backgroundClip: "content-box",
});

applyGlobalStyle(".glass-surface", {
  backgroundColor: "color-mix(in srgb, var(--color-surface-0) 95%, transparent)",
  border: "1px solid color-mix(in srgb, var(--color-border) 60%, transparent)",
});

applyGlobalStyle(".premium-shadow", {
  boxShadow: "var(--shadow-premium)",
});

applyGlobalStyle(".linear-border", {
  border: "1px solid color-mix(in srgb, var(--color-border) 55%, transparent)",
  transition: "border-color var(--duration-normal) var(--ease-smooth)",
});

applyGlobalStyle(".linear-border:hover", {
  borderColor: "color-mix(in srgb, var(--color-border) 75%, transparent)",
});

applyGlobalStyle(".premium-gradient-bg", {
  background: "linear-gradient(180deg, var(--color-surface-0) 0%, var(--color-surface-1) 100%)",
});

applyGlobalStyle("html", {
  "@media": {
    "(prefers-reduced-motion: reduce)": {
      scrollBehavior: "auto",
    },
  },
});
