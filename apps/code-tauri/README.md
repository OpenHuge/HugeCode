# apps/code-tauri

`apps/code-tauri` is the Rust/Tauri desktop shell for `apps/code`.

## Scope in this scaffold

- Tauri app host wired to `apps/code` dev/build output.
- Initial Rust command surface for health, workspace, thread, turn, model, remote, terminal, and settings domains.
- Terminal commands run in subprocess mode (command-per-write, no PTY stream persistence yet).

## Commands

- `pnpm --filter @ku0/code-tauri dev`
- `pnpm --filter @ku0/code-tauri build`
- `pnpm --filter @ku0/code-tauri check` (fast wrapper: shared target dir + optional sccache + no-change skip)
- `pnpm --filter @ku0/code-tauri check:raw` (always run `cargo check`, but still applies shared-target guardrails)

## Windows support

- Run `pnpm desktop:doctor:windows` before local Windows build/verify work. It checks MSVC, Windows SDK, Rust target, PowerShell, and WebView2 presence.
- Run `pnpm desktop:verify:windows` for x64 and `pnpm desktop:verify:windows:arm64` for ARM64 before release-sensitive Windows changes.
- Use `pnpm desktop:build:windows` for the default x64 NSIS installer and `pnpm desktop:build:windows:msi` when enterprise MSI deployment is needed.
- Use `pnpm desktop:build:windows:arm64` for the default ARM64 NSIS installer.
- Use `pnpm desktop:build:windows:store` for Store/offline distribution. That command layers `src-tauri/tauri.windows.store.conf.json` on top of the base Tauri config and switches WebView2 to offline installer mode.
- Use `pnpm desktop:build:windows:arm64:store` for ARM64 Store/offline distribution.
- Base Windows bundles use `embedBootstrapper` WebView2 mode to reduce first-run install failures on developer and end-user machines.
- CI desktop coverage stays asymmetric by design: PRs verify macOS Apple Silicon, Windows x64, Windows ARM64, and Linux x64, while release builds add macOS Intel and Linux ARM64 packaging.

## Build cache tuning

- Default Rust builds now share the repo cache at `.cache/cargo-target`, so `tauri dev`, `tauri build`, runtime service dev, native package builds, and guarded cargo commands can reuse the same compiled dependencies by default.
- `CARGO_TARGET_DIR=/path/to/shared/target`: override shared Rust target cache.
- `HUGECODE_CARGO_TARGET_MAX_SIZE_MB=6144`: clear the shared target cache when it grows beyond this budget.
- `HUGECODE_CARGO_TARGET_MIN_FREE_MB=4096`: clear the shared target cache before builds when free disk drops below this budget.
- `HUGECODE_CARGO_TARGET_HARD_MIN_FREE_MB=2048`: abort guarded builds early if disk is still critically low after cleanup.
- `HUGECODE_CARGO_TARGET_GUARD=0`: disable the shared target guard for one-off debugging sessions.
- `CODE_TAURI_CHECK_FORCE=1`: force check even when source/config hash is unchanged.
- `RUSTC_WRAPPER=/path/to/sccache`: explicitly set compiler cache wrapper (auto-detected when available for guarded Rust builds).
