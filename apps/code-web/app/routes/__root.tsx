import { HeadContent, Outlet, Scripts, createRootRouteWithContext } from "@tanstack/react-router";
import { CODE_WEB_MANIFEST_PATH, CODE_WEB_PWA_ASSET_PATHS } from "../pwa/pwaConfig";
import type { WebRouterContext } from "../routerContext";
import { documentBody, routeViewport } from "../web.css";

function RootDocument() {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <meta name="application-name" content="HugeCode" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="HugeCode" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="theme-color" content="#0d1117" />
        <link rel="icon" href="/favicon.svg" />
        <link rel="manifest" href={CODE_WEB_MANIFEST_PATH} />
        <link rel="apple-touch-icon" href={CODE_WEB_PWA_ASSET_PATHS.appleTouchIcon} />
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
