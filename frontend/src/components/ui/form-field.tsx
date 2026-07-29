import type { ChangeEvent, ComponentProps, ReactNode } from "react";
import type { LucideIcon } from "lucide-react";

import { Input } from "../tailgrids/core/input";
import { FieldLabel, FieldError } from "../tailgrids/core/field";
import { cn } from "../../lib/utils";

function resolveTextValue(value: unknown) {
  if (typeof value === "string") return value;
  if (value && typeof value === "object" && "target" in value) {
    return (value as ChangeEvent<HTMLInputElement>).target.value;
  }
  return "";
}

export function FormField({
  label,
  error,
  icon: Icon,
  children,
  className,
}: {
  label: string;
  error?: string;
  icon?: LucideIcon;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("grid gap-1.5", className)}>
      <FieldLabel>{label}</FieldLabel>
      {Icon ? (
        <div className="relative">
          <Icon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-100" />
          <div className="[&_input]:pl-10">{children}</div>
        </div>
      ) : (
        children
      )}
      {error ? <FieldError>{error}</FieldError> : null}
    </div>
  );
}

export function IconInput({
  className,
  onChange,
  value,
  ...props
}: ComponentProps<typeof Input>) {
  return (
    <Input
      {...props}
      className={cn("w-full", className)}
      value={value ?? ""}
      onChange={(next) => onChange?.(resolveTextValue(next) as never)}
    />
  );
}
