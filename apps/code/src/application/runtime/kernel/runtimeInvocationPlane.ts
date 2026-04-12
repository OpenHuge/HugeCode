import type {
  RuntimeInvocationDispatchRequest,
  RuntimeInvocationDispatchResponse,
  RuntimeInvocationHostRegistry,
  RuntimeInvocationHostsListRequest,
} from "@ku0/code-runtime-host-contract";

export type RuntimeInvocationPlaneFacade = {
  listHosts: (
    request?: RuntimeInvocationHostsListRequest
  ) => Promise<RuntimeInvocationHostRegistry>;
  dispatch: (
    request: RuntimeInvocationDispatchRequest
  ) => Promise<RuntimeInvocationDispatchResponse>;
};

export function createRuntimeInvocationPlaneFacade(input: {
  workspaceId: string;
  listHosts: (
    request?: RuntimeInvocationHostsListRequest
  ) => Promise<RuntimeInvocationHostRegistry>;
  dispatch: (
    request: RuntimeInvocationDispatchRequest
  ) => Promise<RuntimeInvocationDispatchResponse>;
}): RuntimeInvocationPlaneFacade {
  return {
    listHosts: (request = {}) =>
      input.listHosts({
        workspaceId: request.workspaceId ?? input.workspaceId,
      }),
    dispatch: (request) =>
      input.dispatch({
        ...request,
        workspaceId: request.workspaceId ?? input.workspaceId,
      }),
  };
}
