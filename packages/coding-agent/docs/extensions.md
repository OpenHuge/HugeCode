# Extensions

This package stages the Track 2 split between pure resource discovery and the runtime plugin host.

Current internal mapping:

- `DefaultResourceLoader` only discovers extension files and related resources.
- `PluginHost` owns extension activation, runtime registration, UI adapter injection, and reload.
- external extension entrypoints stay compatible with default-export factory functions.

The intended compatibility direction is:

- startup-phase concerns stay outside `PluginHost`
- session-phase concerns flow through `PluginHost`
- extension-owned `tool`, `command`, `provider`, `theme`, and prompt-fragment registration remain supported

This is a compatibility-first internal regrouping. It does not change the public extension directory layout.
