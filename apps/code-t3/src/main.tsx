import React from "react";
import { createRoot } from "react-dom/client";
import { T3CodeShell } from "./shell/T3CodeShell";
import "../node_modules/@heroui/styles/dist/heroui.min.css";
import "./styles.css";

const root = document.getElementById("root");

if (!root) {
  throw new Error("HugeCode T3 root element is missing.");
}

createRoot(root).render(
  <React.StrictMode>
    <T3CodeShell />
  </React.StrictMode>
);
