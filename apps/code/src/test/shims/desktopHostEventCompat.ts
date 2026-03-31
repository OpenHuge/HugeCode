export type UnlistenFn = () => void;

export async function listen<T>(
  _eventName: string,
  _listener: (event: { payload: T }) => void
): Promise<UnlistenFn> {
  return () => undefined;
}
