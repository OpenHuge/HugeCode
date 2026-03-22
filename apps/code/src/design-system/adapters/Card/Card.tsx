import {
  Card as SharedCard,
  CardBody as SharedCardBody,
  CardDescription as SharedCardDescription,
  CardFooter as SharedCardFooter,
  CardHeader as SharedCardHeader,
  CardTitle as SharedCardTitle,
  type CardProps as SharedCardProps,
} from "@ku0/design-system";
import { forwardRef } from "react";

export interface CardProps extends Omit<SharedCardProps, "tone"> {
  variant?: "default" | "subtle" | "translucent" | "ghost";
}

export const Card = forwardRef<HTMLDivElement, CardProps>(function Card(
  { variant = "default", ...props },
  ref
) {
  return <SharedCard {...props} ref={ref} tone={variant === "default" ? "default" : variant} />;
});

export const CardHeader = SharedCardHeader;
export const CardBody = SharedCardBody;
export const CardFooter = SharedCardFooter;
export const CardTitle = SharedCardTitle;
export const CardDescription = SharedCardDescription;
