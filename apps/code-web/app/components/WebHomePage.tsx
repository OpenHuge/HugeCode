import { Link } from "@tanstack/react-router";
import {
  ctaRow,
  eyebrow,
  heroCard,
  heroCopy,
  heroMetaCard,
  heroMetaCopy,
  heroMetaGrid,
  heroMetaLabel,
  heroMetaValue,
  heroSplit,
  heroTitle,
  infoCard,
  infoCopy,
  infoGrid,
  infoKicker,
  infoTitle,
  primaryLink,
  secondaryLink,
  stackSection,
  stackSectionEyebrow,
  stackSectionHeader,
  stackSectionTitle,
} from "../web.css";

const routeCards = [
  {
    title: "SSR overview routes",
    kicker: "Public web",
    copy: "The public product surface stays server-rendered so the web target can ship fast, crawl cleanly, and deploy directly to Workers.",
  },
  {
    title: "Client-only workspace shell",
    kicker: "/app boundary",
    copy: "The interactive workspace still loads through a controlled client bridge. That keeps desktop host assumptions out of Web SSR and avoids forced runtime unification.",
  },
  {
    title: "Installable shell with explicit offline boundaries",
    kicker: "PWA support",
    copy: "HugeCode can now install as a single web app, reopen the cached shell offline, and still keep runtime truth behind the same gateway and desktop boundaries.",
  },
] as const;

const stackFacts = [
  {
    label: "Web router",
    value: "TanStack Start",
    copy: "File routes and SSR for public web pages.",
  },
  {
    label: "Desktop target",
    value: "Electron + apps/code",
    copy: "Static host and CSR pipeline stay intact.",
  },
  {
    label: "Shared layer",
    value: "@ku0/code-workspace-client",
    copy: "Shared workspace shell and bindings for the web and desktop hosts.",
  },
  {
    label: "PWA mode",
    value: "Single app at /",
    copy: "Install once, launch into /app, and keep public routes available offline.",
  },
  {
    label: "Boundary rule",
    value: "No desktop host in SSR",
    copy: "Server routes stay clear of desktop-only modules.",
  },
] as const;

export function WebHomePage() {
  return (
    <>
      <section className={heroSplit}>
        <div className={heroCard}>
          <span className={eyebrow}>HugeCode Web Surface</span>
          <h1 className={heroTitle}>
            A focused web shell on TanStack Start, without pulling the desktop host into the server
            path.
          </h1>
          <p className={heroCopy}>
            This web target is optimized for Cloudflare Workers, public SSR, and deliberate runtime
            boundaries. The desktop app continues to run from its own CSR build, while the web layer
            stays fast, installable, and operationally clean.
          </p>
          <div className={ctaRow}>
            <Link className={primaryLink} to="/app">
              Open workspace
            </Link>
            <Link className={secondaryLink} to="/about">
              Inspect product details
            </Link>
          </div>
        </div>
        <div className={heroMetaGrid} aria-label="Architecture summary">
          {stackFacts.map((fact) => (
            <article key={fact.label} className={heroMetaCard}>
              <span className={heroMetaLabel}>{fact.label}</span>
              <strong className={heroMetaValue}>{fact.value}</strong>
              <p className={heroMetaCopy}>{fact.copy}</p>
            </article>
          ))}
        </div>
      </section>

      <section className={stackSection}>
        <div className={stackSectionHeader}>
          <span className={stackSectionEyebrow}>Current implementation</span>
          <h2 className={stackSectionTitle}>
            The migration is intentionally split by runtime responsibility.
          </h2>
        </div>
        <div className={infoGrid} aria-label="Implementation notes">
          {routeCards.map((card) => (
            <article key={card.title} className={infoCard}>
              <span className={infoKicker}>{card.kicker}</span>
              <h3 className={infoTitle}>{card.title}</h3>
              <p className={infoCopy}>{card.copy}</p>
            </article>
          ))}
        </div>
      </section>
    </>
  );
}
