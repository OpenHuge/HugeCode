export function renderCheckMessage(prefix, message) {
  return `[${prefix}] ${message}`;
}

export function writeLines(stream, lines) {
  for (const line of lines) {
    stream.write(`${line}\n`);
  }
}

export function writeCheckJson({ check, ok, errors = [], warnings = [], details }) {
  const payload = {
    ok,
    check,
    errors: [...errors],
  };

  if (warnings.length > 0) {
    payload.warnings = [...warnings];
  }
  if (details !== undefined) {
    payload.details = details;
  }

  process.stdout.write(`${JSON.stringify(payload, null, 2)}\n`);
}
