import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import { fileURLToPath } from "node:url";

const reactPath = fileURLToPath(new URL("./node_modules/react/index.js", import.meta.url));
const reactJsxRuntimePath = fileURLToPath(
  new URL("./node_modules/react/jsx-runtime.js", import.meta.url)
);
const reactDomPath = fileURLToPath(new URL("./node_modules/react-dom/index.js", import.meta.url));
const reactDomClientPath = fileURLToPath(
  new URL("./node_modules/react-dom/client.js", import.meta.url)
);

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: [
      { find: /^react$/, replacement: reactPath },
      { find: /^react\/jsx-runtime$/, replacement: reactJsxRuntimePath },
      { find: /^react-dom$/, replacement: reactDomPath },
      { find: /^react-dom\/client$/, replacement: reactDomClientPath },
    ],
    dedupe: ["react", "react-dom"],
  },
  server: {
    host: "::",
  },
  build: {
    target: "es2022",
    sourcemap: true,
  },
});
