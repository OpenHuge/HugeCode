import { useEffect, useState } from "react";
import { isRuntimeEventBridgeV2Enabled } from "../../../application/runtime/ports/events";
import {
  type RuntimeEventChannelDiagnostics,
  readRuntimeEventChannelDiagnostics,
  subscribeRuntimeEventChannelDiagnostics,
} from "../../../application/runtime/ports/runtimeEventChannelDiagnostics";

type RuntimeEventBridgePath = "legacy" | "v2";

type DebugRuntimeEventChannelsState = {
  eventChannelDiagnostics: RuntimeEventChannelDiagnostics[];
  runtimeEventBridgePath: RuntimeEventBridgePath;
};

export function useDebugRuntimeEventChannels(): DebugRuntimeEventChannelsState {
  const [eventChannelDiagnostics, setEventChannelDiagnostics] = useState<
    RuntimeEventChannelDiagnostics[]
  >([]);
  const [runtimeEventBridgePath, setRuntimeEventBridgePath] =
    useState<RuntimeEventBridgePath>("legacy");

  useEffect(() => {
    setEventChannelDiagnostics(readRuntimeEventChannelDiagnostics());
    return subscribeRuntimeEventChannelDiagnostics((channels) => {
      setEventChannelDiagnostics(channels);
    });
  }, []);

  useEffect(() => {
    setRuntimeEventBridgePath(isRuntimeEventBridgeV2Enabled() ? "v2" : "legacy");
  }, []);

  return {
    eventChannelDiagnostics,
    runtimeEventBridgePath,
  };
}
