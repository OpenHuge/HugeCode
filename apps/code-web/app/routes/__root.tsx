import { HeadContent, Outlet, Scripts, createRootRouteWithContext } from "@tanstack/react-router";
import type { WebRouterContext } from "../routerContext";
import { documentBody, routeViewport } from "../web.css";

function RootDocument() {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <meta name="theme-color" content="#0d1117" />
        <link rel="icon" href="/favicon.svg" />
        <HeadContent />
      </head>
      <body className={documentBody}>
        <div className={routeViewport}>
          <Outlet />
        </div>
        <Scripts />
      </body>
    </html>
  );
}

export const Route = createRootRouteWithContext<WebRouterContext>()({
  component: RootDocument,
});
