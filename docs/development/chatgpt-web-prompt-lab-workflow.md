# ChatGPT Web Prompt Lab Workflow

> Status: Active workflow specification
> Scope: Prompt design and refinement on ChatGPT web before execution in Codex or other coding agents
> Verification date: 2026-03-22

## Purpose

This specification defines a low-overhead workflow for using ChatGPT on the web to produce stronger prompts with more divergent exploration and tighter final phrasing than the default Codex-in-the-loop drafting flow.

The workflow is designed to:

- keep long prompts from being split into multiple messages
- make output format stable and machine-extractable
- reduce Codex browser-tool token consumption
- keep prompt ideation and refinement on the ChatGPT web side
- hand only the final prompt to Codex for repo execution

## Non-Goals

This workflow does not define:

- repo audit logic itself
- Codex execution strategy after the final prompt is produced
- mobile-browser support
- ChatGPT account, billing, or admin policy setup

## Source Basis

This workflow combines official product guidance with browser-side verification performed in the current logged-in ChatGPT session.

### Official sources

- [Projects in ChatGPT](https://help.openai.com/en/articles/10169521-using-projects-in-chatgpt)
- [What is the canvas feature in ChatGPT and how do I use it?](https://help.openai.com/en/articles/9930697)
- [ChatGPT Custom Instructions](https://help.openai.com/en/articles/8096356-custom-instructionsfor-chatgpt)
- [Using Codex with your ChatGPT plan](https://help.openai.com/en/articles/11369540-icodex-in-chatgpt)

### Verified runtime observations

The following behavior was verified in the browser session used for this task:

- a dedicated Project can be created and entered
- a long prompt can be sent as one message when the composer is filled in one operation and sent separately
- ChatGPT can be constrained to return a single fenced Markdown code block
- a page-local `MutationObserver` can detect response completion without repeated DOM snapshot polling
- the final code block can be extracted once after completion

## Working Definition

The Prompt Lab workflow is a two-surface process:

1. ChatGPT web handles prompt exploration, restructuring, and final phrasing.
2. Codex handles repo-aware execution, verification, and code changes.

The web workflow should finish with a single final prompt artifact, usually a fenced Markdown code block, that can be handed off to Codex with minimal additional editing.

## Recommended Surface Model

### Primary surface: Project

Use a dedicated ChatGPT Project such as `Prompt Lab`.

Rationale:

- Projects keep related chats together.
- Projects can hold uploaded reference material.
- Projects support project-scoped instructions, which reduces repeated boilerplate in each prompt.

### Secondary surface: Canvas

Use Canvas for long prompt drafting and refinement when the prompt is expected to:

- exceed a short one-shot rewrite
- benefit from iterative restructuring
- need exportable Markdown output
- require multiple revision passes

Canvas can be explicitly triggered with prompts such as `use canvas` or `open a canvas`.

## Recommended Operating Model

### Phase 1: Project setup

Create a dedicated project for prompt work. Recommended name:

- `Prompt Lab`

Recommended project-scoped instructions:

- default to concise, copyable outputs
- when optimizing prompts, return only the final artifact unless explicitly asked to compare options
- prefer fenced Markdown code blocks for reusable prompt output
- do not prepend explanations unless requested
- preserve task constraints and architecture rules

Keep these instructions short. Long standing rules belong in project instructions, not repeated in every prompt.

### Phase 2: Prompt submission

For each prompt-design task:

1. Open a new chat inside the project.
2. If the prompt is long or will require multiple passes, include `use canvas`.
3. State strict output rules in the message itself:
   - return exactly one fenced Markdown code block
   - no explanation before or after the code block
   - optimize the prompt, do not answer the task itself
4. Paste the full source prompt as one message.

### Phase 3: Diverge then converge

Use ChatGPT web for prompt shaping, not repo execution.

Recommended pattern:

1. Diverge:
   Ask for 2 to 3 candidate prompt structures, or a stronger framing of the task.
2. Select:
   Choose the strongest direction.
3. Converge:
   Ask for one final version only, optimized for direct agent execution.
4. Normalize:
   Ask for the final output as one fenced Markdown code block.

### Phase 4: Handoff to Codex

Once the final prompt is stable:

1. Copy the final code block.
2. Pass it to Codex.
3. Let Codex perform repo-aware execution, review, or editing.

## Browser Automation Specification

This section defines the preferred automation behavior when an agent is operating ChatGPT web through browser tools.

### Input rules

For long prompts, the browser agent must:

1. write the entire prompt with a single fill operation
2. send the message with a separate click on the send control

The browser agent must not:

- simulate long, character-by-character typing for prompt bodies
- rely on `Enter` for multiline composition
- combine input and send into one keyboard-driven action

Reason:

- rich-text chat composers are prone to premature send behavior on long input
- line handling is less stable under keyboard simulation than direct fill
- repeated retries waste browser-tool tokens and pollute chat history

### Output rules

The sending prompt should explicitly constrain output format. Recommended hard requirements:

- return exactly one fenced Markdown code block
- do not include explanation, summary, or preamble
- optimize the prompt rather than answering the underlying domain task

### Completion detection rules

Do not use repeated full-page snapshots as the primary completion strategy.

Preferred completion detection:

1. Inject a page-local `MutationObserver`.
2. Watch for the disappearance of `Stop streaming`.
3. Watch for the appearance of either:
   - `Copy response`, or
   - a code-block `Copy` button
4. Resolve once the stop control is gone and a copy target exists.

This is the preferred low-token completion model because it pushes waiting into the page runtime instead of repeatedly re-reading the DOM through tool calls.

### Extraction rules

After completion is detected:

1. Extract once.
2. Prefer the last assistant code block.
3. If multiple code blocks exist, use the one nearest the latest response footer.
4. If no code block exists, treat the response as format failure and retry with stricter wording.

Avoid:

- partial extraction during streaming
- repeated polling snapshots to track token-by-token output
- parsing entire conversation text when only the final code block is needed

## Minimal Reliable Prompt Wrapper

Use a wrapper like this when asking ChatGPT web to refine a prompt:

```text
use canvas.

Return exactly one fenced Markdown code block.
Do not add any explanation before or after the code block.
Optimize the prompt only; do not answer the task itself.
Preserve all architecture and repo constraints.

<source prompt here>
```

If the project instructions already enforce most of the format rules, keep only the task-specific constraints in the message.

## Token Optimization Strategy

### Keep on ChatGPT web

Use ChatGPT web for:

- divergence
- reframing
- language refinement
- structure comparison
- final prompt compression

### Keep on Codex

Use Codex for:

- repo search
- code edits
- validation
- tests
- implementation verification

### Why this split is cheaper

Codex usage cost grows with task size, codebase size, and browser/tool interaction overhead. Prompt drafting is usually cheaper and more effective on the ChatGPT web side, while repo execution is where Codex provides the highest value.

## Failure Modes And Recovery

### Failure: prompt is split across multiple messages

Cause:

- keyboard-simulated multiline entry
- premature send during long input

Recovery:

- start a new chat
- re-send with single-fill plus explicit send click

### Failure: ChatGPT returns prose instead of one code block

Cause:

- output constraints too weak
- prior conversation context polluted the reply style

Recovery:

- start a new chat in the same project
- restate the hard output contract
- require exactly one fenced Markdown code block

### Failure: Canvas does not open

Cause:

- prompt did not strongly imply a long editing task

Recovery:

- explicitly add `use canvas`
- or send `open a canvas`

### Failure: completion detection does not fire

Cause:

- DOM labels changed
- completion conditions are too narrow

Recovery:

- broaden completion matching to include:
  - disappearance of `Stop streaming`
  - appearance of `Copy response`
  - appearance of code-block `Copy`

### Failure: project context becomes noisy

Cause:

- unrelated prompt design tasks share one project

Recovery:

- create separate projects by prompt family
- or prune old chats and sources

## Acceptance Criteria

This workflow is considered operational when all of the following are true:

1. A dedicated Project exists and is usable.
2. Long prompts can be sent as one message.
3. ChatGPT can be constrained to return one fenced Markdown code block.
4. Response completion can be detected with a page-local observer.
5. Final extraction can be done once after completion.
6. Browser-tool calls are lower than a snapshot-polling workflow.
7. The resulting prompts are strong enough to hand off directly to Codex.

## Preferred Default Workflow

Use this workflow by default:

1. Enter the dedicated prompt-design project.
2. Open a new chat.
3. Include `use canvas` for long prompt work.
4. Fill the prompt as one message.
5. Click send.
6. Run page-local completion detection with `MutationObserver`.
7. Wait for the stop control to disappear and copy targets to appear.
8. Extract the final code block once.
9. Hand the result to Codex.

## Implementation Notes

### Verified completion detector shape

The following logical completion rule was verified during this task:

- `Stop streaming` is no longer present
- `Copy response` is present

The observer approach returned a completed state from inside the page runtime rather than through external snapshot polling.

### Verified result extraction shape

The verified extraction flow was:

1. wait for completion
2. inspect code-block presence
3. read the final code block

This produced a stable final artifact without repeated intermediate reads.

## Future Hardening

If this workflow becomes a reusable internal automation:

1. save the project instruction template
2. save a standard prompt wrapper template
3. package the observer logic as a reusable browser snippet
4. package final code-block extraction as a reusable browser snippet
5. add one retry path for formatting failures
6. add quality checks for handoff readiness
