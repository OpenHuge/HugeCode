import { cn } from "@ku0/shared/utils";

/**
 * Preserve the local helper name while delegating to the shared className utility.
 */
export function joinClassNames(...values: Parameters<typeof cn>): string {
  return cn(...values);
}
