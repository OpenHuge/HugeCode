/**
 * Narrow mission-control snapshot adapter.
 *
 * Keep runtime mission-control reads on a dedicated port so presentation
 * facades do not reach for the raw runtime client directly.
 */
export { getMissionControlSnapshot } from "../../../services/tauriRuntimeMissionControlBridge";
