import type { LucideIcon, LucideProps } from "lucide-react";
import { cn } from "../lib/utils";

export type IconSize = "xs" | "sm" | "md" | "lg" | "xl";

export type IconProps = Omit<LucideProps, "ref"> & {
  icon: LucideIcon;
  size?: IconSize | number;
  className?: string;
};

const SIZE_MAP: Record<IconSize, number> = {
  xs: 12,
  sm: 16,
  md: 20,
  lg: 24,
  xl: 32,
};

export function Icon({ icon: IconComponent, size = "md", className, ...props }: IconProps) {
  const pixelSize = typeof size === "number" ? size : SIZE_MAP[size];
  return <IconComponent size={pixelSize} className={cn(className)} {...props} />;
}
