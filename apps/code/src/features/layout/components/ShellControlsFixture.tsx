import { useState } from "react";
import { TabBar } from "../../app/components/TabBar";
import type { AppTab } from "../../shell/types/shellRoute";
import * as styles from "./ShellControlsFixture.css";

export function ShellControlsFixture() {
  const [activeTab, setActiveTab] = useState<AppTab>("home");

  return (
    <main className={styles.shell}>
      <div className={styles.frame}>
        <header className={styles.header}>
          <span className={styles.eyebrow}>Shell Fixture</span>
          <h1 className={styles.title}>Shell Controls Fixture</h1>
          <p className={styles.subtitle}>
            Deterministic compact-shell surface for gated tab guidance, tab selection fallback, and
            hint auto-dismiss timing without depending on runtime or workspace data.
          </p>
        </header>

        <section
          className={`app layout-phone ${styles.phoneShell}`}
          aria-label="Shell controls surface"
        >
          <div className={styles.surface}>
            <section className={styles.card}>
              <h2 className={styles.cardTitle}>Workspace not selected</h2>
              <p className={styles.cardCopy}>
                Missions and Review stay visible but route back to Workspaces until a workspace is
                active.
              </p>
            </section>
            <section className={styles.card}>
              <h2 className={styles.cardTitle}>Hint contract</h2>
              <p className={styles.cardCopy}>
                Tapping a gated tab should announce why the route changed, then dismiss the hint
                after the standard timeout.
              </p>
            </section>
          </div>
          <TabBar activeTab={activeTab} hasActiveWorkspace={false} onSelect={setActiveTab} />
        </section>
      </div>
    </main>
  );
}
