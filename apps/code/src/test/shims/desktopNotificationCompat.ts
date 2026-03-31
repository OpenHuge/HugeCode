export async function isPermissionGranted() {
  return true;
}

export async function requestPermission() {
  return "granted" as const;
}

export async function sendNotification(_input: Record<string, unknown>) {}
