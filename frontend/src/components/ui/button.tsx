import type { ComponentProps, MouseEventHandler } from "react";

import { Button as TailgridsButton } from "../tailgrids/core/button";

type LegacyVariant = "default" | "outline" | "ghost" | "destructive" | "secondary";
type LegacySize = "default" | "sm" | "lg";

type ButtonProps = Omit<ComponentProps<typeof TailgridsButton>, "variant" | "size"> & {
  variant?: LegacyVariant;
  size?: LegacySize;
  onClick?: MouseEventHandler<HTMLButtonElement>;
};

const variantMap: Record<
  LegacyVariant,
  { variant: "primary" | "danger" | "ghost"; appearance?: "fill" | "outline" }
> = {
  default: { variant: "primary", appearance: "fill" },
  secondary: { variant: "primary", appearance: "outline" },
  outline: { variant: "primary", appearance: "outline" },
  ghost: { variant: "ghost" },
  destructive: { variant: "danger", appearance: "fill" },
};

const sizeMap: Record<LegacySize, "sm" | "md" | "lg"> = {
  sm: "sm",
  default: "md",
  lg: "lg",
};

export function Button({
  variant = "default",
  size = "default",
  className,
  onClick,
  type = "button",
  ...props
}: ButtonProps) {
  const mapped = variantMap[variant];
  return (
    <TailgridsButton
      type={type}
      variant={mapped.variant}
      appearance={mapped.appearance}
      size={sizeMap[size]}
      className={className}
      onPress={onClick as ComponentProps<typeof TailgridsButton>["onPress"]}
      {...props}
    />
  );
}
