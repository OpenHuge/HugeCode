import {
  ctaRow,
  heroCard,
  heroCopy,
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

export function WebWorkspaceOfflinePage() {
  return (
    <section className={stackSection}>
      <div className={heroCard}>
        <div className={stackSectionHeader}>
          <span className={stackSectionEyebrow}>Cached workspace</span>
          <h1 className={heroTitle}>
            The HugeCode shell opened offline, but runtime access is paused.
          </h1>
        </div>
        <p className={heroCopy}>
          The PWA can relaunch the cached workspace shell, but runtime RPC, filesystem work, and
          live execution still require a reachable gateway or the desktop runtime. HugeCode keeps
          that boundary explicit instead of replaying stale execution state.
        </p>
        <div className={ctaRow}>
          <a className={primaryLink} href="/offline">
            View offline guide
          </a>
          <a className={secondaryLink} href="/">
            Back to web home
          </a>
        </div>
      </div>

      <section className={stackSection}>
        <div className={stackSectionHeader}>
          <span className={stackSectionEyebrow}>Offline behavior</span>
          <h2 className={stackSectionTitle}>
            HugeCode keeps the shell available without pretending the runtime is local.
          </h2>
        </div>
        <div className={infoGrid}>
          <article className={infoCard}>
            <span className={infoKicker}>What is cached</span>
            <h3 className={infoTitle}>The app shell, route document, and static assets</h3>
            <p className={infoCopy}>
              Installing the PWA gives the browser enough cached UI to reopen the web workspace
              route when the network drops.
            </p>
          </article>
          <article className={infoCard}>
            <span className={infoKicker}>What is not cached</span>
            <h3 className={infoTitle}>
              Runtime RPC, websocket streams, and remote execution truth
            </h3>
            <p className={infoCopy}>
              HugeCode never caches runtime gateway responses as if they were durable workspace
              state.
            </p>
          </article>
          <article className={infoCard}>
            <span className={infoKicker}>Next step</span>
            <h3 className={infoTitle}>Reconnect, then reload the workspace</h3>
            <p className={infoCopy}>
              Once the runtime path is back, refresh this route to resume live workspace behavior.
            </p>
          </article>
        </div>
      </section>
    </section>
  );
}
