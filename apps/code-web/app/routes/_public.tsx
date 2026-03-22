import { Outlet, createFileRoute } from "@tanstack/react-router";
import { WebChrome } from "../components/WebChrome";

function PublicRouteLayout() {
  return (
    <WebChrome>
      <Outlet />
    </WebChrome>
  );
}

export const Route = createFileRoute("/_public")({
  component: PublicRouteLayout,
});
