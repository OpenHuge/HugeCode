# Sandbox Platform Matrix

This document tracks restricted runtime isolation support. It is separate from desktop packaging support.

## Desktop Packaging Coverage

| Platform            | PR Desktop Verify | Release Packaging | Notes                                                         |
| ------------------- | ----------------- | ----------------- | ------------------------------------------------------------- |
| macOS Apple Silicon | Yes               | Yes               | Primary macOS PR target.                                      |
| macOS Intel         | No                | Yes               | Release-only to keep PR runtime lower.                        |
| Windows x64         | Yes               | Yes               | Uses Tauri Windows host checks plus NSIS packaging.           |
| Windows ARM64       | Yes               | Yes               | PR verifies compile/link and release packages NSIS artifacts. |
| Linux x64           | Yes               | Yes               | Uses deb/appimage packaging in release workflows.             |
| Linux ARM64         | No                | Yes               | Release-only packaging target.                                |

## Restricted Sandbox Coverage

| Platform | Isolation                       | Status             | Notes                                                                                                              |
| -------- | ------------------------------- | ------------------ | ------------------------------------------------------------------------------------------------------------------ |
| macOS    | Seatbelt (`sandbox-exec`)       | Partial            | Generates Seatbelt profiles and runs commands via `sandbox-exec`.                                                  |
| Linux    | Landlock + seccomp + namespaces | Partial            | Landlock enforces write access to allowed roots; seccomp blocks non-UNIX sockets when network is not `full`.       |
| Windows  | AppContainer                    | Stub (fail-closed) | Restricted policies return an error so callers can fall back to Docker/WSL instead of pretending isolation exists. |

## Enforcement Notes

- Path normalization uses `realpath`-style canonicalization where possible.
- Allowlist network enforcement is not implemented; `allowlist` is treated as `none` for OS-level enforcement.
- Workspace isolation assumes `workingDirectory` is set; otherwise file actions are denied.
- Windows restricted sandbox configs fail fast; Docker/WSL fallback is the current explicit escape hatch, not an implicit best-effort behavior.
- `fsAccess=read-only` blocks write-like file actions and applies read-only filesystem enforcement where supported.
- Runtime mapping: `read-only` access mode -> `fsAccess=read-only`; `on-request` -> `fsAccess=read-write`; `full-access` bypasses sandbox at caller layer.
