import type { ButtonHTMLAttributes, HTMLAttributes, ReactNode } from "react";

import {
  TableBody as TGTableBody,
  TableCell as TGTableCell,
  TableHead as TGTableHead,
  TableHeader as TGTableHeader,
  TableRoot,
  TableRow as TGTableRow,
} from "../tailgrids/core/table";

function cn(...classes: Array<string | undefined>) {
  return classes.filter(Boolean).join(" ");
}

export function TableContainer({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("overflow-x-auto", className)} {...props} />;
}

export function Table({ className, ...props }: HTMLAttributes<HTMLTableElement>) {
  return (
    <TableRoot
      className={cn("!rounded-lg !border-gray-200 text-sm", className)}
      {...props}
    />
  );
}

export function TableHead({ className, ...props }: HTMLAttributes<HTMLTableSectionElement>) {
  return <TGTableHeader className={cn("bg-gray-50/80", className)} {...props} />;
}

export function TableHeaderRow({ className, ...props }: HTMLAttributes<HTMLTableRowElement>) {
  return <TGTableRow className={className} {...props} />;
}

export function TableHeaderCell({ className, ...props }: HTMLAttributes<HTMLTableCellElement>) {
  return (
    <TGTableHead
      className={cn(
        "!px-4 !py-2.5 text-[11px] font-semibold uppercase tracking-wide text-gray-500",
        className,
      )}
      {...props}
    />
  );
}

export function TableBody({ className, ...props }: HTMLAttributes<HTMLTableSectionElement>) {
  return <TGTableBody className={className} {...props} />;
}

export function TableRow({ className, ...props }: HTMLAttributes<HTMLTableRowElement>) {
  return (
    <TGTableRow
      className={cn("transition-colors hover:bg-gray-50/70", className)}
      {...props}
    />
  );
}

export function TableCell({
  className,
  mono,
  muted,
  ...props
}: HTMLAttributes<HTMLTableCellElement> & { mono?: boolean; muted?: boolean }) {
  return (
    <TGTableCell
      className={cn(
        "!px-4 !py-2.5 text-sm font-normal text-gray-800",
        mono ? "font-mono text-xs text-gray-600" : undefined,
        muted ? "text-gray-400" : undefined,
        className,
      )}
      {...props}
    />
  );
}

export function TableActions({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <div className={cn("flex items-center justify-end gap-0.5", className)}>{children}</div>
  );
}

export function TableIconButton({
  label,
  variant = "default",
  className,
  children,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  label: string;
  variant?: "default" | "danger";
}) {
  return (
    <button
      type="button"
      aria-label={label}
      className={cn(
        "inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md transition-colors",
        variant === "danger"
          ? "text-danger hover:bg-danger-light"
          : "text-primary hover:bg-primary-light",
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
}
