export async function relaunch() {
  if (typeof window === "undefined") {
    return;
  }
  window.location.reload();
}
