type RuntimeOperatorActionLike = {
  detail?: string | null;
  label?: string | null;
};

function readOptionalText(value: string | null | undefined) {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

export function readRuntimeOperatorActionText(
  operatorAction: RuntimeOperatorActionLike | null | undefined
) {
  return readOptionalText(operatorAction?.detail) ?? readOptionalText(operatorAction?.label);
}

export function resolveRuntimeRecommendedAction(input: {
  operatorAction?: RuntimeOperatorActionLike | null;
  fallbacks: Array<string | null | undefined>;
}) {
  const operatorActionDetail = readOptionalText(input.operatorAction?.detail);
  if (operatorActionDetail) {
    return operatorActionDetail;
  }
  for (const fallback of input.fallbacks) {
    const text = readOptionalText(fallback);
    if (text) {
      return text;
    }
  }
  return readOptionalText(input.operatorAction?.label);
}
