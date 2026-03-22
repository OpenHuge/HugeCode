import { Link, useRouterState } from "@tanstack/react-router";
import type { ReactNode } from "react";
import {
  chromeBrand,
  chromeBrandMark,
  chromeBrandMeta,
  chromeBrandName,
  chromeContainer,
  chromeHeader,
  chromeNav,
  chromeNavLink,
  chromeNavLinkActive,
  chromeStatusPill,
} from "../web.css";

type WebChromeProps = {
  children: ReactNode;
};

export function WebChrome({ children }: WebChromeProps) {
  const pathname = useRouterState({
    select: (state) => state.location.pathname,
  });

  return (
    <main className={chromeContainer}>
      <header className={chromeHeader}>
        <Link className={chromeBrand} to="/">
          <span className={chromeBrandMark} aria-hidden>
            OF
          </span>
          <span>
            <span className={chromeBrandMeta}>Open Fast Web</span>
            <span className={chromeBrandName}>Cloudflare-ready product surface</span>
          </span>
        </Link>
        <nav className={chromeNav} aria-label="Web routes">
          <Link className={pathname === "/" ? chromeNavLinkActive : chromeNavLink} to="/">
            Overview
          </Link>
          <Link className={pathname === "/about" ? chromeNavLinkActive : chromeNavLink} to="/about">
            About
          </Link>
          <Link className={chromeNavLink} to="/app">
            Workspace
          </Link>
          <span className={chromeStatusPill}>SSR public pages, CSR workspace</span>
        </nav>
      </header>
      {children}
    </main>
  );
}
