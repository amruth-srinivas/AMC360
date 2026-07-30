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
      <FieldLabel className="text-xs font-medium text-gray-700">{label}</FieldLabel>
      {Icon ? (
        <div className="relative">
          <Icon className="pointer-events-none absolute left-2.5 top-2.5 z-10 h-3.5 w-3.5 text-gray-400" />
          <div className="[&_input]:!pl-8 [&_textarea]:!pl-8">{children}</div>
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
