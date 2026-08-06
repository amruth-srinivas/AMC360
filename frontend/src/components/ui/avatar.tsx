import { useEffect, useState } from "react";

import { api } from "../../lib/api";
import { cn } from "../../lib/utils";
import type { PresenceStatus } from "../../store/auth";

const AVATAR_PALETTE = [
  "bg-primary text-white",
  "bg-indigo-500 text-white",
  "bg-teal-500 text-white",
  "bg-purple-500 text-white",
  "bg-info text-white",
] as const;

export const PRESENCE_OPTIONS: Array<{
  value: PresenceStatus;
  label: string;
  description: string;
  dotClass: string;
}> = [
  {
    value: "available",
    label: "Available",
    description: "Ready to chat",
    dotClass: "bg-emerald-500",
  },
  {
    value: "busy",
    label: "Busy",
    description: "Do not interrupt unless urgent",
    dotClass: "bg-rose-500",
  },
  {
    value: "do_not_disturb",
    label: "Do not disturb",
    description: "Notifications muted",
    dotClass: "bg-rose-700",
  },
  {
    value: "be_right_back",
    label: "Be right back",
    description: "Stepping away briefly",
    dotClass: "bg-amber-400",
  },
  {
    value: "away",
    label: "Away",
    description: "Not at desk",
    dotClass: "bg-amber-500",
  },
  {
    value: "offline",
    label: "Appear offline",
    description: "Hide availability",
    dotClass: "bg-gray-400",
  },
];

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

export function presenceMeta(status?: PresenceStatus | null) {
  return PRESENCE_OPTIONS.find((item) => item.value === status) ?? PRESENCE_OPTIONS[0];
}

export function useAuthenticatedImage(
  enabled: boolean,
  path: string,
  version = 0,
): string | null {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!enabled) {
      setUrl(null);
      return;
    }

    let objectUrl: string | null = null;
    let cancelled = false;

    void (async () => {
      try {
        const blob = await api.getBlob(path);
        if (cancelled) return;
        objectUrl = URL.createObjectURL(blob);
        setUrl(objectUrl);
      } catch {
        if (!cancelled) setUrl(null);
      }
    })();

    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [enabled, path, version]);

  return url;
}

export function UserAvatar({
  name,
  size = "sm",
  className,
  src,
  presence,
  showPresence = false,
}: {
  name: string;
  size?: "sm" | "md" | "lg";
  className?: string;
  src?: string | null;
  presence?: PresenceStatus | null;
  showPresence?: boolean;
}) {
  const color = AVATAR_PALETTE[hashName(name) % AVATAR_PALETTE.length];
  const sizeClass =
    size === "lg" ? "h-16 w-16 text-lg" : size === "md" ? "h-8 w-8 text-xs" : "h-7 w-7 text-[11px]";
  const presenceSize =
    size === "lg" ? "h-3.5 w-3.5 ring-2" : size === "md" ? "h-2.5 w-2.5 ring-2" : "h-2 w-2 ring-1";
  const meta = presenceMeta(presence);

  return (
    <span className={cn("relative inline-flex shrink-0", className)}>
      {src ? (
        <img
          src={src}
          alt=""
          className={cn("rounded-full object-cover", sizeClass)}
          aria-hidden
        />
      ) : (
        <span
          className={cn(
            "inline-flex items-center justify-center rounded-full font-semibold leading-none",
            sizeClass,
            color,
          )}
          aria-hidden
        >
          {getInitials(name)}
        </span>
      )}
      {showPresence ? (
        <span
          className={cn(
            "absolute bottom-0 right-0 rounded-full ring-white",
            presenceSize,
            meta.dotClass,
          )}
          title={meta.label}
          aria-hidden
        />
      ) : null}
    </span>
  );
}
