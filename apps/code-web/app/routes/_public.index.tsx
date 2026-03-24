import { createFileRoute } from "@tanstack/react-router";
import { WebHomePage } from "../components/WebHomePage";

export const Route = createFileRoute("/_public/")({
  component: WebHomePage,
  head: () => ({
    meta: [
      {
        title: "HugeCode Web",
      },
      {
        name: "description",
        content:
          "HugeCode web shell powered by TanStack Start with a Cloudflare-first deployment path.",
      },
    ],
  }),
});
