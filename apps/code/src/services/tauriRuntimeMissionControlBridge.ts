import type { HugeCodeMissionControlSnapshot } from "@ku0/code-runtime-host-contract";
import { getRuntimeClient } from "./runtimeClient";

export async function getMissionControlSnapshot(): Promise<HugeCodeMissionControlSnapshot> {
  const projection = await getRuntimeClient().kernelProjectionBootstrapV3({
    scopes: ["mission_control"],
  });
  const missionControl = projection.slices.mission_control;
  if (missionControl && typeof missionControl === "object") {
    return missionControl as HugeCodeMissionControlSnapshot;
  }
  return getRuntimeClient().missionControlSnapshotV1();
}
