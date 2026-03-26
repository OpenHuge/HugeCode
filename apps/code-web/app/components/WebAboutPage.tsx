import {
  ABOUT_FOOTER,
  ABOUT_ICON_ALT,
  ABOUT_LINKS,
  ABOUT_PRODUCT_NAME,
  ABOUT_TAGLINE,
  ABOUT_VERSION_PREFIX,
} from "@ku0/shared/aboutContent";
import {
  aboutCard,
  aboutFooter,
  aboutHeader,
  aboutIcon,
  aboutLinkGroupTitle,
  aboutLink,
  aboutLinkRow,
  aboutMetaGrid,
  aboutMetaItem,
  aboutMetaLabel,
  aboutMetaValue,
  aboutPrincipleCopy,
  aboutPrincipleItem,
  aboutPrincipleList,
  aboutPrincipleTitle,
  aboutShell,
  aboutSubgrid,
  aboutSubtitle,
  aboutTitle,
  aboutVersion,
  stackSection,
  stackSectionEyebrow,
  stackSectionHeader,
  stackSectionTitle,
} from "../web.css";

const productPrinciples = [
  {
    title: "Reuse logic, not runtime assumptions",
    copy: "Shared content and view models can move across targets. Desktop-only ports and browser-only behavior stay behind explicit boundaries.",
  },
  {
    title: "Web SSR only where it earns its keep",
    copy: "Public routes get SEO and deployment benefits. The interactive workspace keeps a client-only shell to avoid forcing a desktop runtime model into the web path.",
  },
  {
    title: "Cloudflare remains the first-class host",
    copy: "The Start app is structured for Workers deployment now, without re-binding Tauri or collapsing both targets back into one runtime.",
  },
] as const;

export function WebAboutPage() {
  return (
    <section className={aboutShell}>
      <div className={aboutSubgrid}>
        <section className={aboutCard} aria-label="About HugeCode">
          <div className={aboutHeader}>
            <img className={aboutIcon} src="/app-icon.png" alt={ABOUT_ICON_ALT} />
            <div>
              <div className={aboutTitle}>{ABOUT_PRODUCT_NAME}</div>
              <div className={aboutVersion}>
                {ABOUT_VERSION_PREFIX} <span suppressHydrationWarning>{__APP_VERSION__}</span>
              </div>
            </div>
          </div>
          <p className={aboutSubtitle}>{ABOUT_TAGLINE}</p>
          <div className={aboutMetaGrid} aria-label="Product metadata">
            <div className={aboutMetaItem}>
              <span className={aboutMetaLabel}>Web stack</span>
              <strong className={aboutMetaValue}>TanStack Start</strong>
            </div>
            <div className={aboutMetaItem}>
              <span className={aboutMetaLabel}>Deploy target</span>
              <strong className={aboutMetaValue}>Cloudflare Workers</strong>
            </div>
            <div className={aboutMetaItem}>
              <span className={aboutMetaLabel}>Desktop target</span>
              <strong className={aboutMetaValue}>Tauri v2</strong>
            </div>
            <div className={aboutMetaItem}>
              <span className={aboutMetaLabel}>Workspace path</span>
              <strong className={aboutMetaValue}>Client-only bridge</strong>
            </div>
            <div className={aboutMetaItem}>
              <span className={aboutMetaLabel}>PWA mode</span>
              <strong className={aboutMetaValue}>Installable, offline-capable shell</strong>
            </div>
          </div>
          <div>
            <div className={aboutLinkGroupTitle}>Project links</div>
            <div className={aboutLinkRow} aria-label="Project links">
              {ABOUT_LINKS.map((link) => (
                <a
                  key={link.href}
                  className={aboutLink}
                  href={link.href}
                  rel="noreferrer"
                  target="_blank"
                >
                  {link.label}
                </a>
              ))}
            </div>
          </div>
          <div className={aboutFooter}>{ABOUT_FOOTER}</div>
        </section>

        <section className={stackSection} aria-label="Product principles">
          <div className={stackSectionHeader}>
            <span className={stackSectionEyebrow}>Why this structure exists</span>
            <h2 className={stackSectionTitle}>
              The migration stays split because the targets have different jobs.
            </h2>
          </div>
          <div className={aboutPrincipleList}>
            {productPrinciples.map((principle) => (
              <article key={principle.title} className={aboutPrincipleItem}>
                <h3 className={aboutPrincipleTitle}>{principle.title}</h3>
                <p className={aboutPrincipleCopy}>{principle.copy}</p>
              </article>
            ))}
          </div>
        </section>
      </div>
    </section>
  );
}
