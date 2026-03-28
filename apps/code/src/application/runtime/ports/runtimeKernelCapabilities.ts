import type { KernelCapabilityDescriptor } from "@ku0/code-runtime-host-contract";
import { getRuntimeClient } from "../runtimeClient";

export async function listRuntimeKernelCapabilities(): Promise<KernelCapabilityDescriptor[]> {
  return getRuntimeClient().kernelCapabilitiesListV2();
}
