import { WEB_RUNTIME_GATEWAY_ENDPOINT_ENV_KEY } from "@ku0/shared/runtimeGatewayEnv";
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

export function WebWorkspaceUnavailablePage() {
  return (
    <section className={stackSection}>
      <div className={heroCard}>
        <div className={stackSectionHeader}>
          <span className={stackSectionEyebrow}>Web workspace</span>
          <h1 className={heroTitle}>Connect a runtime to open the workspace.</h1>
        </div>
        <p className={heroCopy}>
          Public pages stay fast on the web, but the full workspace needs either the desktop runtime
          or a configured gateway endpoint. To enable browser access, set{" "}
          <code>{WEB_RUNTIME_GATEWAY_ENDPOINT_ENV_KEY}</code> and reload this page.
        </p>
        <div className={ctaRow}>
          <a className={primaryLink} href="/">
            Back to web home
          </a>
          <a className={secondaryLink} href="/about">
            View platform overview
          </a>
        </div>
      </div>

      <section className={stackSection}>
        <div className={stackSectionHeader}>
          <span className={stackSectionEyebrow}>Runtime paths</span>
          <h2 className={stackSectionTitle}>Keep the workspace client-only on the web.</h2>
        </div>
        <div className={infoGrid}>
          <article className={infoCard}>
            <span className={infoKicker}>Desktop</span>
            <h3 className={infoTitle}>Use the local runtime for repos and OS tools</h3>
            <p className={infoCopy}>
              The desktop path keeps filesystem access, native window controls, and local repo
              workflows inside the desktop host.
            </p>
          </article>
          <article className={infoCard}>
            <span className={infoKicker}>Gateway</span>
            <h3 className={infoTitle}>Point the browser at a remote runtime</h3>
            <p className={infoCopy}>
              Configure the web runtime gateway when you want the same workspace shell in a browser
              session without attaching the desktop runtime.
            </p>
          </article>
          <article className={infoCard}>
            <span className={infoKicker}>Boundary</span>
            <h3 className={infoTitle}>Load the full shell only when a runtime is available</h3>
            <p className={infoCopy}>
              The SSR shell stays focused on public pages while the interactive workspace waits for
              a runtime target before loading the desktop-heavy client.
            </p>
          </article>
        </div>
      </section>
    </section>
  );
}
