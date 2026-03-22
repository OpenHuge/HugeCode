import { style } from "@vanilla-extract/css";
import { layers } from "../../../styles/system/layers.css";

export const statusIndicator = style({
  "@layer": {
    [layers.features]: {
      selectors: {
        '&[data-thread-strip-status="awaitingApproval"]': {
          animation: "pulse 1.5s ease-in-out infinite",
        },
        '&[data-thread-strip-status="awaitingInput"]': {
          animation: "pulse 1.45s ease-in-out infinite",
        },
      },
    },
  },
});
