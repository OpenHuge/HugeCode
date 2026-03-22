# Web OAuth Durable Binding State Machine

This note defines the fail-closed state model for the `apps/code` OAuth bridge.

## State machine

`idle -> authorizing -> binding -> bound | failed`

## State definitions

| State         | Meaning                                                                                                                                     | Durable boundary                                                                                                    |
| ------------- | ------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| `idle`        | No active OAuth attempt. No account or workspace binding has been started.                                                                  | No durable write has happened.                                                                                      |
| `authorizing` | The client has started the OAuth flow and is waiting for the runtime-backed provider exchange to complete.                                  | No durable binding may be assumed yet. Popup completion, callback receipt, or token exchange alone are not success. |
| `binding`     | Runtime-backed persistence is writing or verifying the durable account record, default workspace membership, and workspace/session binding. | This is the only pre-success window where durable state is allowed to change.                                       |
| `bound`       | The runtime has durably persisted the account/workspace binding and the bridge can read it back through runtime-backed APIs.                | Success is only reported after the durable write and verification complete.                                         |
| `failed`      | OAuth start, callback handling, durable persistence, or binding verification failed.                                                        | No connected/account-bound UI state may be shown. Recovery requires a fresh runtime-backed attempt.                 |

## Fail-closed rules

- Web OAuth must never degrade to temporary local or mock session state in product runtime paths.
- Account ownership, default workspace, route/account selection, and workspace-aware session binding may only be reported from `bound`.
- Any runtime outage, timeout, missing endpoint, or unsupported binding method transitions to `failed`.
- `failed` must surface an observable error explaining that authentication is not complete and no durable binding was written.

## Persistence boundary

The durable boundary sits between `binding` and `bound`.

- Before the boundary: UI may show in-progress or failed authentication, but must not show a connected account/workspace state.
- After the boundary: runtime-backed reads such as account inventory, primary/default workspace, and workspace-aware pool selection are the source of truth.

## Recovery semantics

- Retry after a transient runtime outage starts from `failed -> authorizing`.
- Successful recovery requires a fresh runtime-backed bind and read-back verification.
- Reusing an existing account without forcing OAuth is only valid when runtime-backed account inventory already contains a usable credential.
