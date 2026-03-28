import { describe, expect, it } from "vitest";
import {
  leaveDeactivatedChatgptWorkspaces,
  reviewDeactivatedChatgptWorkspaces,
} from "./chatgptWorkspaceAutomation";
import * as chatgptWorkspaceAutomationFacade from "./chatgptWorkspaceAutomationFacade";

describe("chatgptWorkspaceAutomationFacade", () => {
  it("re-exports the approved settings-facing automation actions", () => {
    expect(chatgptWorkspaceAutomationFacade.reviewDeactivatedChatgptWorkspaces).toBe(
      reviewDeactivatedChatgptWorkspaces
    );
    expect(chatgptWorkspaceAutomationFacade.leaveDeactivatedChatgptWorkspaces).toBe(
      leaveDeactivatedChatgptWorkspaces
    );
  });
});
