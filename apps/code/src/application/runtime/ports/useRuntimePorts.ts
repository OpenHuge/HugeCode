import { useContext } from "react";
import { RuntimePortsContext } from "./RuntimePortsContext";

export function useRuntimePorts() {
  return useContext(RuntimePortsContext);
}
