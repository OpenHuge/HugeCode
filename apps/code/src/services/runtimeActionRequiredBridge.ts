import { getRuntimeClient, type ActionRequiredSubmitRequest } from "./runtimeClient";

export async function actionRequiredGetV2(requestId: string) {
  return getRuntimeClient().actionRequiredGetV2(requestId);
}

export async function actionRequiredSubmitV2(request: ActionRequiredSubmitRequest) {
  return getRuntimeClient().actionRequiredSubmitV2(request);
}
