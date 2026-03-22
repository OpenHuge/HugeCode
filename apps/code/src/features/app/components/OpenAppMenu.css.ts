import { applyGlobalStyle } from "../../../styles/system/globalStyleHelpers";
import { layers } from "../../../styles/system/layers.css";

applyGlobalStyle(".open-app-dropdown", {
  "@layer": {
    [layers.features]: {
      "--ds-select-menu-gloss": "none",
      "--ds-select-option-hover-shadow": "none",
      "--ds-select-option-selected-shadow": "none",
    },
  },
});
