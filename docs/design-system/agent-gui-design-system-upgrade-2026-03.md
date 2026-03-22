# Agent GUI Design System Upgrade

Updated: 2026-03-11

## Research Summary

Reference study focused on `linear.app` and `chatgpt.com`, extracting system rules instead of copying brand assets.

### Core principles

1. Keep the global chrome stable. Sidebar, top bar, content, composer, and inspector should not visually compete.
2. Use surface layering sparingly. Most structure should come from spacing, border hierarchy, and section framing instead of many floating cards.
3. Reserve strong contrast for actions and states that matter now: active selection, focused input, running work, blocking errors.
4. Keep navigation dense and content readable. Sidebars can be compact; conversation, logs, and diffs need more line-height and padding.
5. Let input stay visually privileged. The composer should read as the main control surface, not as one more card in a pile.
6. Favor predictable interaction contracts. Same hover, pressed, focus, disabled, and loading semantics across button, row, tab, and menu.
7. Use restrained status color. Color should support labels, icons, and structure; it should not carry all meaning alone.
8. Make long-running work legible. Running, queued, thinking, streaming, success, failure, cancelled, and offline states need distinct container and text treatment.
9. Treat logs, code, and diff as first-class content types. They need dedicated tokens instead of inheriting generic prose styling.
10. Dark mode should preserve contrast order, not merely invert colors.
11. Prefer reusable primitives over page-private style islands.
12. Dense products still need rhythm. Repeated spacing, radius, and control heights are what make high-information UI feel calm.

### Anti-patterns to avoid

- Layering every region as a separate elevated card.
- Using raw color literals directly in page styles.
- Making selection rely on background color only.
- Mixing multiple radius scales and unrelated control heights.
- Letting row, tab, button, and menu hover states drift apart.
- Encoding component behavior in page-local class overrides.
- Treating dark mode as an afterthought with scattered overrides.
- Overusing shadow, blur, or glass effects in work-heavy screens.

## System Strategy

### Token model

Use a three-tier token system:

1. Primitive tokens: raw scales for color, type, space, size, radius, border, shadow, motion, and layers.
2. Semantic alias tokens: app-facing meanings such as `bg.panel`, `text.secondary`, `border.strong`, `state.running`, `diff.insert`.
3. Component tokens: only where interaction semantics need stable bindings, such as button, input, card, panel, popover, toast, select, diff, and layout widths.

### Product fit for an AI coding agent GUI

- Multi-pane layouts need explicit layout width tokens for sidebar, content, inspector, and composer.
- Execution-heavy UI needs state tokens for run lifecycle and review surfaces.
- File, artifact, log, and diff views should share the same contrast model and code typography.
- Dense operational rows need compact spacing without collapsing click targets or readability.

### Migration rules

1. Build token and bridge layers before broad page restyling.
2. Prefer low-risk aliasing over hard rewrites when old surfaces still depend on legacy `--ds-*` variables.
3. Upgrade base controls first so page migrations inherit better defaults.
4. Migrate high-value screens where the full agent workflow is visible: sidebar, composer, message timeline, settings chrome, diff review.
5. Remove private hard-coded styles gradually after semantic coverage exists.

## Non-goals

- Rebuilding every page in one pass.
- Copying Linear or ChatGPT visual identity.
- Adding decorative gradients, heavy shadows, or glass-heavy panels.
- Introducing a new component API shape where a compatible upgrade is enough.
