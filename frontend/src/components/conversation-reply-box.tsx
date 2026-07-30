import { Paperclip, Send, X } from "lucide-react";
import { useRef, useState } from "react";

import { cn } from "@/utils/cn";
import { FormattedTextarea } from "./formatted-textarea";

type ConversationReplyBoxProps = {
  value: string;
  onChange: (value: string) => void;
  onPost: (text: string, options: { internal: boolean; files: File[] }) => void;
  disabled?: boolean;
  posting?: boolean;
};

export function ConversationReplyBox({
  value,
  onChange,
  onPost,
  disabled = false,
  posting = false,
}: ConversationReplyBoxProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [internalNote, setInternalNote] = useState(false);
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);

  const addFiles = (fileList: FileList | null) => {
    if (!fileList || disabled) return;
    const next = [...pendingFiles];
    for (const file of Array.from(fileList)) {
      if (!next.some((item) => item.name === file.name && item.size === file.size)) {
        next.push(file);
      }
    }
    setPendingFiles(next);
  };

  const removeFile = (index: number) => {
    setPendingFiles((current) => current.filter((_, itemIndex) => itemIndex !== index));
  };

  const handlePost = () => {
    const trimmed = value.trim();
    if ((!trimmed && pendingFiles.length === 0) || disabled || posting) return;
    onPost(trimmed, { internal: internalNote, files: pendingFiles });
    setInternalNote(false);
    setPendingFiles([]);
  };

  const canPost = (value.trim().length > 0 || pendingFiles.length > 0) && !disabled && !posting;

  return (
    <div className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-100 px-3 py-1.5">
        <button
          type="button"
          disabled={disabled}
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => fileInputRef.current?.click()}
          className="inline-flex items-center gap-1.5 rounded-md border border-gray-200 bg-gray-50 px-2.5 py-1 text-xs font-medium text-gray-600 transition hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Paperclip className="size-3.5 text-gray-500" />
          Attach media/file
        </button>
        <label className="inline-flex cursor-pointer items-center gap-1.5 text-xs text-gray-500 select-none">
          <input
            type="checkbox"
            checked={internalNote}
            disabled={disabled}
            onChange={(event) => setInternalNote(event.target.checked)}
            className="size-3.5 rounded border-gray-300 text-primary focus:ring-primary/20"
          />
          Internal note
        </label>
        <input
          ref={fileInputRef}
          type="file"
          multiple
          className="hidden"
          onChange={(event) => {
            addFiles(event.target.files);
            event.target.value = "";
          }}
        />
      </div>

      <div className="px-3 py-2">
        {pendingFiles.length > 0 ? (
          <div className="mb-2 flex flex-wrap gap-1.5">
            {pendingFiles.map((file, index) => (
              <span
                key={`${file.name}-${file.size}-${index}`}
                className="inline-flex max-w-full items-center gap-1 rounded-full border border-gray-200 bg-gray-50 py-0.5 pl-2 pr-1 text-[11px] text-gray-700"
              >
                <Paperclip className="size-3 shrink-0 text-gray-400" />
                <span className="max-w-[10rem] truncate">{file.name}</span>
                <button
                  type="button"
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => removeFile(index)}
                  className="inline-flex size-5 items-center justify-center rounded-full text-gray-400 hover:bg-gray-200 hover:text-gray-600"
                  aria-label={`Remove ${file.name}`}
                >
                  <X className="size-3" />
                </button>
              </span>
            ))}
          </div>
        ) : null}

        <FormattedTextarea
          value={value}
          onChange={onChange}
          disabled={disabled}
          rows={3}
          resize="none"
          placeholder={
            disabled
              ? "Conversation is read-only while the ticket is closed."
              : "Write a reply to this ticket…"
          }
        />
      </div>

      <button
        type="button"
        disabled={!canPost}
        onClick={handlePost}
        className="relative flex h-9 w-full items-center bg-[#8B9FE8] text-xs font-semibold text-white transition hover:bg-[#7A8FD6] disabled:cursor-not-allowed disabled:bg-gray-300 disabled:text-gray-500"
      >
        <Send className="absolute left-3 size-3.5" />
        <span className="flex-1 text-center">{posting ? "Posting…" : "Post"}</span>
      </button>
    </div>
  );
}
