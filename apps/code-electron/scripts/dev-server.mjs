import { createServer } from "node:net";

const DEFAULT_HOST = "127.0.0.1";
const DEFAULT_PORT = 5187;

export function createDevServerUrl(port, host = DEFAULT_HOST) {
  return `http://${host}:${port}`;
}

async function reservePort(port) {
  return await new Promise((resolveReservation, rejectReservation) => {
    const server = createServer();

    server.once("error", (error) => {
      rejectReservation(error);
    });

    server.once("listening", () => {
      const address = server.address();
      if (!address || typeof address === "string") {
        server.close(() => {
          rejectReservation(new Error("Unable to resolve reserved dev server port."));
        });
        return;
      }

      server.close(() => {
        resolveReservation(address.port);
      });
    });

    if (typeof port === "number") {
      server.listen(port);
      return;
    }

    server.listen(0);
  });
}

export async function resolveAvailableDevServerPort(options = {}) {
  const preferredPort = options.preferredPort ?? DEFAULT_PORT;
  const reserveRequestedPort = options.reserveRequestedPort ?? reservePort;

  try {
    return await reserveRequestedPort(preferredPort);
  } catch {
    return await reserveRequestedPort(null);
  }
}
