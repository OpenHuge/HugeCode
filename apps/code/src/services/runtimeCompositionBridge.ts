import type {
  RuntimeCompositionProfile,
  RuntimeCompositionProfileSummaryV2,
  RuntimeCompositionResolveV2Response,
  RuntimeCompositionSnapshotPublishRequest,
  RuntimeCompositionSnapshotPublishResponse,
} from "@ku0/code-runtime-host-contract";
import { getRuntimeClient } from "./runtimeClient";

export async function listRuntimeCompositionProfilesV2(input: {
  workspaceId: string;
}): Promise<RuntimeCompositionProfileSummaryV2[]> {
  return getRuntimeClient().runtimeCompositionProfileListV2(input);
}

export async function getRuntimeCompositionProfileV2(input: {
  workspaceId: string;
  profileId: string;
}): Promise<RuntimeCompositionProfile | null> {
  return getRuntimeClient().runtimeCompositionProfileGetV2(input);
}

export async function resolveRuntimeCompositionV2(input: {
  workspaceId: string;
  profileId?: string | null;
  launchOverride?: import("@ku0/code-application").RuntimeCompositionProfileLaunchOverride | null;
}): Promise<RuntimeCompositionResolveV2Response> {
  return getRuntimeClient().runtimeCompositionProfileResolveV2(input);
}

export async function publishRuntimeCompositionSnapshotV1(
  input: RuntimeCompositionSnapshotPublishRequest
): Promise<RuntimeCompositionSnapshotPublishResponse> {
  return getRuntimeClient().runtimeCompositionSnapshotPublishV1(input);
}
