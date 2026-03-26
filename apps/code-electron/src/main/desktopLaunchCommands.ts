export const DESKTOP_NEW_WINDOW_ARG = "--new-window";

export function hasDesktopNewWindowArg(argv: string[] | undefined) {
  return (argv ?? []).some((arg) => arg === DESKTOP_NEW_WINDOW_ARG);
}
