import { applyGlobalStyle } from "./styleUtils";

applyGlobalStyle(".glass", {
  background: "var(--glass-bg)",
  backdropFilter: "blur(var(--glass-blur-sm))",
  WebkitBackdropFilter: "blur(var(--glass-blur-sm))",
  border: "1px solid var(--glass-border)",
});

applyGlobalStyle(".glass-panel", {
  background: "var(--glass-bg)",
  backdropFilter: "blur(var(--glass-blur-sm))",
  WebkitBackdropFilter: "blur(var(--glass-blur-sm))",
  border: "1px solid var(--glass-border)",
  boxShadow: "var(--shadow-glass-panel)",
  borderRadius: "var(--radius-lg, 12px)",
});

applyGlobalStyle(".glass-elevated", {
  background: "var(--glass-bg)",
  backdropFilter: "blur(var(--glass-blur-md))",
  WebkitBackdropFilter: "blur(var(--glass-blur-md))",
  border: "1px solid var(--glass-border)",
  boxShadow: "var(--shadow-glass-elevated)",
  borderRadius: "var(--radius-lg, 12px)",
});

applyGlobalStyle(".glass-subtle", {
  background: "var(--glass-bg)",
  backdropFilter: "blur(var(--glass-blur-sm))",
  WebkitBackdropFilter: "blur(var(--glass-blur-sm))",
  border: "1px solid var(--glass-border)",
  opacity: 1,
});
