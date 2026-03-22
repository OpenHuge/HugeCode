export type ComposerFooterLayoutMode = "full" | "compact" | "minimal";

export type ComposerFooterLayout = {
  mode: ComposerFooterLayoutMode;
  showInlineExpand: boolean;
  showInlineQueue: boolean;
};

export function resolveComposerFooterLayout({
  width,
  hasExpandControl,
  hasQueueControl,
}: {
  width: number | null;
  hasExpandControl: boolean;
  hasQueueControl: boolean;
}): ComposerFooterLayout {
  if (!width || width <= 0) {
    return {
      mode: "full",
      showInlineExpand: hasExpandControl,
      showInlineQueue: hasQueueControl,
    };
  }

  const compactThreshold = hasQueueControl ? 700 : 640;
  const minimalThreshold = hasQueueControl ? 620 : 560;

  if (width <= minimalThreshold) {
    return {
      mode: "minimal",
      showInlineExpand: false,
      showInlineQueue: false,
    };
  }
  if (width <= compactThreshold) {
    return {
      mode: "compact",
      showInlineExpand: false,
      showInlineQueue: hasQueueControl,
    };
  }
  return {
    mode: "full",
    showInlineExpand: hasExpandControl,
    showInlineQueue: hasQueueControl,
  };
}
