import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/app")({
  head: () => ({
    meta: [
      {
        title: "Open Fast Workspace",
      },
      {
        name: "robots",
        content: "noindex",
      },
    ],
  }),
});
