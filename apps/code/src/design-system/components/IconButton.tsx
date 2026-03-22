import {
  IconButton as SharedIconButton,
  type IconButtonProps as SharedIconButtonProps,
} from "@ku0/design-system";
import { type ReactNode, forwardRef } from "react";
import { Icon, type IconProps } from "./Icon";

function resolveIconNode(icon: IconProps["icon"] | ReactNode, size: SharedIconButtonProps["size"]) {
  if (typeof icon === "function") {
    return (
      <Icon
        icon={icon as IconProps["icon"]}
        size={size === "iconSm" ? 14 : size === "sm" ? "sm" : "md"}
      />
    );
  }
  return icon;
}

export interface IconButtonProps extends Omit<SharedIconButtonProps, "icon"> {
  icon: IconProps["icon"] | ReactNode;
}

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(function IconButton(
  { icon, size = "icon", ...props },
  ref
) {
  return <SharedIconButton {...props} ref={ref} size={size} icon={resolveIconNode(icon, size)} />;
});
