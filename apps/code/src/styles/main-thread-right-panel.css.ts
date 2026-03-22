import { applyGlobalStyle } from "./system/globalStyleHelpers";
import { layers } from "./system/layers.css";

applyGlobalStyle(".main-header,\n.main-header *", {
  "@layer": { [layers.features]: { "-webkit-user-select": "none", "user-select": "none" } },
});

applyGlobalStyle(
  '.main-header input,\n.main-header textarea,\n.main-header [contenteditable="true"]',
  {
    "@layer": { [layers.features]: { "-webkit-user-select": "text", "user-select": "text" } },
  }
);

applyGlobalStyle(
  '.main-header :is(\n    button,\n    a,\n    input,\n    select,\n    textarea,\n    [role="button"],\n    [role="menuitem"],\n    [role="menuitemradio"],\n    [contenteditable="true"]\n  )',
  {
    "@layer": { [layers.features]: { "-webkit-app-region": "no-drag" } },
  }
);
