import { useRef } from "react";
import { buildGitNodes } from "./layoutNodes/buildGitNodes";
import {
  buildComposerNode,
  buildMessagesNode,
  buildPrimaryChromeNodes,
  buildSidebarNode,
} from "./layoutNodes/buildPrimaryNodes";
import { buildSecondaryNodes } from "./layoutNodes/buildSecondaryNodes";
import {
  flattenLayoutNodesOptions,
  type LayoutNodesFieldRegistry,
  type LayoutNodesOptions,
  type LayoutNodesResult,
} from "./layoutNodes/types";

const COMPOSER_LOCAL_LAYOUT_KEYS = [
  "draftText",
  "activeImages",
  "prefillDraft",
  "insertText",
  "activeQueue",
  "activeTokenUsage",
  "queuePausedReason",
] as const satisfies readonly (keyof LayoutNodesFieldRegistry)[];

function areLayoutFieldsEqual(
  previous: LayoutNodesFieldRegistry,
  next: LayoutNodesFieldRegistry,
  ignoredKeys: ReadonlySet<keyof LayoutNodesFieldRegistry>
) {
  for (const key of Object.keys(previous) as Array<keyof LayoutNodesFieldRegistry>) {
    if (ignoredKeys.has(key)) {
      continue;
    }
    if (previous[key] !== next[key]) {
      return false;
    }
  }
  return true;
}

function useStableLayoutNode<T>(
  build: () => T,
  fields: LayoutNodesFieldRegistry,
  ignoredKeys: readonly (keyof LayoutNodesFieldRegistry)[] = []
) {
  const cacheRef = useRef<{
    fields: LayoutNodesFieldRegistry;
    ignoredKeys: ReadonlySet<keyof LayoutNodesFieldRegistry>;
    value: T;
  } | null>(null);
  const ignoredKeySet = new Set(ignoredKeys);

  if (
    cacheRef.current === null ||
    !areLayoutFieldsEqual(cacheRef.current.fields, fields, ignoredKeySet)
  ) {
    cacheRef.current = {
      fields,
      ignoredKeys: ignoredKeySet,
      value: build(),
    };
  }

  return cacheRef.current.value;
}

export function useLayoutNodes(options: LayoutNodesOptions): LayoutNodesResult {
  const flatOptions = flattenLayoutNodesOptions(options);
  const sidebarNode = useStableLayoutNode(
    () => buildSidebarNode(options),
    flatOptions,
    COMPOSER_LOCAL_LAYOUT_KEYS
  );
  const messagesNode = useStableLayoutNode(
    () => buildMessagesNode(options),
    flatOptions,
    COMPOSER_LOCAL_LAYOUT_KEYS
  );
  const composerNode = useStableLayoutNode(() => buildComposerNode(options), flatOptions);
  const primaryChromeNodes = useStableLayoutNode(
    () => buildPrimaryChromeNodes(options),
    flatOptions,
    COMPOSER_LOCAL_LAYOUT_KEYS
  );
  const gitNodes = useStableLayoutNode(
    () => buildGitNodes(options),
    flatOptions,
    COMPOSER_LOCAL_LAYOUT_KEYS
  );
  const secondaryNodes = useStableLayoutNode(
    () => buildSecondaryNodes(options),
    flatOptions,
    COMPOSER_LOCAL_LAYOUT_KEYS
  );

  return {
    sidebarNode,
    messagesNode,
    composerNode,
    ...primaryChromeNodes,
    ...gitNodes,
    rightPanelGitNode: null,
    rightPanelFilesNode: null,
    rightPanelPromptsNode: null,
    ...secondaryNodes,
  };
}
