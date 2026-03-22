import { Button } from "../../../design-system";
import * as composerInputStyles from "./ComposerInput.styles.css";
import * as styles from "./ComposerActionVisualFixture.css";

type ComposerActionCardProps = {
  stopState: "startup" | "ready";
  title: string;
  note: string;
};

function ComposerActionCard({ stopState, title, note }: ComposerActionCardProps) {
  return (
    <section className={styles.card} data-stop-state={stopState}>
      <div>
        <h2 className={styles.cardTitle}>{title}</h2>
        <p className={styles.cardNote}>{note}</p>
      </div>
      <div className={styles.actionHarness}>
        <div className={styles.actionSurface} role="presentation">
          <span className={styles.actionStatus}>Processing</span>
          <Button
            variant="secondary"
            size="icon"
            className={`${composerInputStyles.action} composer-action is-stop`}
            aria-label={stopState === "ready" ? "Stop" : "Starting response"}
            title={stopState === "ready" ? "Stop" : "Starting response"}
            disabled={stopState !== "ready"}
          >
            <span
              className={`${composerInputStyles.stopSquare} composer-action-stop-square`}
              aria-hidden
            />
          </Button>
        </div>
        <p className={styles.actionCaption}>
          {stopState === "ready"
            ? "The stop action is enabled and ready to interrupt the current run."
            : "The stop action stays visible while startup work is still settling."}
        </p>
      </div>
    </section>
  );
}

export function ComposerActionVisualFixture() {
  return (
    <main className={styles.page} data-visual-fixture="composer-action-stop">
      <div className={styles.frame}>
        <header className={styles.header}>
          <span className={styles.eyebrow}>Composer Fixture</span>
          <h1 className={styles.title}>Composer Action Stop Fixture</h1>
          <p className={styles.subtitle}>
            Dedicated stop-action harness for verifying the processing-state button grammar with
            browser tools. Both the startup-disabled stop state and the active stop-ready state stay
            visible here.
          </p>
        </header>
        <div className={styles.grid}>
          <ComposerActionCard
            stopState="startup"
            title="Starting response"
            note="Processing has started, but stop is not yet ready. The square icon must remain visible."
          />
          <ComposerActionCard
            stopState="ready"
            title="Stop ready"
            note="Processing is active and stop is available. The button should keep the same filled stop treatment."
          />
        </div>
      </div>
    </main>
  );
}
