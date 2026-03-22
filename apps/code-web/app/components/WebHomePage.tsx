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
    copy: "The interactive workspace still loads through a controlled client bridge. That keeps Tauri assumptions out of Web SSR and avoids forced runtime unification.",
  },
  {
    title: "Cloudflare-first deploy path",
    kicker: "Runtime strategy",
    copy: "Workers remains the default web host. The Start app can expand into selective SSR or prerender later without dragging the desktop runtime along.",
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
    value: "Tauri v2 + apps/code",
    copy: "Static host and CSR pipeline stay intact.",
  },
  {
    label: "Shared layer",
    value: "@ku0/shared",
    copy: "Pure content and runtime-agnostic data only.",
  },
  {
    label: "Boundary rule",
    value: "No Tauri in SSR",
    copy: "Server routes stay clear of desktop-only modules.",
  },
] as const;

export function WebHomePage() {
  return (
    <>
      <section className={heroSplit}>
        <div className={heroCard}>
          <span className={eyebrow}>Open Fast Web Surface</span>
          <h1 className={heroTitle}>
            A focused web shell on TanStack Start, without pulling Tauri into the server path.
          </h1>
          <p className={heroCopy}>
            This web target is optimized for Cloudflare Workers, public SSR, and deliberate runtime
            boundaries. The desktop app continues to run from its own CSR build, while the web layer
            stays fast, legible, and operationally clean.
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
