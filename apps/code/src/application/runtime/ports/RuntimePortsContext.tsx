import type { ReactNode } from "react";
import { createContext } from "react";
import { RuntimeKernelProvider } from "../kernel/RuntimeKernelContext";
import type { RuntimeKernel } from "../kernel/runtimeKernelTypes";
import { type RuntimePorts, runtimePorts } from "./runtimePorts";

export const RuntimePortsContext = createContext<RuntimePorts>(runtimePorts);

type RuntimePortsProviderProps = {
  children?: ReactNode;
  kernel?: RuntimeKernel;
  value?: RuntimePorts;
};

export function RuntimePortsProvider({ children, kernel, value }: RuntimePortsProviderProps) {
  return (
    <RuntimeKernelProvider value={kernel}>
      <RuntimePortsContext.Provider value={value ?? runtimePorts}>
        {children}
      </RuntimePortsContext.Provider>
    </RuntimeKernelProvider>
  );
}
