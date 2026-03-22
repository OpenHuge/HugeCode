import { globalKeyframes } from "@vanilla-extract/css";
import { applyGlobalStyle } from "./styleUtils";

const enter = globalKeyframes("enter", {
  from: {
    opacity: "var(--tw-enter-opacity, 1)",
    transform:
      "translate3d(var(--tw-enter-translate-x, 0), var(--tw-enter-translate-y, 0), 0) scale(var(--tw-enter-scale, 1))",
  },
  to: {
    opacity: 1,
    transform: "translate3d(0, 0, 0) scale(1)",
  },
});

const exit = globalKeyframes("exit", {
  from: {
    opacity: 1,
    transform: "translate3d(0, 0, 0) scale(1)",
  },
  to: {
    opacity: "var(--tw-exit-opacity, 1)",
    transform:
      "translate3d(var(--tw-exit-translate-x, 0), var(--tw-exit-translate-y, 0), 0) scale(var(--tw-exit-scale, 1))",
  },
});

const shine = globalKeyframes("shine", {
  from: { backgroundPosition: "200% 0" },
  to: { backgroundPosition: "-200% 0" },
});

const pulseSpring = globalKeyframes("pulse-spring", {
  "0%, 100%": { transform: "scale(0.85)" },
  "15%": { transform: "scale(1.15)" },
  "25%": { transform: "scale(0.95)" },
  "35%": { transform: "scale(1.05)" },
  "45%": { transform: "scale(0.98)" },
  "60%": { transform: "scale(1)" },
});

const enterFadeSlide = globalKeyframes("enter-fade-slide", {
  from: { opacity: 0, transform: "translateY(8px)" },
  to: { opacity: 1, transform: "translateY(0)" },
});

const aiThinkingPulse = globalKeyframes("ai-thinking-pulse", {
  "0%, 100%": { opacity: 0.6, transform: "scale(1)" },
  "50%": { opacity: 1, transform: "scale(1.02)" },
});

const aiMessageEnter = globalKeyframes("ai-message-enter", {
  from: { opacity: 0, transform: "translateY(6px) scale(0.98)" },
  to: { opacity: 1, transform: "translateY(0) scale(1)" },
});

const aiShimmer = globalKeyframes("ai-shimmer", {
  "0%": { backgroundPosition: "200% 0" },
  "100%": { backgroundPosition: "-200% 0" },
});

const aiSheen = globalKeyframes("ai-sheen", {
  from: { backgroundPosition: "200% 0" },
  to: { backgroundPosition: "-200% 0" },
});

const blockMoveFlash = globalKeyframes("block-move-flash", {
  "0%": {
    backgroundColor: "hsl(214 90% 68% / 0.25)",
    boxShadow: "0 0 0 2px hsl(214 90% 68% / 0.15)",
  },
  "100%": {
    backgroundColor: "transparent",
    boxShadow: "none",
  },
});

void blockMoveFlash;

applyGlobalStyle(".animate-in", {
  animationName: enter,
  animationDuration: "var(--tw-duration, var(--duration-normal))",
  animationTimingFunction: "var(--tw-ease, var(--ease-out-expo))",
  animationFillMode: "both",
});

applyGlobalStyle(".animate-out", {
  animationName: exit,
  animationDuration: "var(--tw-duration, var(--duration-normal))",
  animationTimingFunction: "var(--tw-ease, var(--ease-in-out))",
  animationFillMode: "both",
});

applyGlobalStyle(".fade-in, .fade-in-0", {
  vars: {
    "--tw-enter-opacity": "0",
  } as never,
});

applyGlobalStyle(".fade-out-0", {
  vars: {
    "--tw-exit-opacity": "0",
  } as never,
});

