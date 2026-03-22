const OPEN_PLAN_PANEL_EVENT = "hugecode:show-plan-panel";
let latestPlanPanelRequestId = 0;

export function requestOpenPlanPanel() {
  if (typeof window === "undefined") {
    return;
  }
  latestPlanPanelRequestId += 1;
  window.dispatchEvent(
    new CustomEvent<number>(OPEN_PLAN_PANEL_EVENT, {
      detail: latestPlanPanelRequestId,
    })
  );
}

export function getLatestPlanPanelRequestId() {
  return latestPlanPanelRequestId;
}

export function onOpenPlanPanel(listener: (requestId: number) => void) {
  if (typeof window === "undefined") {
    return () => undefined;
  }
  const handle = (event: Event) => {
    if (event instanceof CustomEvent && typeof event.detail === "number") {
      latestPlanPanelRequestId = Math.max(latestPlanPanelRequestId, event.detail);
      listener(event.detail);
      return;
    }
    latestPlanPanelRequestId += 1;
    listener(latestPlanPanelRequestId);
  };
  window.addEventListener(OPEN_PLAN_PANEL_EVENT, handle);
  return () => window.removeEventListener(OPEN_PLAN_PANEL_EVENT, handle);
}
