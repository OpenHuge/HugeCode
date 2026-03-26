import { Outlet, createFileRoute } from "@tanstack/react-router";
import { WebChrome } from "../components/WebChrome";
import { WebPwaLifecycleMount } from "../pwa/WebPwaLifecycleMount";

function PublicRouteLayout() {
  return (
    <>
      <WebPwaLifecycleMount />
      <WebChrome>
        <Outlet />
      </WebChrome>
    </>
  );
}

export const Route = createFileRoute("/_public")({
  component: PublicRouteLayout,
});
