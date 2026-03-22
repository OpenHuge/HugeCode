# Design System Usage Guide

This document explains how to consume design tokens and follow component patterns across HugeCode surfaces.

---

## The Token Pipeline

Our design system follows a **vanilla-extract + CSS Variable-first** approach.

```
theme.css.ts --> styles.ts --> app side-effect entry (`@ku0/design-system/styles`)
        \
         --> tokens.ts (for JS/TS logic)
```

1.  **Definition**: `packages/design-system/src/theme.css.ts` defines the global theme values and density variables, while `base.css.ts`, `animations.css.ts`, `glass.css.ts`, and `aiAccent.css.ts` define shared global selectors.
2.  **Export**: `packages/design-system/src/styles.ts` is the side-effect entry consumed as `@ku0/design-system/styles`.
3.  **Consumption**: Components use co-located `.css.ts` files and semantic tokens from `@ku0/design-system/tokens`.

**Why CSS Variables?**

- Automatic Dark Mode: All components adapt without needing explicit class toggles.
- Centralized Changes: Update one variable, and it propagates everywhere.
- Runtime Theming: Future themes can be applied by simply overriding CSS variables.

---

## Component Architecture

We use a layered approach for building reusable UI components.

### Core Technologies

- **Radix UI Primitives**: For accessibility behaviors (focus trapping, keyboard navigation, portals).
- **vanilla-extract**: For co-located, type-safe component styles and global theme layers.
- **`cn()` Utility**: Concatenates generated class names using `clsx`.

### Example Pattern: Button

```tsx
// Button.tsx (simplified)
import { cn } from "@/lib/utils";
import { buttonBase, buttonSizes, buttonVariants } from "./Button.styles.css";

export function Button({ variant = "primary", size = "md", className, ...props }: ButtonProps) {
  return (
    <button
      className={cn(buttonBase, buttonVariants[variant], buttonSizes[size], className)}
      {...props}
    />
  );
}
```

---

## Using Tokens in TypeScript

For logic that requires design values (e.g., animation timing, spacing calculations):

```tsx
import { transitionDuration, spacing } from "@/styles/tokens";

const animationStyle = {
  transition: `transform ${transitionDuration.fast} ease-out`,
  margin: spacing[4], // "1rem" (16px)
};
```

---

## File Reference

| File                                   | Purpose                                                           |
| :------------------------------------- | :---------------------------------------------------------------- |
| `packages/design-system/src/styles.ts` | Shared global theme, base, animation, glass, and AI accent layers |
| `src/styles/tokens.ts`                 | TypeScript-safe token constants                                   |
| `src/lib/utils.ts`                     | `cn()` helper function                                            |
| `src/components/ui/`                   | All reusable UI primitives                                        |
