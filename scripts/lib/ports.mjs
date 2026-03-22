import net from "node:net";

function canBindPort(port, host) {
  return new Promise((resolve) => {
    const server = net.createServer();

    server.once("error", () => {
      resolve(false);
    });

    server.once("listening", () => {
      server.close(() => {
        resolve(true);
      });
    });

    server.listen(port, host);
  });
}

function expandConflictingHosts(host) {
  const normalizedHost = host?.trim() || "127.0.0.1";
  const hosts = [normalizedHost];

  if (normalizedHost === "127.0.0.1" || normalizedHost === "localhost") {
    hosts.push("0.0.0.0", "::");
  } else if (normalizedHost === "::1") {
    hosts.push("::", "0.0.0.0");
  } else if (normalizedHost === "0.0.0.0") {
    hosts.push("::");
  } else if (normalizedHost === "::") {
    hosts.push("0.0.0.0");
  }

  return [...new Set(hosts)];
}

export async function isPortAvailable(port, { host = "127.0.0.1" } = {}) {
  const probeHosts = expandConflictingHosts(host);
  for (const probeHost of probeHosts) {
    if (!(await canBindPort(port, probeHost))) {
      return false;
    }
  }
  return true;
}

export async function resolveAvailablePort(
  startPort,
  { host = "127.0.0.1", maxAttempts = 200 } = {}
) {
  for (let offset = 0; offset < maxAttempts; offset += 1) {
    const candidate = startPort + offset;
    if (candidate <= 0 || candidate > 65_535) {
      break;
    }
    const available = await isPortAvailable(candidate, { host });
    if (available) {
      return candidate;
    }
  }

  throw new Error(
    `Failed to find an available port from ${startPort} (host=${host}, maxAttempts=${maxAttempts}).`
  );
}
