import React from "react";
import ReactDOM from "react-dom/client";
import { FixtureApp } from "./fixtures/FixtureApp";
import "./styles/runtime";

const rootElement = document.getElementById("root") as HTMLElement;

ReactDOM.createRoot(rootElement).render(
  <React.StrictMode>
    <FixtureApp />
  </React.StrictMode>
);
