import { createFileRoute } from "@tanstack/react-router";
import { WebAboutPage } from "../components/WebAboutPage";

export const Route = createFileRoute("/_public/about")({
  component: WebAboutPage,
  head: () => ({
    meta: [
      {
        title: "About HugeCode",
      },
    ],
  }),
});
