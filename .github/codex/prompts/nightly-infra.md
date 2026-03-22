# Codex Nightly Infra Prompt

Review repository automation and CI health for regressions introduced in the latest commits.

Focus areas:

- GitHub Actions workflow correctness and runtime efficiency.
- Test/build command reliability and caching behavior.
- Flaky test signals or excessive job duration.
- Missing quality gates for changed critical paths.

Output:

1. A short list of high-severity findings with file paths.
2. Suggested fixes with minimal-diff guidance.
3. A concise risk summary for shipping.
