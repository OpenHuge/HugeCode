import { Card as SharedCard } from "@ku0/design-system";
import { forwardRef, type HTMLAttributes } from "react";

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  variant?: "elevated" | "flat" | "interactive";
}

export const Card = forwardRef<HTMLDivElement, CardProps>(
  ({ className, variant = "elevated", ...props }, ref) => {
    return (
      <SharedCard
        {...props}
        ref={ref}
        className={className}
        tone={variant === "flat" ? "subtle" : "default"}
        interactive={variant === "interactive"}
      />
    );
  }
);

Card.displayName = "Card";
