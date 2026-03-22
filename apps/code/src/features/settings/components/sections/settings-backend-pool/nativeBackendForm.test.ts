import { describe, expect, it } from "vitest";
import {
  createEmptyNativeBackendFormState,
  mapNativeBackendToFormState,
  mapNativeFormStateToUpsertInput,
} from "./nativeBackendForm";

describe("nativeBackendForm", () => {
  it("uses explicit backend policy defaults for new drafts", () => {
    expect(createEmptyNativeBackendFormState()).toMatchObject({
      trustTier: "standard",
      dataSensitivity: "internal",
      approvalPolicy: "checkpoint-required",
      allowedToolClassesText: "read\nwrite",
    });
  });

  it("maps backend policy to and from the native backend form", () => {
    const formState = mapNativeBackendToFormState({
      backendId: "backend-a",
      label: "Backend A",
      state: "enabled",
      policy: {
        trustTier: "trusted",
        dataSensitivity: "restricted",
        approvalPolicy: "never-auto-approve",
        allowedToolClasses: ["read", "network", "browser"],
      },
    });

    expect(formState).toMatchObject({
      trustTier: "trusted",
      dataSensitivity: "restricted",
      approvalPolicy: "never-auto-approve",
      allowedToolClassesText: "read\nnetwork\nbrowser",
    });

    expect(
      mapNativeFormStateToUpsertInput({
        ...formState,
        capabilitiesText: "general\ncode",
        maxConcurrency: "2",
      })
    ).toMatchObject({
      policy: {
        trustTier: "trusted",
        dataSensitivity: "restricted",
        approvalPolicy: "never-auto-approve",
        allowedToolClasses: ["read", "network", "browser"],
      },
    });
  });
});
