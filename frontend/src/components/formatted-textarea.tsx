import {
  Bold,
  Italic,
  Link2,
  List,
  ListOrdered,
  RemoveFormatting,
  Smile,
  Underline,
} from "lucide-react";
import { useRef, useState } from "react";

import { cn } from "@/utils/cn";

export const EMOJI_OPTIONS = ["👍", "✅", "❗", "🔍", "🛠️", "📎", "⚠️", "💡"];

export type FormatAction = "bold" | "italic" | "underline" | "ordered" | "bullet" | "link" | "clear";

export function applyTextFormat(
  value: string,
  start: number,
  end: number,
  action: FormatAction,
  linkUrl?: string,
) {
  const selected = value.slice(start, end);
  let replacement = selected;

  switch (action) {
    case "bold":
      replacement = `**${selected || "text"}**`;
      break;
    case "italic":
      replacement = `*${selected || "text"}*`;
      break;
    case "underline":
      replacement = `__${selected || "text"}__`;
      break;
    case "ordered":
      replacement = selected
        ? selected
            .split("\n")
            .map((line, index) => `${index + 1}. ${line}`)
            .join("\n")
        : "1. ";
      break;
    case "bullet":
      replacement = selected
        ? selected
            .split("\n")
            .map((line) => `- ${line}`)
            .join("\n")
        : "- ";
      break;
    case "link":
      const label = selected || "link text";
      const url = linkUrl?.trim() || "https://";
      replacement = `[${label}](${url})`;
      break;
    case "clear":
      replacement = selected
        .replace(/\*\*(.+?)\*\*/g, "$1")
        .replace(/\*(.+?)\*/g, "$1")
        .replace(/__(.+?)__/g, "$1")
        .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
        .replace(/^\d+\.\s/gm, "")
        .replace(/^-\s/gm, "");
      break;
  }

  return {
    value: value.slice(0, start) + replacement + value.slice(end),
    selectionStart: start,
    selectionEnd: start + replacement.length,
  };
}

const TOOLBAR_BUTTONS: Array<{
  action: FormatAction | "emoji";
  icon: typeof Bold;
  label: string;
}> = [
  { action: "bold", icon: Bold, label: "Bold" },
  { action: "italic", icon: Italic, label: "Italic" },
  { action: "underline", icon: Underline, label: "Underline" },
  { action: "emoji", icon: Smile, label: "Emoji" },
  { action: "ordered", icon: ListOrdered, label: "Numbered list" },
  { action: "bullet", icon: List, label: "Bulleted list" },
  { action: "link", icon: Link2, label: "Insert link" },
  { action: "clear", icon: RemoveFormatting, label: "Clear formatting" },
];

type FormattedTextareaProps = {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  rows?: number;
  placeholder?: string;
  className?: string;
  resize?: "none" | "y";
};

export function FormattedTextarea({
  value,
  onChange,
  disabled = false,
  rows = 4,
  placeholder,
  className,
  resize = "y",
}: FormattedTextareaProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const selectionRef = useRef({ start: 0, end: 0 });
  const [showEmojis, setShowEmojis] = useState(false);

  const syncSelection = () => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    selectionRef.current = {
      start: textarea.selectionStart,
      end: textarea.selectionEnd,
    };
  };

  const runFormat = (action: FormatAction) => {
    const textarea = textareaRef.current;
    if (!textarea || disabled) return;

    let linkUrl: string | undefined;
    if (action === "link") {
      linkUrl = window.prompt("Enter link URL:", "https://");
      if (!linkUrl) return;
    }

    const start = selectionRef.current.start;
    const end = selectionRef.current.end;
    const result = applyTextFormat(value, start, end, action, linkUrl);
    onChange(result.value);

    requestAnimationFrame(() => {
      textarea.focus();
      textarea.setSelectionRange(result.selectionStart, result.selectionEnd);
      selectionRef.current = {
        start: result.selectionStart,
        end: result.selectionEnd,
      };
    });
  };

  const insertEmoji = (emoji: string) => {
    const textarea = textareaRef.current;
    if (!textarea || disabled) return;

    const start = selectionRef.current.start;
    const end = selectionRef.current.end;
    const next = value.slice(0, start) + emoji + value.slice(end);
    onChange(next);
    setShowEmojis(false);

    const cursor = start + emoji.length;
    requestAnimationFrame(() => {
      textarea.focus();
      textarea.setSelectionRange(cursor, cursor);
      selectionRef.current = { start: cursor, end: cursor };
    });
  };

  return (
    <div className={cn("overflow-hidden rounded-md border border-gray-200 bg-white", className)}>
      <div className="flex flex-wrap items-center gap-0 border-b border-gray-100 px-1 py-0.5">
        {TOOLBAR_BUTTONS.map((item) => {
          const Icon = item.icon;
          if (item.action === "emoji") {
            return (
              <div key={item.action} className="relative">
                <button
                  type="button"
                  disabled={disabled}
                  title={item.label}
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => setShowEmojis((open) => !open)}
                  className="inline-flex size-7 items-center justify-center rounded-md text-gray-500 transition hover:bg-gray-100 hover:text-gray-700 disabled:opacity-50"
                >
                  <Icon className="size-3.5" />
                </button>
                {showEmojis && !disabled ? (
                  <div className="absolute bottom-full left-0 z-10 mb-1 flex gap-1 rounded-lg border border-gray-200 bg-white p-1.5 shadow-md">
                    {EMOJI_OPTIONS.map((emoji) => (
                      <button
                        key={emoji}
                        type="button"
                        onMouseDown={(event) => event.preventDefault()}
                        onClick={() => insertEmoji(emoji)}
                        className="inline-flex size-8 items-center justify-center rounded-md text-base hover:bg-gray-100"
                      >
                        {emoji}
                      </button>
                    ))}
                  </div>
                ) : null}
              </div>
            );
          }

          return (
            <button
              key={item.action}
              type="button"
              disabled={disabled}
              title={item.label}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => runFormat(item.action)}
              className="inline-flex size-7 items-center justify-center rounded-md text-gray-500 transition hover:bg-gray-100 hover:text-gray-700 disabled:opacity-50"
            >
              <Icon className="size-3.5" />
            </button>
          );
        })}
      </div>
      <textarea
        ref={textareaRef}
        rows={rows}
        value={value}
        disabled={disabled}
        onSelect={syncSelection}
        onKeyUp={syncSelection}
        onMouseUp={syncSelection}
        onChange={(event) => {
          onChange(event.target.value);
          syncSelection();
        }}
        placeholder={placeholder}
        className={cn(
          "w-full border-0 bg-white px-2.5 py-2 text-sm leading-snug text-gray-800 outline-none placeholder:text-gray-400 disabled:bg-gray-50 disabled:text-gray-500",
          resize === "none" ? "resize-none" : "resize-y",
          disabled && "cursor-not-allowed",
        )}
      />
    </div>
  );
}
