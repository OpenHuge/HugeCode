export type RetryScheduleInfo = {
  attempt: number;
  delayMs: number;
};

type ExponentialRetrySchedulerOptions = {
  baseDelayMs: number;
  maxDelayMs: number;
  onRetry: (info: RetryScheduleInfo) => void;
  onSchedule?: (info: RetryScheduleInfo) => void;
};

export type ExponentialRetryScheduler = {
  schedule: () => RetryScheduleInfo | null;
  clear: () => void;
  reset: () => void;
  hasPendingRetry: () => boolean;
  getAttempt: () => number;
};

export function createExponentialRetryScheduler(
  options: ExponentialRetrySchedulerOptions
): ExponentialRetryScheduler {
  let attempt = 0;
  let timer: ReturnType<typeof setTimeout> | null = null;

  const clear = () => {
    if (timer !== null) {
      clearTimeout(timer);
      timer = null;
    }
  };

  const schedule = () => {
    if (timer !== null) {
      return null;
    }
    const nextAttempt = attempt + 1;
    const delayMs = Math.min(options.maxDelayMs, options.baseDelayMs * 2 ** attempt);
    const info: RetryScheduleInfo = { attempt: nextAttempt, delayMs };
    attempt = nextAttempt;
    options.onSchedule?.(info);
    timer = setTimeout(() => {
      timer = null;
      options.onRetry(info);
    }, delayMs);
    return info;
  };

  const reset = () => {
    clear();
    attempt = 0;
  };

  return {
    schedule,
    clear,
    reset,
    hasPendingRetry: () => timer !== null,
    getAttempt: () => attempt,
  };
}
