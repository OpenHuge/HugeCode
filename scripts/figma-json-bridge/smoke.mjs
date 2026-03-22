#!/usr/bin/env node

import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import process from "node:process";
import { spawn } from "node:child_process";

function readArgValue(flag) {
  const index = process.argv.indexOf(flag);
  if (index === -1) {
    return null;
  }
  return process.argv[index + 1] ?? null;
}

const smokePortBase = Number.parseInt(readArgValue("--port-base") ?? "3845", 10);
const smokeUiReceiverPort = smokePortBase;
const smokePort = smokePortBase + 1;
const smokeApiPort = smokePortBase + 2;
const smokeUiPort = smokePortBase + 3;
const smokeOutputDir = path.resolve(
  readArgValue("--output-dir") ?? path.join(process.cwd(), ".figma-workflow", "figma-exports-smoke")
);
const receiverPath = path.join(process.cwd(), "scripts", "figma-json-bridge", "receiver.mjs");
const fetchPath = path.join(process.cwd(), "scripts", "figma-json-bridge", "fetch.mjs");
const uiPath = path.join(process.cwd(), "scripts", "figma-json-bridge", "ui.html");
const generatedCodegenMapPath = path.join(
  process.cwd(),
  "scripts",
  "figma-json-bridge",
  "generated",
  "figmaCodegenMap.js"
);
const keepArtifacts = process.argv.includes("--keep");
const tinyPngBase64 =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a4n8AAAAASUVORK5CYII=";
const tinySvg =
  '<svg xmlns="http://www.w3.org/2000/svg" width="1" height="1"><rect width="1" height="1" fill="#ffffff"/></svg>';

fs.mkdirSync(smokeOutputDir, { recursive: true });

async function waitForHealth(url, timeoutMs) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    try {
      const response = await fetch(url);
      if (response.ok) {
        return;
      }
    } catch {}

    await new Promise((resolve) => {
      setTimeout(resolve, 200);
    });
  }

  throw new Error(`Receiver did not become healthy within ${timeoutMs} ms.`);
}

function spawnProcess(command, args, options = {}) {
  return spawn(command, args, {
    cwd: process.cwd(),
    stdio: ["ignore", "pipe", "pipe"],
    ...options,
  });
}

function startMockFigmaApiServer() {
  const pngBytes = Buffer.from(tinyPngBase64, "base64");
  const server = http.createServer((request, response) => {
    const requestUrl = new URL(request.url ?? "/", `http://127.0.0.1:${smokeApiPort}`);

    if (request.method === "GET" && requestUrl.pathname === "/v1/files/test-file/nodes") {
      response.writeHead(200, { "content-type": "application/json; charset=utf-8" });
      response.end(
        JSON.stringify({
          document: {
            children: [
              {
                id: "0:1",
                name: "Smoke",
                type: "CANVAS",
                children: [{ id: "1:24862" }],
              },
            ],
          },
          nodes: {
            "1:24862": {
              document: {
                id: "1:24862",
                name: "Linear Card",
                type: "FRAME",
                fills: [{ type: "SOLID", color: { r: 1, g: 1, b: 1 } }],
                children: [
                  {
                    id: "1:24863",
                    name: "Title",
                    type: "TEXT",
                    fills: [{ type: "SOLID", color: { r: 0.0627, g: 0.1254, b: 0.2 } }],
                    children: [],
                  },
                ],
              },
            },
          },
        })
      );
      return;
    }

    if (request.method === "GET" && requestUrl.pathname === "/v1/images/test-file") {
      const format = requestUrl.searchParams.get("format");
      const imagePath =
        format === "svg"
          ? `http://127.0.0.1:${smokeApiPort}/renders/test.svg`
          : `http://127.0.0.1:${smokeApiPort}/renders/test.png`;
      response.writeHead(200, { "content-type": "application/json; charset=utf-8" });
      response.end(
        JSON.stringify({
          images: {
            "1:24862": imagePath,
          },
        })
      );
      return;
    }

    if (request.method === "GET" && requestUrl.pathname === "/renders/test.png") {
      response.writeHead(200, { "content-type": "image/png" });
      response.end(pngBytes);
      return;
    }

    if (request.method === "GET" && requestUrl.pathname === "/renders/test.svg") {
      response.writeHead(200, { "content-type": "image/svg+xml; charset=utf-8" });
      response.end(tinySvg);
      return;
    }

    response.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
    response.end("Not found");
  });

  return new Promise((resolve) => {
    server.listen(smokeApiPort, "127.0.0.1", () => resolve(server));
  });
}

