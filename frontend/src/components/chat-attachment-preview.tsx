import { Download, Paperclip } from "lucide-react";
import { useEffect, useState } from "react";

import { api } from "../lib/api";
import { isImageDocument, isPdfDocument } from "./pptx-preview-pane";

function isVideoDocument(contentType: string | null | undefined, filename: string) {
  const lower = (contentType ?? "").toLowerCase();
  return lower.startsWith("video/") || /\.(mp4|webm|mov|ogg|m4v)$/i.test(filename);
}

type ChatAttachmentPreviewProps = {
  ticketId: number;
  attachmentId: number;
  filename: string;
  contentType?: string | null;
  onDownload: () => void;
};

export function ChatAttachmentPreview({
  ticketId,
  attachmentId,
  filename,
  contentType,
  onDownload,
}: ChatAttachmentPreviewProps) {
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const isImage = isImageDocument(contentType, filename);
  const isVideo = isVideoDocument(contentType, filename);
  const isPdf = isPdfDocument(contentType, filename);

  useEffect(() => {
    let active = true;
    let objectUrl: string | null = null;
    setLoading(true);
    setError(false);
    setBlobUrl(null);

    void api
      .getBlob(`/tickets/${ticketId}/attachments/${attachmentId}/content`)
      .then((blob) => {
        if (!active) return;
        objectUrl = URL.createObjectURL(blob);
        setBlobUrl(objectUrl);
        setLoading(false);
      })
      .catch(() => {
        if (!active) return;
        setError(true);
        setLoading(false);
      });

    return () => {
      active = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [ticketId, attachmentId]);

  if (loading) {
    return (
      <div className="flex h-28 w-44 items-center justify-center rounded-lg bg-gray-100 text-xs text-gray-400">
        Loading…
      </div>
    );
  }

  if (error || !blobUrl) {
    return (
      <button
        type="button"
        onClick={onDownload}
        className="inline-flex max-w-full items-center gap-1.5 text-left text-sm font-medium text-sky-700 underline-offset-2 hover:underline"
      >
        <Paperclip className="size-3.5 shrink-0" />
        <span className="truncate">{filename}</span>
      </button>
    );
  }

  if (isImage) {
    return (
      <div className="space-y-1">
        <a
          href={blobUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="block overflow-hidden rounded-lg"
        >
          <img
            src={blobUrl}
            alt={filename}
            className="max-h-56 max-w-full rounded-lg object-contain bg-black/5"
          />
        </a>
        <button
          type="button"
          onClick={onDownload}
          className="inline-flex items-center gap-1 text-[10px] font-medium text-gray-500 underline-offset-2 hover:underline"
        >
          <Download className="size-3" />
          {filename}
        </button>
      </div>
    );
  }

  if (isVideo) {
    return (
      <div className="space-y-1">
        <video
          src={blobUrl}
          controls
          playsInline
          className="max-h-56 max-w-full rounded-lg bg-black"
        />
        <button
          type="button"
          onClick={onDownload}
          className="inline-flex items-center gap-1 text-[10px] font-medium text-gray-500 underline-offset-2 hover:underline"
        >
          <Download className="size-3" />
          {filename}
        </button>
      </div>
    );
  }

  if (isPdf) {
    return (
      <div className="space-y-1 min-w-[14rem]">
        <iframe
          title={filename}
          src={blobUrl}
          className="h-52 w-full rounded-lg border border-gray-200 bg-white"
        />
        <button
          type="button"
          onClick={onDownload}
          className="inline-flex items-center gap-1 text-[10px] font-medium text-gray-500 underline-offset-2 hover:underline"
        >
          <Download className="size-3" />
          {filename}
        </button>
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={onDownload}
      className="inline-flex max-w-full items-center gap-1.5 text-left text-sm font-medium text-sky-700 underline-offset-2 hover:underline"
    >
      <Paperclip className="size-3.5 shrink-0" />
      <span className="truncate">{filename}</span>
    </button>
  );
}

export function isInlineAttachmentPreview(
  contentType: string | null | undefined,
  filename: string,
) {
  return (
    isImageDocument(contentType, filename) ||
    isVideoDocument(contentType, filename) ||
    isPdfDocument(contentType, filename)
  );
}
