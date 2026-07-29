import * as React from "react";
import type { ChangeEvent } from "react";
import { Eye, EyeOff } from "lucide-react";
import type { LucideIcon } from "lucide-react";

import { Input as TailgridsInput } from "../tailgrids/core/input";
import { NativeSelect } from "../tailgrids/core/native-select";
import { TextArea } from "../tailgrids/core/text-area";
import { cn } from "../../lib/utils";

function resolveTextValue(value: unknown) {
  if (typeof value === "string") return value;
  if (value && typeof value === "object" && "target" in value) {
    return (value as ChangeEvent<HTMLInputElement>).target.value;
  }
  return "";
}

export function Input({ className, onChange, value, ...props }: React.ComponentProps<typeof TailgridsInput>) {
  return (
    <TailgridsInput
      {...props}
      className={cn("w-full", className)}
      value={value ?? ""}
      onChange={(next) => onChange?.(resolveTextValue(next) as never)}
    />
  );
}

export function PasswordInput({
  className,
  icon: Icon,
  onChange,
  value,
  ...props
}: React.ComponentProps<typeof TailgridsInput> & { icon?: LucideIcon }) {
  const [showPassword, setShowPassword] = React.useState(false);

  return (
    <div className="relative">
      {Icon ? (
        <Icon
          className="pointer-events-none absolute left-3 top-1/2 z-10 h-4 w-4 -translate-y-1/2 text-gray-400"
          aria-hidden
        />
      ) : null}
      <TailgridsInput
        type={showPassword ? "text" : "password"}
        className={cn("w-full pr-10", Icon && "pl-10", className)}
        {...props}
        value={value ?? ""}
        onChange={(next) => onChange?.(resolveTextValue(next) as never)}
      />
      <button
        type="button"
        tabIndex={-1}
        className="absolute right-3 top-1/2 -translate-y-1/2 text-text-100 hover:text-primary-500"
        onClick={() => setShowPassword((value) => !value)}
        aria-label={showPassword ? "Hide password" : "Show password"}
      >
        {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
      </button>
    </div>
  );
}

export const Select = React.forwardRef<
  HTMLSelectElement,
  React.ComponentProps<typeof NativeSelect>
>(function StyledSelect({ children, className, ...props }, ref) {
  return (
    <NativeSelect ref={ref} className={cn("w-full", className)} {...props}>
      {children}
    </NativeSelect>
  );
});

export function Textarea({
  className,
  onChange,
  value,
  ...props
}: React.ComponentProps<typeof TextArea>) {
  return (
    <TextArea
      {...props}
      className={cn("w-full", className)}
      value={value ?? ""}
      onChange={(next) => onChange?.(resolveTextValue(next) as never)}
    />
  );
}
