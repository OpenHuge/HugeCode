import type { LayoutNodesOptions, LayoutNodesResult } from "./types";
import { buildComposerNode } from "./buildComposerNode";
import { buildMessagesNode } from "./buildMessagesNode";
import { buildPrimaryChromeNodes } from "./buildPrimaryChromeNodes";
import { buildSidebarNode } from "./buildSidebarNode";

type PrimaryLayoutNodes = Pick<
  LayoutNodesResult,
  | "sidebarNode"
  | "messagesNode"
  | "composerNode"
  | "approvalToastsNode"
  | "updateToastNode"
  | "errorToastsNode"
  | "homeNode"
  | "missionOverviewNode"
  | "mainHeaderNode"
  | "desktopTopbarLeftNode"
  | "desktopTopbarRightNode"
  | "tabBarNode"
>;

export { buildSidebarNode } from "./buildSidebarNode";
export { buildMessagesNode } from "./buildMessagesNode";
export { buildComposerNode } from "./buildComposerNode";
export { buildPrimaryChromeNodes } from "./buildPrimaryChromeNodes";

export function buildPrimaryNodes(options: LayoutNodesOptions): PrimaryLayoutNodes {
  return {
    sidebarNode: buildSidebarNode(options),
    messagesNode: buildMessagesNode(options),
    composerNode: buildComposerNode(options),
    ...buildPrimaryChromeNodes(options),
  };
}
