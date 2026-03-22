type DateInput = string | number | Date;

function toValidDate(value: DateInput | null | undefined): Date | null {
  if (value === null || value === undefined) {
    return null;
  }
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    return null;
  }
  return date;
}

function formatDateValue(
  value: DateInput | null | undefined,
  formatter: Intl.DateTimeFormat,
  fallback: string
): string {
  const date = toValidDate(value);
  return date ? formatter.format(date) : fallback;
}

const DATE_TIME_FORMATTER = new Intl.DateTimeFormat(undefined, {
  dateStyle: "medium",
  timeStyle: "short",
});

const DATE_FORMATTER = new Intl.DateTimeFormat(undefined, {
  dateStyle: "medium",
});

const SHORT_DATE_FORMATTER = new Intl.DateTimeFormat(undefined, {
  month: "short",
  day: "numeric",
});

export function formatDateTime(value: DateInput | null | undefined, fallback = "—"): string {
  return formatDateValue(value, DATE_TIME_FORMATTER, fallback);
}

export function formatDate(value: DateInput | null | undefined, fallback = "—"): string {
  return formatDateValue(value, DATE_FORMATTER, fallback);
}

export function formatShortDate(value: DateInput | null | undefined, fallback = "—"): string {
  return formatDateValue(value, SHORT_DATE_FORMATTER, fallback);
}
