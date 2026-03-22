#!/bin/bash

set -euo pipefail

# Check for hidden bidi control characters and BOM that can mask prompt injection
# or alter visible source representation. We intentionally do not flag ZWJ/ZWNJ
# because they are used in emoji tests.

PATTERN='[\x{200E}\x{200F}\x{202A}-\x{202E}\x{2066}-\x{2069}\x{FEFF}]'
EXCLUDES=(
  -g '!node_modules/**'
  -g '!.tmp/**'
  -g '!**/target/**'
  -g '!dist/**'
  -g '!build/**'
  -g '!out/**'
  -g '!coverage/**'
  -g '!test-results/**'
  -g '!test-logs/**'
  -g '!artifacts/**'
)

if command -v rg >/dev/null 2>&1; then
  set +e
  MATCHES=$(rg --pcre2 -n --hidden "${EXCLUDES[@]}" "$PATTERN" .)
  RG_STATUS=$?
  set -e
  if [ $RG_STATUS -eq 2 ]; then
    echo "Error: rg failed to scan for hidden characters." >&2
    exit 2
  fi
  if [ $RG_STATUS -eq 0 ]; then
    echo "Hidden bidi control characters or BOM detected:"
    echo "$MATCHES"
    exit 1
  fi
  echo "No hidden bidi control characters detected."
  exit 0
fi

if command -v python3 >/dev/null 2>&1; then
  python3 - <<'PY'
import os

chars = [
    0x200E, 0x200F,
    0x202A, 0x202B, 0x202C, 0x202D, 0x202E,
    0x2066, 0x2067, 0x2068, 0x2069,
    0xFEFF,
]
char_set = {chr(c) for c in chars}
skip_dirs = {
    ".git",
    "node_modules",
    ".tmp",
    "target",
    "dist",
    "build",
    "out",
    "coverage",
    "test-results",
    "test-logs",
    "artifacts",
}
binary_exts = {
    ".png", ".jpg", ".jpeg", ".gif", ".webp", ".pdf", ".zip", ".gz", ".tar", ".tgz",
    ".ico", ".icns", ".lock", ".mp4", ".mov", ".mp3", ".wav", ".woff", ".woff2",
    ".ttf", ".otf", ".wasm", ".bin", ".so", ".dylib", ".a", ".exe",
}

matches = []
for dirpath, dirnames, filenames in os.walk("."):
    rel_dir = os.path.relpath(dirpath, ".")
    if rel_dir == ".":
        rel_dir = ""
    dirnames[:] = [d for d in dirnames if d not in skip_dirs and not d.startswith(".cache") and d != ".next"]
    for name in filenames:
        if name.startswith("."):
            continue
        ext = os.path.splitext(name)[1].lower()
        if ext in binary_exts:
            continue
        path = os.path.join(dirpath, name)
        try:
            data = open(path, "rb").read()
        except Exception:
            continue
        try:
            text = data.decode("utf-8")
        except Exception:
            continue
        if any(ch in text for ch in char_set):
            for line_no, line in enumerate(text.splitlines(), 1):
                if any(ch in line for ch in char_set):
                    matches.append((path, line_no, line))
                    break

if matches:
    print("Hidden bidi control characters or BOM detected:")
    for path, line_no, line in matches:
        print(f\"{path}:{line_no}:{line}\")
    raise SystemExit(1)

print("No hidden bidi control characters detected.")
PY
  exit 0
fi

echo "Error: rg or python3 is required to run this check." >&2
exit 1
