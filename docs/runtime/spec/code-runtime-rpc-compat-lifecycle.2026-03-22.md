# Code Runtime RPC Compat Lifecycle

- Contract version: `2026-03-22`
- Canonical source: `packages/code-runtime-host-contract/src/codeRuntimeRpc.ts`
- Compat source: `packages/code-runtime-host-contract/src/codeRuntimeRpcCompat.ts`
- Generated alongside the frozen RPC spec and Rust parity surfaces.

## Still Needed

- `accountId`
- `poolId`
- `previousAccountId`
- `chatgptWorkspaceId`
- `workspaceId`
- `forceOAuth`
- `sessionId`
- `requestId`
- `turnId`
- `threadId`
- `subscriptionId`
- `modelId`
- `reasonEffort`
- `serviceTier`
- `missionMode`
- `executionProfileId`
- `reviewProfileId`
- `validationPresetId`
- `defaultBackendId`
- `accessMode`
- `displayName`
- `dryRun`
- `fileId`
- `changeId`
- `branchName`
- `promptId`
- `targetScope`
- `skillId`
- `taskId`
- `backendId`
- `backendOperability`
- `integrationId`
- `extensionId`
- `resourceId`
- `approvalId`
- `executionMode`
- `requiredCapabilities`
- `maxSubtasks`
- `preferredBackendIds`
- `evaluationPlan`
- `representativeCommands`
- `componentCommands`
- `endToEndCommands`
- `samplePaths`
- `heldOutGuidance`
- `sourceSignals`
- `placementFallbackReasonCode`
- `resumeBackendId`
- `placementScoreBreakdown`
- `taskSource`
- `instructionPatch`
- `missionBrief`
- `relaunchContext`
- `autoDrive`
- `contextPolicy`
- `decisionPolicy`
- `scenarioProfile`
- `decisionTrace`
- `outcomeFeedback`
- `autonomyState`
- `autonomyPriority`
- `promptStrategy`
- `researchMode`
- `independentThread`
- `authoritySources`
- `authorityScope`
- `scenarioKeys`
- `safeBackground`
- `selectionTags`
- `selectedCandidateId`
- `selectedCandidateSummary`
- `scoreBreakdown`
- `reasonCode`
- `failureClass`
- `validationCommands`
- `humanInterventionRequired`
- `heldOutPreserved`
- `highPriority`
- `escalationPressure`
- `unattendedContinuationAllowed`
- `backgroundSafe`
- `humanInterventionHotspots`
- `representativeCommand`
- `maxConcurrency`
- `scopeProfile`
- `allowedSkillIds`
- `allowNetwork`
- `workspaceReadPaths`
- `parentRunId`
- `maxSubQueries`
- `costTier`
- `latencyClass`
- `maxParallel`
- `preferDomains`
- `recencyDays`
- `fetchPageContent`
- `workspaceContextPaths`
- `rolloutState`
- `trustTier`
- `dataSensitivity`
- `transportConfig`
- `allowedToolClasses`
- `rootTaskId`
- `parentTaskId`
- `childTaskIds`
- `missionLinkage`
- `reviewActionability`
- `reviewGate`
- `reviewFindings`
- `reviewRunId`
- `skillUsage`
- `autofixCandidate`
- `takeoverBundle`
- `executionGraph`
- `distributedStatus`
- `runSummary`
- `reviewPackSummary`
- `fromTaskId`
- `toTaskId`
- `requiresApproval`
- `approvalReason`
- `timeoutMs`
- `pollIntervalMs`
- `maxBytes`
- `maxItems`
- `usageRefresh`
- `redactionLevel`
- `includeTaskSummaries`
- `includeEventTail`
- `includeProviderDetails`
- `includeAgentTasks`
- `includeZipBase64`
- `codexBin`
- `codexArgs`
- `outputSchema`
- `approvalPolicy`
- `sandboxMode`
- `forceRefetch`
- `checkPackageAdvisory`
- `checkExecPolicy`
- `execPolicyRules`
- `includeScreenshot`
- `toolName`
- `expectedUpdatedAt`
- `contextPrefix`

These aliases remain part of the frozen cross-runtime compatibility surface.

## Soft Deprecated

- None

These aliases are still generated but should not gain new callers.

## Removable Now

- None

These entries are compatibility no-ops or fully superseded. Keep them visible until the next explicit compat prune window, then delete them from the TS registry and regenerate artifacts.
