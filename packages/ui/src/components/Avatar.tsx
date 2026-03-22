import { Avatar as SharedAvatar } from "@ku0/design-system";
import { forwardRef, type HTMLAttributes } from "react";

export interface AvatarProps extends HTMLAttributes<HTMLDivElement> {
  src?: string;
  alt?: string;
  fallback?: string;
  size?: "sm" | "md" | "lg";
}

export const Avatar = forwardRef<HTMLDivElement, AvatarProps>(
  ({ className, src, alt, fallback, size = "md", ...props }, ref) => {
    return (
      <SharedAvatar
        {...props}
        ref={ref}
        className={className}
        src={src}
        alt={alt}
        fallback={fallback}
        size={size}
      />
    );
  }
);

Avatar.displayName = "Avatar";
