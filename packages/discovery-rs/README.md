# @ku0/discovery-rs

`@ku0/discovery-rs` provides HugeCode's native mDNS discovery bindings.

The TypeScript package exposes a browser-safe fallback entrypoint and a Node
entrypoint that loads the compiled native binding when native accelerators are
enabled.

Key files:

- [src/index.ts](./src/index.ts): browser-safe fallback exports
- [src/node.ts](./src/node.ts): Node native-binding loader
- [Cargo.toml](./Cargo.toml): Rust crate metadata for the native binding

The Rust crate is intentionally `publish = false`; the npm package is the public
distribution surface.
