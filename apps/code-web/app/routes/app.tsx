import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/app")({
  head: () => ({
    meta: [
      {
        title: "HugeCode Workspace",
      },
      {
        name: "robots",
        content: "noindex",
      },
    ],
  }),
});