async function runReceiverSmoke() {
  const child = spawnProcess(process.execPath, [
    receiverPath,
    "--port",
    String(smokePort),
    "--output-dir",
    smokeOutputDir,
  ]);

  let stderr = "";
  child.stderr.on("data", (chunk) => {
    stderr += chunk.toString("utf8");
  });

  try {
    await waitForHealth(`http://127.0.0.1:${smokePort}/health`, 8000);

    const samplePayload = {
      exportedAt: "2026-03-11T00:00:00.000Z",
      fileKey: "test-file",
      currentPage: {
        id: "0:1",
        name: "Smoke",
      },
      selection: {
        id: "1:24862",
        name: "Linear Card",
        type: "FRAME",
      },
      document: {
        document: {
          id: "1:24862",
          name: "Linear Card",
          type: "FRAME",
          fills: [
            {
              type: "SOLID",
              color: { r: 1, g: 1, b: 1 },
            },
          ],
          children: [
            {
              id: "1:24863",
              name: "Title",
              type: "TEXT",
              fills: [
                {
                  type: "SOLID",
                  color: { r: 0.0627, g: 0.1254, b: 0.2 },
                },
              ],
              children: [],
            },
          ],
        },
      },
      resources: {
        pngBase64: tinyPngBase64,
        svgString: tinySvg,
      },
    };

    const response = await fetch(`http://127.0.0.1:${smokePort}/figma-export`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify(samplePayload),
    });

    if (response.status !== 201) {
      throw new Error(`Expected HTTP 201 from receiver, got ${response.status}.`);
    }

    const result = await response.json();
    const savedPath = path.join(process.cwd(), result.path);
    if (!fs.existsSync(savedPath)) {
      throw new Error(`Receiver reported ${result.path}, but no file was written.`);
    }
  } finally {
    child.kill("SIGTERM");
    await new Promise((resolve) => {
      child.once("exit", resolve);
    });
    if (stderr.trim().length > 0) {
      process.stderr.write(stderr);
    }
  }
}

async function runFetchSmoke() {
  const registryPath = path.join(smokeOutputDir, "registry.smoke.json");
  fs.writeFileSync(
    registryPath,
    JSON.stringify(
      {
        version: 1,
        resources: [
          {
            id: "smoke-linear-card",
            fileKey: "test-file",
            nodeId: "1:24862",
            url: "https://www.figma.com/design/test-file/Smoke?node-id=1-24862",
          },
        ],
      },
      null,
      2
    ),
    "utf8"
  );

  const mockServer = await startMockFigmaApiServer();
  try {
    const child = spawnProcess(
      process.execPath,
      [
        fetchPath,
        "--resource",
        "smoke-linear-card",
        "--registry",
        registryPath,
        "--output-dir",
        smokeOutputDir,
        "--token-env",
        "FIGMA_TEST_TOKEN",
        "--api-base-url",
        `http://127.0.0.1:${smokeApiPort}`,
        "--refresh",
      ],
      {
        env: {
          ...process.env,
          FIGMA_TEST_TOKEN: "smoke-token",
        },
      }
    );

    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString("utf8");
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString("utf8");
    });

    const exitCode = await new Promise((resolve) => {
      child.once("exit", resolve);
    });

    if (exitCode !== 0) {
      throw new Error(`Fetch smoke failed: ${stderr.trim() || `exit ${String(exitCode)}`}`);
    }

    const result = JSON.parse(stdout);
    const savedPath = path.join(process.cwd(), result.output.jsonPath);
    if (!fs.existsSync(savedPath)) {
      throw new Error(`Fetch reported ${result.output.jsonPath}, but no file was written.`);
    }

    const savedPayload = JSON.parse(fs.readFileSync(savedPath, "utf8"));
    if (savedPayload.requestedTarget?.source !== "figma-rest-api") {
      throw new Error("Fetch output did not record the figma-rest-api source.");
    }

    const baseName = savedPath.slice(0, -".json".length);
    for (const extraPath of [
      `${baseName}.png`,
      `${baseName}.svg`,
      `${baseName}.summary.json`,
      `${baseName}.manifest.json`,
    ]) {
      if (!fs.existsSync(extraPath)) {
        throw new Error(`Expected fetch companion resource file to exist: ${extraPath}`);
      }
    }
  } finally {
    await new Promise((resolve) => {
      mockServer.close(resolve);
    });
  }
}

function startUiFixtureServer() {
  const uiHtml = fs.readFileSync(uiPath, "utf8");
  const generatedCodegenMap = fs.readFileSync(generatedCodegenMapPath, "utf8");
  const servedUiHtml = uiHtml.includes("</head>")
    ? uiHtml.replace("</head>", `  <script>${generatedCodegenMap}</script>\n  </head>`)
    : `<script>${generatedCodegenMap}</script>\n${uiHtml}`;
  const server = http.createServer((request, response) => {
    const requestUrl = new URL(request.url ?? "/", `http://127.0.0.1:${smokeUiPort}`);
    if (request.method === "GET" && ["/", "/ui.html"].includes(requestUrl.pathname)) {
      response.writeHead(200, { "content-type": "text/html; charset=utf-8" });
      response.end(servedUiHtml);
      return;
    }

    response.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
    response.end("Not found");
  });

  return new Promise((resolve) => {
    server.listen(smokeUiPort, "127.0.0.1", () => resolve(server));
  });
}

