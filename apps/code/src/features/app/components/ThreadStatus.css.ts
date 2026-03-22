import { styleVariants } from "@vanilla-extract/css";
import { layers } from "../../../styles/system/layers.css";

export const tone = styleVariants({
  ready: {
    "@layer": {
      [layers.features]: {
        background:
          "radial-gradient(circle at center, color-mix(in srgb, var(--status-success) 84%, var(--ds-surface-card-base)) 0 46%, transparent 50%)",
        borderColor: "color-mix(in srgb, var(--status-success) 64%, transparent)",
        boxShadow: "0 0 0 3px color-mix(in srgb, var(--status-success) 10%, transparent)",
      },
    },
  },
  processing: {
    "@layer": {
      [layers.features]: {
        background:
          "radial-gradient(circle at center, color-mix(in srgb, var(--status-warning) 84%, var(--ds-surface-card-base)) 0 44%, transparent 48%)",
        borderColor: "color-mix(in srgb, var(--status-warning) 68%, transparent)",
        boxShadow: "0 0 0 3px color-mix(in srgb, var(--status-warning) 10%, transparent)",
        animation: "pulse 1.2s ease-in-out infinite",
      },
    },
  },
  awaitingApproval: {
    "@layer": {
      [layers.features]: {
        background:
          "radial-gradient(circle at center, color-mix(in srgb, var(--status-warning) 82%, var(--ds-surface-approval)) 0 44%, transparent 48%)",
        borderColor: "color-mix(in srgb, var(--status-warning) 68%, transparent)",
        boxShadow: "0 0 0 3px color-mix(in srgb, var(--status-warning) 10%, transparent)",
        animation: "pulse 1.5s ease-in-out infinite",
      },
    },
  },
  awaitingInput: {
    "@layer": {
      [layers.features]: {
        background:
          "radial-gradient(circle at center, color-mix(in srgb, var(--color-primary) 82%, var(--ds-surface-card-base)) 0 44%, transparent 48%)",
        borderColor: "color-mix(in srgb, var(--color-primary) 66%, transparent)",
        boxShadow: "0 0 0 3px color-mix(in srgb, var(--color-primary) 10%, transparent)",
        animation: "pulse 1.45s ease-in-out infinite",
      },
    },
  },
  planReady: {
    "@layer": {
      [layers.features]: {
        background:
          "radial-gradient(circle at center, color-mix(in srgb, var(--ds-brand-secondary) 78%, var(--ds-surface-card-base)) 0 46%, transparent 50%)",
        borderColor: "color-mix(in srgb, var(--ds-brand-secondary) 64%, transparent)",
        boxShadow: "0 0 0 3px color-mix(in srgb, var(--ds-brand-secondary) 10%, transparent)",
      },
    },
  },
  needsAttention: {
    "@layer": {
      [layers.features]: {
        background:
          "radial-gradient(circle at center, color-mix(in srgb, var(--ds-status-danger) 84%, var(--ds-surface-card-base)) 0 44%, transparent 48%)",
        borderColor: "color-mix(in srgb, var(--ds-status-danger) 68%, transparent)",
        boxShadow: "0 0 0 3px color-mix(in srgb, var(--ds-status-danger) 10%, transparent)",
        animation: "pulse 1.35s ease-in-out infinite",
      },
    },
  },
  completed: {
    "@layer": {
      [layers.features]: {
        background:
          "radial-gradient(circle at center, color-mix(in srgb, var(--status-success) 78%, var(--ds-surface-card-base)) 0 46%, transparent 50%)",
        borderColor: "color-mix(in srgb, var(--status-success) 62%, transparent)",
        boxShadow: "0 0 0 3px color-mix(in srgb, var(--status-success) 10%, transparent)",
      },
    },
  },
  reviewing: {
    "@layer": {
      [layers.features]: {
        background:
          "radial-gradient(circle at center, color-mix(in srgb, var(--status-success) 78%, var(--ds-color-white)) 0 44%, transparent 48%)",
        borderColor: "color-mix(in srgb, var(--status-success) 64%, transparent)",
        boxShadow: "0 0 0 3px color-mix(in srgb, var(--status-success) 10%, transparent)",
        animation: "pulse 1.4s ease-in-out infinite",
      },
    },
  },
  unread: {
    "@layer": {
      [layers.features]: {
        background:
          "radial-gradient(circle at center, color-mix(in srgb, var(--ds-brand-secondary) 88%, var(--ds-surface-card-base)) 0 46%, transparent 50%)",
        borderColor: "color-mix(in srgb, var(--ds-brand-secondary) 64%, transparent)",
        boxShadow: "0 0 0 3px color-mix(in srgb, var(--ds-brand-secondary) 10%, transparent)",
      },
    },
  },
});
