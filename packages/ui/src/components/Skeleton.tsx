import { forwardRef, type HTMLAttributes } from "react";
import { cn } from "../lib/utils";
import { skeletonBase, skeletonVariants } from "./Skeleton.styles.css";

export interface SkeletonProps extends HTMLAttributes<HTMLDivElement> {
  variant?: "text" | "circular" | "rectangular";
}

export const Skeleton = forwardRef<HTMLDivElement, SkeletonProps>(
  ({ className, variant = "rectangular", ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(skeletonBase, skeletonVariants[variant], className)}
        {...props}
      />
    );
  }
);

Skeleton.displayName = "Skeleton";
