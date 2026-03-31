import { useEffect, useRef } from "react";
import type { Unsubscribe } from "../../../application/runtime/ports/events";

type Subscribe<T> = (handler: (payload: T) => void) => Unsubscribe;
type SubscribeVoid = (handler: () => void) => Unsubscribe;

type UseDesktopHostEventOptions = {
  enabled?: boolean;
};

export function useDesktopHostEvent(
  subscribe: SubscribeVoid,
  handler: () => void,
  options?: UseDesktopHostEventOptions
): void;
export function useDesktopHostEvent<T>(
  subscribe: Subscribe<T>,
  handler: (payload: T) => void,
  options?: UseDesktopHostEventOptions
): void;
export function useDesktopHostEvent<T>(
  subscribe: Subscribe<T> | SubscribeVoid,
  handler: ((payload: T) => void) | (() => void),
  options: UseDesktopHostEventOptions = {}
): void {
  const handlerRef = useRef<(payload: T) => void>(handler as (payload: T) => void);
  const enabled = options.enabled ?? true;

  useEffect(() => {
    handlerRef.current = handler as (payload: T) => void;
  }, [handler]);

  useEffect(() => {
    if (!enabled) {
      return;
    }
    const unlisten = (subscribe as Subscribe<T>)((payload: T) => {
      handlerRef.current(payload);
    });
    return () => {
      unlisten();
    };
  }, [enabled, subscribe]);
}
