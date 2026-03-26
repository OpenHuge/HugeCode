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

export function WebOfflinePage() {
  return (
    <section className={stackSection}>
      <div className={heroCard}>
        <div className={stackSectionHeader}>
          <span className={stackSectionEyebrow}>Offline shell</span>
          <h1 className={heroTitle}>
            You&apos;re offline, but HugeCode still has a cached web shell.
          </h1>
        </div>
        <p className={heroCopy}>
          Public pages remain available from cache and the workspace entry can reopen its cached
          shell. Live runtime work still depends on your configured gateway or desktop runtime, so
          execution resumes only after the network comes back.
        </p>
        <div className={ctaRow}>
          <a className={primaryLink} href="/">
            Return home
          </a>
          <a className={secondaryLink} href="/app">
            Open cached workspace
          </a>
        </div>
      </div>

      <section className={stackSection}>
        <div className={stackSectionHeader}>
          <span className={stackSectionEyebrow}>What still works</span>
          <h2 className={stackSectionTitle}>
            HugeCode treats offline access as a transparent fallback.
          </h2>
        </div>
        <div className={infoGrid}>
          <article className={infoCard}>
            <span className={infoKicker}>Cached public routes</span>
            <h3 className={infoTitle}>Overview and product context remain readable</h3>
            <p className={infoCopy}>
              The public shell is cached so operators can reopen key web routes without waiting for
              the network.
            </p>
          </article>
          <article className={infoCard}>
            <span className={infoKicker}>Workspace shell</span>
            <h3 className={infoTitle}>
              The browser workspace can reopen without faking runtime truth
            </h3>
            <p className={infoCopy}>
              HugeCode can relaunch the cached shell, but it does not invent repo state, runtime
              diagnostics, or execution results while the gateway is unreachable.
            </p>
          </article>
          <article className={infoCard}>
            <span className={infoKicker}>Recovery</span>
            <h3 className={infoTitle}>Runtime work resumes once the connection path returns</h3>
            <p className={infoCopy}>
              Reload after connectivity is restored to reconnect runtime RPC, websocket updates, and
              live workspace execution.
            </p>
          </article>
        </div>
      </section>
    </section>
  );
}