applyGlobalStyle(".zoom-in-95", { vars: { "--tw-enter-scale": "0.95" } as never });
applyGlobalStyle(".zoom-in-50", { vars: { "--tw-enter-scale": "0.5" } as never });
applyGlobalStyle(".zoom-out-95", { vars: { "--tw-exit-scale": "0.95" } as never });
applyGlobalStyle(".slide-in-from-top-1", {
  vars: { "--tw-enter-translate-y": "-0.25rem" } as never,
});
applyGlobalStyle(".slide-in-from-top-2", {
  vars: { "--tw-enter-translate-y": "-0.5rem" } as never,
});
applyGlobalStyle(".slide-in-from-bottom-2", {
  vars: { "--tw-enter-translate-y": "0.5rem" } as never,
});
applyGlobalStyle(".slide-in-from-bottom-4", {
  vars: { "--tw-enter-translate-y": "1rem" } as never,
});
applyGlobalStyle(".slide-in-from-left-2", {
  vars: { "--tw-enter-translate-x": "-0.5rem" } as never,
});
applyGlobalStyle(".slide-in-from-right-2", {
  vars: { "--tw-enter-translate-x": "0.5rem" } as never,
});
applyGlobalStyle(".slide-in-from-left", { vars: { "--tw-enter-translate-x": "-100%" } as never });
applyGlobalStyle(".slide-in-from-right", { vars: { "--tw-enter-translate-x": "100%" } as never });
applyGlobalStyle(".slide-in-from-top", { vars: { "--tw-enter-translate-y": "-100%" } as never });
applyGlobalStyle(".slide-in-from-bottom", { vars: { "--tw-enter-translate-y": "100%" } as never });

applyGlobalStyle(".animate-shine", {
  animationName: shine,
  animationDuration: "1.5s",
  animationTimingFunction: "linear",
  animationIterationCount: "infinite",
});

applyGlobalStyle(".animate-pulse-spring", {
  animation: `${pulseSpring} 1.8s var(--ease-smooth) infinite`,
});

applyGlobalStyle(".animate-in-fade-slide", {
  animation: `${enterFadeSlide} var(--duration-normal) var(--ease-out-expo) forwards`,
});

applyGlobalStyle(".ai-thinking-pulse", {
  animation: `${aiThinkingPulse} 2s var(--ease-smooth) infinite`,
});

applyGlobalStyle(".ai-message-enter", {
  animation: `${aiMessageEnter} var(--duration-normal) var(--ease-spring) forwards`,
});

applyGlobalStyle(".ai-button-press:active", {
  transform: "scale(0.96)",
  transition: "transform var(--duration-fast) var(--ease-smooth)",
});

applyGlobalStyle(".ai-gradient-shimmer", {
  background:
    "linear-gradient(90deg, transparent 0%, rgba(255, 255, 255, 0.1) 50%, transparent 100%)",
  backgroundSize: "200% 100%",
  animation: `${aiShimmer} 1.5s linear infinite`,
});

applyGlobalStyle(".ai-sheen-line", {
  display: "block",
  width: "100%",
  height: "1px",
  background: "var(--accent-ai-sheen)",
  backgroundSize: "200% 100%",
  animation: `${aiSheen} 2s linear infinite`,
});

applyGlobalStyle(".ai-focus-ring:focus-visible", {
  outline: "none",
  boxShadow: "0 0 0 2px var(--color-background), 0 0 0 4px var(--color-primary)",
  transition: "box-shadow var(--duration-fast) var(--ease-smooth)",
});

applyGlobalStyle(
  ".animate-in, .animate-out, .animate-in-fade-slide, .animate-shine, .animate-pulse-spring, .ai-thinking-pulse, .ai-message-enter, .ai-gradient-shimmer, .ai-sheen-line, .animate-pulse, .animate-ping, .animate-spin",
  {
    "@media": {
      "(prefers-reduced-motion: reduce)": {
        animationDuration: "1ms",
        animationIterationCount: "1",
        transitionDuration: "0ms",
      },
    },
  }
);

applyGlobalStyle(".ai-button-press:active", {
  "@media": {
    "(prefers-reduced-motion: reduce)": {
      transform: "none",
    },
  },
});
