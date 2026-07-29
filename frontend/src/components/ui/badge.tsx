import type { HTMLAttributes } from "react";

import { Badge as TailgridsBadge } from "../tailgrids/core/badge";
import { cn, formatLabel } from "../../lib/utils";

type BadgeVariant = "success" | "warning" | "danger" | "info" | "neutral";

const colorMap: Record<BadgeVariant, "success" | "warning" | "error" | "sky" | "gray"> = {
  success: "success",
  warning: "warning",
  danger: "error",
  info: "sky",
  neutral: "gray",
};

export function Badge({
  className,
  variant = "neutral",
  pulse = false,
  format = false,
  children,
}: HTMLAttributes<HTMLSpanElement> & {
  variant?: BadgeVariant;
  pulse?: boolean;
  format?: boolean;
}) {
  const content =
    format && typeof children === "string" ? formatLabel(children) : children;

  return (
    <TailgridsBadge color={colorMap[variant]} size="sm" className={cn(className)}>
      {pulse ? <span className="h-1.5 w-1.5 rounded-full bg-current animate-pulse" /> : null}
      {content}
    </TailgridsBadge>
  );
}