function startUiReceiverServer() {
  const receivedPayloads = [];
  const server = http.createServer((request, response) => {
    const requestUrl = new URL(request.url ?? "/", `http://127.0.0.1:${smokeUiReceiverPort}`);
    response.setHeader("access-control-allow-origin", `http://127.0.0.1:${smokeUiPort}`);
    response.setHeader("access-control-allow-methods", "POST, OPTIONS");
    response.setHeader("access-control-allow-headers", "content-type");

    if (request.method === "OPTIONS") {
      response.writeHead(204);
      response.end();
      return;
    }

    if (request.method === "POST" && requestUrl.pathname === "/figma-export") {
      let body = "";
      request.on("data", (chunk) => {
        body += chunk.toString("utf8");
      });
      request.on("end", () => {
        const payload = JSON.parse(body);
        receivedPayloads.push(payload);
        response.writeHead(200, { "content-type": "application/json; charset=utf-8" });
        response.end(
          JSON.stringify({
            path: "ui-smoke/Design-System-Dark-Mode-8-2.json",
            summaryPath: "ui-smoke/Design-System-Dark-Mode-8-2.summary.json",
          })
        );
      });
      return;
    }

    response.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
    response.end("Not found");
  });

  return new Promise((resolve) => {
    server.listen(smokeUiReceiverPort, "127.0.0.1", () => resolve({ server, receivedPayloads }));
  });
}

