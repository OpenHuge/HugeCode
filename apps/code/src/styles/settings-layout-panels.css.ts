import { applyGlobalStyle } from "./system/globalStyleHelpers";
import { layers } from "./system/layers.css";
import "./settings-backend-pool.css";

applyGlobalStyle(".settings-empty", {
  "@layer": {
    [layers.features]: {
      color: "var(--ds-text-faint)",
      "font-size": "var(--font-size-meta)",
    },
  },
});
applyGlobalStyle(".settings-sound-actions", {
  "@layer": {
    [layers.features]: {
      display: "flex",
      gap: "10px",
      "margin-top": "10px",
    },
  },
});
applyGlobalStyle(".settings-scale-row > div:first-child", {
  "@layer": {
    [layers.features]: {
      "min-width": "0",
    },
  },
});
applyGlobalStyle(".account-pools-summary-item", {
  "@layer": {
    [layers.features]: {
      "@media": {
        "(max-width: 720px)": {
          padding: "9px 10px",
        },
      },
    },
  },
});
applyGlobalStyle(".account-pools-summary-value", {
  "@layer": {
    [layers.features]: {
      "@media": {
        "(max-width: 720px)": {
          "font-size": "var(--font-size-label)",
        },
      },
    },
  },
});
applyGlobalStyle(".account-pools-bulk-actions > *", {
  "@layer": {
    [layers.features]: {
      "@media": {
        "(max-width: 720px)": {
          flex: "1 1 100%",
        },
      },
    },
  },
});
applyGlobalStyle(".settings-nav .ds-panel-nav-item-disclosure", {
  "@layer": {
    [layers.features]: {
      "@media": {
        "(max-width: 720px)": {
          color: "var(--ds-text-subtle)",
        },
      },
    },
  },
});
applyGlobalStyle(".settings-body.settings-body-mobile-master-detail .settings-detail", {
  "@layer": {
    [layers.features]: {
      "@media": {
        "(max-width: 720px)": {
          display: "none",
        },
      },
    },
  },
});
applyGlobalStyle(
  ".settings-body.settings-body-mobile-master-detail.is-detail-visible .settings-master",
  {
    "@layer": {
      [layers.features]: {
        "@media": {
          "(max-width: 720px)": {
            display: "none",
          },
        },
      },
    },
  }
);
applyGlobalStyle(
  ".settings-body.settings-body-mobile-master-detail.is-detail-visible .settings-detail",
  {
    "@layer": {
      [layers.features]: {
        "@media": {
          "(max-width: 720px)": {
            display: "flex",
          },
        },
      },
    },
  }
);
