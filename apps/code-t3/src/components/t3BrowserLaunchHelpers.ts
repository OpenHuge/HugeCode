export function hostLabel(url: string) {
  try {
    return new URL(url).hostname;
  } catch {
    return "New tab";
  }
}

export function isSecureUrl(url: string) {
  try {
    return new URL(url).protocol === "https:";
  } catch {
    return false;
  }
}
