# UI Polish Guidelines

> Bridging the gap between Design System spec and implementation to achieve top-tier product quality.

## Overview

This document outlines the standards and practices for achieving premium UI quality across HugeCode surfaces. It addresses the disconnect between our well-defined Design System and actual component implementations.

---

## Core Principles

### 1. Token-First Development

**Never use hardcoded values.** All styling must reference design tokens.

| ❌ Anti-pattern                                     | ✅ Correct                                                                      |
| --------------------------------------------------- | ------------------------------------------------------------------------------- |
| `fontSize: "11px"`                                  | `fontSize: "var(--font-size-fine)"`                                             |
| `transition: "background 140ms ease"`               | `transition: "background var(--duration-fast) var(--ease-smooth)"`              |
| `boxShadow: "0 0 0 4px var(--brand-primary, #000)"` | `boxShadow: "0 0 0 4px color-mix(in srgb, var(--color-ring) 78%, transparent)"` |
| `var(--text-sm, 14px)`                              | `var(--font-size-label)`                                                        |

### 2. Semantic Styling

Use semantic tokens and primitives that automatically adapt to light/dark modes:

```ts
import { style } from "@vanilla-extract/css";
import { focusRingValues, motionValues, typographyValues } from "@ku0/design-system";

export const shellLabel = style({
  fontSize: typographyValues.chrome.fontSize,
  lineHeight: typographyValues.chrome.lineHeight,
  transition: motionValues.interactive,
  selectors: {
    "&:focus-visible": {
      outline: focusRingValues.button,
      outlineOffset: "2px",
    },
  },
});
```

Guardrails are now part of the contract:

- Raw color literals and `var(..., rawFallback)` are forbidden in repo-owned downstream `.css.ts`
- Legacy `--text-* / --surface-* / --border-* / --brand-*` consumption is only allowed inside `apps/code/src/styles/tokens/dsAliases.css.ts`
- Downstream packages should consume `--color-*`, `--ds-*`, or exported semantic primitives, not legacy aliases directly

### 3. Motion Standards

All animations must use design system timing tokens:

```css
/* Duration tokens */
--duration-fast: 100ms /* Micro-interactions */ --duration-normal: 200ms /* Standard transitions */
  --duration-slow: 300ms /* Complex animations */ /* Easing tokens */
  --ease-smooth: cubic-bezier(0.4, 0, 0.2, 1) --ease-spring: cubic-bezier(0.175, 0.885, 0.32, 1.275)
  --ease-out-expo: cubic-bezier(0.19, 1, 0.22, 1);
```

---

## Component Patterns

### Buttons

Standard button should include:

- Press feedback: `scale(0.98)`
- Hover elevation via shared shadow tokens
- Focus ring with proper offset
- Duration token: `var(--duration-fast)`

```ts
export const buttonChrome = style({
  transition: motionValues.interactive,
  selectors: {
    "&:hover": {
      boxShadow: "var(--elevation-card)",
      transform: "translateY(-1px)",
    },
    "&:active": {
      transform: "translateY(0) scale(0.98)",
      boxShadow: "none",
    },
  },
});
```

### Interactive List Items

Sidebar and list items should have:

- Background transition on hover
- Subtle border glow effect (optional)
- Clear active state indication

```ts
export const sidebarItem = style({
  transition: motionValues.interactive,
  selectors: {
    "&[data-active='false']:hover": { background: "var(--color-surface-2)" },
    "&[data-active='true']": {
      background: "var(--color-surface-2)",
      color: "var(--color-foreground)",
    },
  },
});
```

### Messages & Entries

New content should animate in using shared motion tokens or exported animation classes from the design system. Do not introduce local timing strings for message enter/exit behavior.

### Panels & Cards

Elevated content requires proper shadow hierarchy:

```ts
export const panelChrome = style({
  background: "var(--color-surface-elevated)",
  border: "1px solid var(--color-border)",
  boxShadow: "var(--elevation-panel)",
});
```

---

## Typography Scale

Use semantic font size tokens that map to specific use cases:

| Token                 | Size | Use Case                  |
| --------------------- | ---- | ------------------------- |
| `--font-size-nano`    | 8px  | Tiny labels (rarely used) |
| `--font-size-tiny`    | 9px  | Timestamp, metadata       |
| `--font-size-micro`   | 10px | Badges, status indicators |
| `--font-size-fine`    | 11px | Secondary UI text         |
| `--font-size-chrome`  | 13px | **Primary UI chrome**     |
| `--font-size-content` | 15px | Main content body         |

### Applying Typography

```ts
import { typographyValues } from "@ku0/design-system";

export const textChrome = style({
  fontSize: typographyValues.chrome.fontSize,
  lineHeight: typographyValues.chrome.lineHeight,
});
```

---

## Border Radius Scale

Maintain "squircle" feel with consistent radius tokens:

| Token          | Value | Use Case                   |
| -------------- | ----- | -------------------------- |
| `--radius-sm`  | 4px   | Inline badges, small chips |
| `--radius-md`  | 6px   | Buttons, inputs            |
| `--radius-lg`  | 12px  | Cards, panels              |
| `--radius-xl`  | 16px  | Large panels, sidebars     |
| `--radius-2xl` | 24px  | Modals, dialogs            |
| `--radius-3xl` | 32px  | Hero sections              |

---

## Common Violations & Fixes

### Violation 1: Hardcoded Border Colors

```ts
// ❌ Wrong
borderColor: "#d1d5db";

// ✅ Correct
borderColor: "var(--color-border-subtle)";
```

### Violation 2: Magic Number Opacity

```ts
// ❌ Wrong
background: "rgba(15, 23, 42, 0.05)";

// ✅ Correct
background: "var(--color-surface-hover)";
```

### Violation 3: Missing Animation Timing

```ts
// ❌ Wrong
transition: "color 140ms ease";

// ✅ Correct
transition: "color var(--duration-fast) var(--ease-smooth)";
```

### Violation 4: Inconsistent Text Sizing

```ts
// ❌ Wrong
fontSize: "11px";

// ✅ Correct
fontSize: "var(--font-size-fine)";
```

---

## Scrollbar Styling

Ensure consistent scrollbar appearance across panels:

```tsx
className={cn(
  "overflow-y-auto",
  "[&::-webkit-scrollbar]:w-1.5",
  "[&::-webkit-scrollbar-track]:bg-transparent",
  "[&::-webkit-scrollbar-thumb]:bg-transparent",
  "hover:[&::-webkit-scrollbar-thumb]:bg-border/40",
  "[&::-webkit-scrollbar-thumb]:rounded-full",
  "transition-colors"
)}
```

---

## Visual Hierarchy Checklist

For every new component, verify:

- [ ] Uses design tokens, no hardcoded colors
- [ ] Has appropriate hover/focus/active states
- [ ] Animations use duration and easing tokens
- [ ] Text uses semantic size tokens
- [ ] Border radius follows the scale
- [ ] Shadows match elevation level
- [ ] Scrollbar styled if scrollable
- [ ] Dark mode tested

---

## Related Documentation

- [Design System Overview](../design-system/design-system.md)
- [Design Tokens Usage](../design-system/USAGE.md)
- [Theme CSS Variables](../../packages/design-system/src/theme.css.ts)
- [Animation Utilities](../../packages/design-system/src/animations.css.ts)
