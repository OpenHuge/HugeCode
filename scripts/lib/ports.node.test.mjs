import net from "node:net";
import test from "node:test";
import assert from "node:assert/strict";
import { isPortAvailable, resolveAvailablePort } from "./ports.mjs";

async function listen(host) {
  const server = net.createServer();
  await new Promise((resolve) => server.listen(0, host, resolve));
  return server;
}

async function close(server) {
  await new Promise((resolve, reject) => {
    server.close((error) => {
      if (error) {
        reject(error);
        return;
      }
      resolve(undefined);
    });
  });
}

test("isPortAvailable treats wildcard ipv6 listeners as conflicting with localhost web ports", async () => {
  const server = await listen("::");
  const address = server.address();
  const port = typeof address === "object" && address ? address.port : 0;

  try {
    assert.equal(await isPortAvailable(port, { host: "127.0.0.1" }), false);
  } finally {
    await close(server);
  }
});

test("resolveAvailablePort skips ports already occupied by wildcard ipv6 listeners", async () => {
  const server = await listen("::");
  const address = server.address();
  const port = typeof address === "object" && address ? address.port : 0;

  try {
    const resolved = await resolveAvailablePort(port, { host: "127.0.0.1", maxAttempts: 5 });
    assert.notEqual(resolved, port);
  } finally {
    await close(server);
  }
});
