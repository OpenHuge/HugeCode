#!/usr/bin/env node

import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import process from "node:process";
import { writeArtifactBundle } from "./artifact-helpers.mjs";

const DEFAULT_PORT = 3845;
const DEFAULT_OUTPUT_DIR = path.join(process.cwd(), ".figma-workflow", "figma-exports");
const MAX_BODY_BYTES = 25 * 1024 * 1024;

function parseArgs(argv) {
  const options = {
    port: DEFAULT_PORT,
    outputDir: DEFAULT_OUTPUT_DIR,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const current = argv[index];
    const next = argv[index + 1];
    if (current === "--port" && next) {
      options.port = Number.parseInt(next, 10);
      index += 1;
      continue;
    }
    if (current === "--output-dir" && next) {
      options.outputDir = path.resolve(next);
      index += 1;
    }
  }

  if (!Number.isInteger(options.port) || options.port <= 0) {
    throw new Error("Expected --port to be a positive integer.");
  }

  return options;
}

function setCorsHeaders(response) {
  response.setHeader("Access-Control-Allow-Origin", "*");
  response.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  response.setHeader("Access-Control-Allow-Headers", "Content-Type");
}

function sendJson(response, statusCode, payload) {
  setCorsHeaders(response);
  response.writeHead(statusCode, { "Content-Type": "application/json; charset=utf-8" });
  response.end(JSON.stringify(payload, null, 2));
}

function collectBody(request) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let totalBytes = 0;

    request.on("data", (chunk) => {
      totalBytes += chunk.length;
      if (totalBytes > MAX_BODY_BYTES) {
        reject(new Error("Request body exceeded 25 MB."));
        request.destroy();
        return;
      }
      chunks.push(chunk);
    });

    request.on("end", () => {
      resolve(Buffer.concat(chunks).toString("utf8"));
    });

    request.on("error", reject);
  });
}

async function startServer() {
  const options = parseArgs(process.argv.slice(2));
  fs.mkdirSync(options.outputDir, { recursive: true });

  const server = http.createServer(async (request, response) => {
    const method = request.method ?? "GET";
    const requestUrl = new URL(request.url ?? "/", "http://127.0.0.1");

    if (method === "OPTIONS") {
      setCorsHeaders(response);
      response.writeHead(204);
      response.end();
      return;
    }

    if (method === "GET" && requestUrl.pathname === "/health") {
      sendJson(response, 200, {
        ok: true,
        port: options.port,
        outputDir: options.outputDir,
      });
      return;
    }

    if (method === "POST" && requestUrl.pathname === "/figma-export") {
      try {
        const body = await collectBody(request);
        const payload = JSON.parse(body);
        const artifact = writeArtifactBundle(payload, options.outputDir);

        sendJson(response, 201, {
          ok: true,
          path: path.relative(process.cwd(), artifact.jsonPath),
          summaryPath: path.relative(process.cwd(), artifact.summaryPath),
          manifestPath: path.relative(process.cwd(), artifact.manifestPath),
          pngPath: artifact.pngPath ? path.relative(process.cwd(), artifact.pngPath) : null,
          svgPath: artifact.svgPath ? path.relative(process.cwd(), artifact.svgPath) : null,
          bytes: Buffer.byteLength(body),
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        sendJson(response, 400, {
          ok: false,
          error: message,
        });
      }
      return;
    }

    sendJson(response, 404, {
      ok: false,
      error: "Not found.",
    });
  });

  server.listen(options.port, "127.0.0.1", () => {
    process.stdout.write(
      `Local Figma JSON receiver listening on http://127.0.0.1:${options.port}\n`
    );
    process.stdout.write(`Writing exports to ${options.outputDir}\n`);
  });

  function shutdown() {
    server.close(() => {
      process.exit(0);
    });
  }

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

startServer().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`${message}\n`);
  process.exit(1);
});
