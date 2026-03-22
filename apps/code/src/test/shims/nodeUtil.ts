type DeprecatedFunction<T extends (...args: any[]) => any> = T & {
  __deprecatedMessage__?: string;
};

export function deprecate<T extends (...args: any[]) => any>(
  fn: T,
  message?: string
): DeprecatedFunction<T> {
  const wrapped = ((...args: Parameters<T>) => fn(...args)) as DeprecatedFunction<T>;
  if (message) {
    wrapped.__deprecatedMessage__ = message;
  }
  return wrapped;
}

const utilShim = {
  deprecate,
};

export default utilShim;
