import { createFileRoute } from "@tanstack/react-router";
import { WebOfflinePage } from "../components/WebOfflinePage";

export const Route = createFileRoute("/_public/offline")({
  component: WebOfflinePage,
  head: () => ({
    meta: [
      {
        title: "HugeCode Offline",
      },
      {
        name: "description",
        content: "Offline guide for the HugeCode web PWA and cached workspace shell.",
      },
    ],
  }),
});
