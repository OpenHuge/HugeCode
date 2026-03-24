import { type ReactNode, useEffect, useRef } from "react";
import type { FeaturePerformanceSurface } from "../../shared/featurePerformance";
import { beginFeatureInteraction, markFeatureVisible } from "../../shared/featurePerformance";
import { joinClassNames } from "../../../utils/classNames";
import * as controlStyles from "./WorkspaceHomeAgentControl.styles.css";

type WorkspaceHomeAgentLazySectionProps = {
  title: string;
  summary: string;
  surface: FeaturePerformanceSurface;
  open: boolean;
  onToggle: () => void;
  children: ReactNode;
  disabled?: boolean;
  testId?: string;
};

export function WorkspaceHomeAgentLazySection({
  title,
  summary,
  surface,
  open,
  onToggle,
  children,
  disabled = false,
  testId,
}: WorkspaceHomeAgentLazySectionProps) {
  const completeInteractionRef = useRef<null | (() => void)>(null);
  const hasMarkedVisibleRef = useRef(false);

  useEffect(() => {
    if (!open || hasMarkedVisibleRef.current) {
      return;
    }
    hasMarkedVisibleRef.current = true;
    markFeatureVisible(surface);
  }, [open, surface]);

  useEffect(() => {
    if (!open || !completeInteractionRef.current) {
      return;
    }
    const completeInteraction = completeInteractionRef.current;
    completeInteractionRef.current = null;
    const frameHandle = window.requestAnimationFrame(() => {
      completeInteraction();
    });
    return () => {
      window.cancelAnimationFrame(frameHandle);
    };
  }, [open]);

  return (
    <section className={controlStyles.disclosureSection} data-testid={testId}>
      <button
        type="button"
        className={joinClassNames(
          controlStyles.disclosureToggle,
          open && controlStyles.disclosureToggleExpanded
        )}
        onClick={() => {
          if (!open) {
            completeInteractionRef.current = beginFeatureInteraction(surface);
          }
          onToggle();
        }}
        disabled={disabled}
        aria-expanded={open}
      >
        <span className={controlStyles.disclosureCopy}>
          <span className={controlStyles.disclosureTitle}>{title}</span>
          <span className={controlStyles.disclosureSummary}>{summary}</span>
        </span>
        <span className={controlStyles.disclosureAction}>{open ? "Hide" : "Open"}</span>
      </button>
      {open ? <div className={controlStyles.disclosureBody}>{children}</div> : null}
    </section>
  );
}