async function runUiWorkflowSmoke() {
  let chromium;
  try {
    ({ chromium } = await import("playwright"));
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`UI smoke requires the playwright package to be installed. ${message}`);
  }

  const uiServer = await startUiFixtureServer();
  const { server: receiverServer, receivedPayloads } = await startUiReceiverServer();
  const browser = await chromium.launch({ headless: true });

  try {
    const context = await browser.newContext({ acceptDownloads: true });
    const uiOrigin = `http://127.0.0.1:${smokeUiPort}`;
    await context.grantPermissions(["clipboard-read", "clipboard-write"], { origin: uiOrigin });
    const page = await context.newPage();
    const postedMessages = [];

    await page.exposeFunction("recordPluginMessage", (message) => {
      postedMessages.push(message);
    });

    const receiverUrl = `http://127.0.0.1:${smokeUiReceiverPort}/figma-export`;
    await page.goto(`${uiOrigin}/ui.html?receiver=${encodeURIComponent(receiverUrl)}`, {
      waitUntil: "domcontentloaded",
    });
    await page.evaluate(() => {
      const originalPostMessage = window.postMessage.bind(window);
      window.postMessage = (message, targetOrigin, transfer) => {
        window.recordPluginMessage(message);
        return originalPostMessage(message, targetOrigin, transfer);
      };
    });

    await page.evaluate(() => {
      window.dispatchEvent(
        new MessageEvent("message", {
          data: {
            pluginMessage: {
              type: "selection-state",
              fileKey: "KWUgG9JAz50HjH0jIrGkpH",
              selectionCount: 1,
              selection: {
                id: "8:2",
                name: "Design System (Dark Mode)",
                type: "CANVAS",
              },
              codegenState: {
                message: "Found 1 bound variable.",
                bindings: [
                  {
                    id: "VariableID:1:7",
                    name: "color/text/primary",
                    resolvedType: "COLOR",
                    collectionId: "VariableCollectionId:1:2",
                    scopes: ["ALL_SCOPES"],
                    missing: false,
                  },
                ],
              },
            },
          },
        })
      );
    });

    await page
      .locator("#targetInput")
      .fill(
        "https://www.figma.com/design/KWUgG9JAz50HjH0jIrGkpH/Linear-Design-System--Community---Copy-?node-id=8-2"
      );
    await page.locator("#exportButton").click();

    await page.evaluate(() => {
      window.dispatchEvent(
        new MessageEvent("message", {
          data: {
            pluginMessage: {
              type: "export-ready",
              suggestedFileName: "Design-System-Dark-Mode-8-2.json",
              payload: {
                exportedAt: "2026-03-13T04:50:51.935Z",
                fileKey: "KWUgG9JAz50HjH0jIrGkpH",
                selection: {
                  id: "8:2",
                  name: "Design System (Dark Mode)",
                  type: "CANVAS",
                },
                documentMeta: {
                  name: "Linear Design System (Community) (Copy)",
                  version: "2330275133624231707",
                  lastModified: "2026-03-13T03:20:50Z",
                },
                document: {
                  document: {
                    id: "8:2",
                    name: "Design System (Dark Mode)",
                    type: "CANVAS",
                    children: [],
                  },
                },
                resources: {
                  pngBase64: "",
                  svgString: "<svg></svg>",
                },
              },
            },
          },
        })
      );
    });

    const downloadPromise = page.waitForEvent("download");
    await page.locator("#downloadButton").click();
    const download = await downloadPromise;
    const downloadPath = await download.path();
    const downloadedPayload = JSON.parse(fs.readFileSync(downloadPath, "utf8"));

    await page.locator("#sendButton").click();
    await page.waitForFunction(() => {
      const status = document.querySelector("#statusOutput");
      return status?.textContent?.includes("Saved by local receiver.");
    });
    await page.waitForFunction(() => {
      const results = document.querySelector("#codegenResults");
      return results?.textContent?.includes("vars.color.text.primary");
    });

    const clipboardRoundTrip = await page.evaluate(async () => {
      const summary = JSON.stringify({ kind: "figma-summary", nodeId: "8:2" });
      await navigator.clipboard.writeText(summary);
      return navigator.clipboard.readText();
    });

    if (
      postedMessages.length !== 1 ||
      postedMessages[0]?.pluginMessage?.type !== "export-selection"
    ) {
      throw new Error("UI smoke did not emit the expected export-selection message.");
    }
    if (download.suggestedFilename() !== "Design-System-Dark-Mode-8-2.json") {
      throw new Error("UI smoke download filename did not match the exported payload.");
    }
    if (downloadedPayload?.selection?.id !== "8:2") {
      throw new Error("UI smoke download did not persist the structured payload.");
    }
    if (receivedPayloads.length !== 1 || receivedPayloads[0]?.selection?.id !== "8:2") {
      throw new Error("UI smoke localhost send did not deliver the structured payload.");
    }

    const statusText = await page.locator("#statusOutput").innerText();
    if (!statusText.includes("Saved by local receiver.")) {
      throw new Error("UI smoke did not surface the localhost send success state.");
    }
    if (clipboardRoundTrip !== '{"kind":"figma-summary","nodeId":"8:2"}') {
      throw new Error("UI smoke clipboard round-trip did not preserve the structured summary.");
    }

    const codegenText = await page.locator("#codegenResults").innerText();
    if (!codegenText.includes("vars.color.text.primary")) {
      throw new Error("UI smoke did not render the free token/code inspector output.");
    }

    await page.locator("#tokenSearchInput").fill("surface card");
    await page.waitForFunction(() => {
      const results = document.querySelector("#codegenResults");
      return results?.textContent?.includes("vars.color.surface.card");
    });

    const searchText = await page.locator("#codegenResults").innerText();
    if (!searchText.includes("vars.color.surface.card")) {
      throw new Error("UI smoke search did not render the expected token lookup result.");
    }

    await page.locator("#tokenSearchInput").fill("");
    await page.evaluate(() => {
      window.dispatchEvent(
        new MessageEvent("message", {
          data: {
            pluginMessage: {
              type: "selection-state",
              fileKey: "KWUgG9JAz50HjH0jIrGkpH",
              selectionCount: 1,
              selection: {
                id: "8:3",
                name: "Unmapped Example",
                type: "FRAME",
              },
              codegenState: {
                message: "Found 1 bound variable.",
                bindings: [
                  {
                    id: "VariableID:1:999",
                    name: "brand/special/accent",
                    resolvedType: "COLOR",
                    collectionId: "VariableCollectionId:1:2",
                    scopes: ["ALL_SCOPES"],
                    missing: false,
                  },
                ],
              },
            },
          },
        })
      );
    });
    await page.waitForFunction(() => {
      const results = document.querySelector("#codegenResults");
      return results?.textContent?.includes("Unmapped");
    });

    const unmappedText = await page.locator("#codegenResults").innerText();
    if (!unmappedText.includes("Unmapped")) {
      throw new Error("UI smoke did not surface the unmapped token state.");
    }
  } finally {
    await browser.close();
    await new Promise((resolve) => {
      uiServer.close(resolve);
    });
    await new Promise((resolve) => {
      receiverServer.close(resolve);
    });
  }
}

async function main() {
  fs.rmSync(smokeOutputDir, { recursive: true, force: true });
  fs.mkdirSync(smokeOutputDir, { recursive: true });

  try {
    await runReceiverSmoke();
    await runFetchSmoke();
    await runUiWorkflowSmoke();
    process.stdout.write(
      "Smoke test passed. Receiver, headless fetch, and UI workflow all produced compatible data-driven artifacts.\n"
    );
  } finally {
    if (!keepArtifacts) {
      fs.rmSync(smokeOutputDir, { recursive: true, force: true });
    }
  }
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`${message}\n`);
  process.exit(1);
});
