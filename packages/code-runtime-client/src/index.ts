/**
 * Shared runtime-client infrastructure is consumed through explicit subpath
 * exports such as `@ku0/code-runtime-client/runtimeErrorClassifier`.
 *
 * Keep the root entrypoint narrow so new code does not regress into another
 * wide aggregation surface.
 */
