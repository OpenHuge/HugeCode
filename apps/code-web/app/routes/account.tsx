import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/account")({
  head: () => ({
    meta: [
      {
        title: "Account Center - HugeCode Workspace",
      },
      {
        name: "robots",
        content: "noindex",
      },
    ],
  }),
});
