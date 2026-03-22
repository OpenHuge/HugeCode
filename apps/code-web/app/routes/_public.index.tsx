import { createFileRoute } from "@tanstack/react-router";
import { WebHomePage } from "../components/WebHomePage";

export const Route = createFileRoute("/_public/")({
  component: WebHomePage,
  head: () => ({
    meta: [
      {
        title: "Open Fast Web",
      },
      {
        name: "description",
        content:
          "Open Fast web runtime powered by TanStack Start with a Cloudflare-first deployment path.",
      },
    ],
  }),
});
