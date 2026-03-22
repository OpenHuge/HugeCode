import { globalKeyframes, globalStyle } from "@vanilla-extract/css";

const pulseGlow = globalKeyframes("ai-pulse-glow", {
  "0%, 100%": {
    opacity: 0.82,
  },
  "50%": {
    opacity: 1,
  },
});

const shimmer = globalKeyframes("ai-shimmer", {
  "0%": { backgroundPosition: "-200% 0" },
  "100%": { backgroundPosition: "200% 0" },
});

const floatKeyframes = globalKeyframes("ai-float", {
  "0%, 100%": { transform: "translateY(0)" },
  "50%": { transform: "translateY(-4px)" },
});

globalStyle(".ai-gradient-bg", {
  background:
    "linear-gradient(145deg, rgb(93 127 214 / 0.12) 0%, rgb(68 95 153 / 0.08) 100%), var(--color-surface-1)",
});

globalStyle(".ai-gradient-bg-horizontal", {
  background:
    "linear-gradient(90deg, rgb(93 127 214 / 0.12) 0%, rgb(68 95 153 / 0.08) 100%), var(--color-surface-1)",
});

globalStyle(".ai-gradient-text", {
  background: "var(--ai-gradient)",
  WebkitBackgroundClip: "text",
  WebkitTextFillColor: "transparent",
  backgroundClip: "text",
});

globalStyle(".ai-gradient-border", {
  position: "relative",
  background: "var(--color-surface-1, #1a1a1a)",
  borderRadius: "var(--radius-lg, 12px)",
});

globalStyle(".ai-gradient-border::before", {
  content: '""',
  position: "absolute",
  inset: 0,
  padding: "1px",
  borderRadius: "inherit",
  background: "var(--ai-gradient)",
  opacity: 0.38,
  WebkitMask: "linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)",
  mask: "linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)",
  WebkitMaskComposite: "xor",
  maskComposite: "exclude",
  pointerEvents: "none",
});

globalStyle(".ai-glow", {
  opacity: 0.98,
});

globalStyle(".ai-glow-strong", {
  opacity: 1,
});

globalStyle(".ai-glow-text", {
  textShadow: "none",
});

globalStyle(".animate-pulse-glow", {
  animation: `${pulseGlow} 2s ease-in-out infinite`,
});

globalStyle(".animate-shimmer", {
  background: "linear-gradient(90deg, transparent 0%, rgb(93 127 214 / 0.1) 50%, transparent 100%)",
  backgroundSize: "200% 100%",
  animation: `${shimmer} 2.4s linear infinite`,
});

globalStyle(".animate-float", {
  animation: `${floatKeyframes} 3s ease-in-out infinite`,
});

globalStyle(".ai-status-thinking", { color: "var(--ai-thinking)" });
globalStyle(".ai-status-executing", { color: "var(--ai-executing)" });

globalStyle(".ai-status-dot", {
  width: "8px",
  height: "8px",
  borderRadius: "50%",
  background: "var(--ai-accent-start)",
});

globalStyle(".ai-status-dot.thinking", {
  animation: `${pulseGlow} 1.5s ease-in-out infinite`,
});

globalStyle(".ai-status-dot.executing", {
  background: "var(--ai-executing)",
  animation: `${pulseGlow} 1s ease-in-out infinite`,
});
