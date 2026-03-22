export function matchesHoldKey(event: KeyboardEvent, holdKey: string) {
  switch (holdKey) {
    case "alt":
      return event.key === "Alt";
    case "shift":
      return event.key === "Shift";
    case "control":
      return event.key === "Control";
    case "meta":
      return event.key === "Meta";
    default:
      return false;
  }
}

type ComposingEvent = {
  isComposing?: boolean;
  key?: string;
  keyCode?: number;
  which?: number;
  nativeEvent?: {
    isComposing?: boolean;
    key?: string;
    keyCode?: number;
    which?: number;
  };
};

export function isComposingEvent(event: ComposingEvent) {
  return Boolean(
    event.isComposing ||
    event.key === "Process" ||
    event.keyCode === 229 ||
    event.which === 229 ||
    event.nativeEvent?.isComposing ||
    event.nativeEvent?.key === "Process" ||
    event.nativeEvent?.keyCode === 229 ||
    event.nativeEvent?.which === 229
  );
}
