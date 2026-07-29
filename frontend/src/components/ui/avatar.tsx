import { cn } from "../../lib/utils";

const AVATAR_PALETTE = [
  "bg-primary text-white",
  "bg-indigo-500 text-white",
  "bg-teal-500 text-white",
  "bg-purple-500 text-white",
  "bg-info text-white",
] as const;

function hashName(name: string) {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return Math.abs(hash);
}

export function getInitials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
  }
  return parts[0]?.charAt(0).toUpperCase() ?? "?";
}

export function UserAvatar({
  name,
  size = "sm",
  className,
}: {
  name: string;
  size?: "sm" | "md";
  className?: string;
}) {
  const color = AVATAR_PALETTE[hashName(name) % AVATAR_PALETTE.length];
  const sizeClass = size === "sm" ? "h-7 w-7 text-[11px]" : "h-8 w-8 text-xs";

  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-full font-semibold leading-none",
        sizeClass,
        color,
        className,
      )}
      aria-hidden
    >
      {getInitials(name)}
    </span>
  );
}
