import { forwardRef, type HTMLAttributes, type ReactNode } from "react";
import { cx } from "./classNames";
import * as styles from "./Avatar.css";

type AvatarSize = "sm" | "md" | "lg";
type AvatarShape = "circle" | "rounded";

export interface AvatarProps extends Omit<HTMLAttributes<HTMLDivElement>, "children"> {
  src?: string;
  alt?: string;
  fallback?: ReactNode;
  children?: ReactNode;
  size?: AvatarSize;
  shape?: AvatarShape;
}

export const Avatar = forwardRef<HTMLDivElement, AvatarProps>(function Avatar(
  { alt = "", children, className, fallback = "?", shape = "circle", size = "md", src, ...props },
  ref
) {
  const content = src ? (
    <img src={src} alt={alt} className={styles.image} />
  ) : (
    <span className={styles.fallback}>{children ?? fallback}</span>
  );

  return (
    <div
      {...props}
      ref={ref}
      data-family="avatar"
      data-size={size}
      data-shape={shape}
      data-has-image={src ? "true" : "false"}
      className={cx(styles.root, styles.size[size], styles.shape[shape], className)}
    >
      {content}
    </div>
  );
});
