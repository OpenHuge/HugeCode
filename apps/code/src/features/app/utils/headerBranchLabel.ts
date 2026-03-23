const HEADER_BRANCH_LABEL_MAX_CHARS = 32;
const ELLIPSIS = "…";

function truncateMiddle(value: string, maxChars: number) {
  if (maxChars <= 0) {
    return "";
  }
  if (value.length <= maxChars) {
    return value;
  }
  if (maxChars === 1) {
    return ELLIPSIS;
  }
  if (maxChars === 2) {
    return `${value.slice(0, 1)}${ELLIPSIS}`;
  }

  const visibleChars = maxChars - ELLIPSIS.length;
  const leadingChars = Math.ceil(visibleChars / 2);
  const trailingChars = Math.floor(visibleChars / 2);
  return `${value.slice(0, leadingChars)}${ELLIPSIS}${value.slice(value.length - trailingChars)}`;
}

export function formatHeaderBranchLabel(
  branchName: string,
  maxChars = HEADER_BRANCH_LABEL_MAX_CHARS
) {
  const normalizedBranchName = branchName.trim();
  if (normalizedBranchName.length <= maxChars) {
    return normalizedBranchName;
  }

  const segments = normalizedBranchName.split("/").filter((segment) => segment.length > 0);
  if (segments.length < 2) {
    return truncateMiddle(normalizedBranchName, maxChars);
  }

  const firstSegment = segments[0]!;
  const secondSegment = segments[1]!;
  const lastSegment = segments[segments.length - 1]!;
  const candidates: string[] = [];

  if (segments.length === 2) {
    const prefix = `${firstSegment}/`;
    if (prefix.length < maxChars - 1) {
      candidates.push(`${prefix}${truncateMiddle(lastSegment, maxChars - prefix.length)}`);
    }
  }

  if (segments.length === 3) {
    const prefix = `${firstSegment}/${secondSegment}/`;
    if (prefix.length < maxChars - 1) {
      candidates.push(`${prefix}${truncateMiddle(lastSegment, maxChars - prefix.length)}`);
    }
  }

  if (segments.length >= 4) {
    const prefix = `${firstSegment}/${secondSegment}/${ELLIPSIS}/`;
    if (prefix.length < maxChars - 1) {
      candidates.push(`${prefix}${truncateMiddle(lastSegment, maxChars - prefix.length)}`);
    }
  }

  const compactPrefix = `${firstSegment}/${ELLIPSIS}/`;
  if (compactPrefix.length < maxChars - 1) {
    candidates.push(
      `${compactPrefix}${truncateMiddle(lastSegment, maxChars - compactPrefix.length)}`
    );
  }

  return (
    candidates.find(
      (candidate) => candidate.length <= maxChars && candidate.length < normalizedBranchName.length
    ) ?? truncateMiddle(normalizedBranchName, maxChars)
  );
}
