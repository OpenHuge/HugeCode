import type { ReactNode } from "react";
import { createContext, useContext, useMemo } from "react";
import { createRuntimeKernel } from "./createRuntimeKernel";
import type { RuntimeKernel } from "./runtimeKernelTypes";

const RuntimeKernelContext = createContext<RuntimeKernel | null>(null);

type RuntimeKernelProviderProps = {
  children: ReactNode;
  value?: RuntimeKernel;
};

export function RuntimeKernelProvider({ children, value }: RuntimeKernelProviderProps) {
  const kernel = useMemo(() => value ?? createRuntimeKernel(), [value]);

  return <RuntimeKernelContext.Provider value={kernel}>{children}</RuntimeKernelContext.Provider>;
}

export function useRuntimeKernel(): RuntimeKernel {
  const kernel = useContext(RuntimeKernelContext);
  if (!kernel) {
    throw new Error("RuntimeKernelProvider is required.");
  }
  return kernel;
}
