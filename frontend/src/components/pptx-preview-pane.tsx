import { useEffect, useRef, useState } from "react";
import { Eye } from "lucide-react";
import { renderAsync } from "docx-preview";
import { init } from "pptx-preview";

import { api } from "../lib/api";

type PptxPreviewer = ReturnType<typeof init>;

type LoadedPreview = {
  filename: string;
  contentType: string;
  blobUrl: string;
  arrayBuffer?: ArrayBuffer;
};

export function isPptxDocument(contentType: string | null | undefined, filename: string) {
  const lower = (contentType ?? "").toLowerCase();
  const name = filename.toLowerCase();
  return (
    name.endsWith(".pptx") ||
    lower.includes("presentationml.presentation") ||
    lower === "application/vnd.openxmlformats-officedocument.presentationml.presentation"
  );
}

export function isLegacyPptDocument(contentType: string | null | undefined, filename: string) {
  const lower = (contentType ?? "").toLowerCase();
  const name = filename.toLowerCase();
  if (name.endsWith(".pptx")) return false;
  return (
    name.endsWith(".ppt") ||
    lower === "application/vnd.ms-powerpoint" ||
    lower.includes("ms-powerpoint")
  );
}

export function isDocxDocument(contentType: string | null | undefined, filename: string) {
  const lower = (contentType ?? "").toLowerCase();
  const name = filename.toLowerCase();
  return (
    name.endsWith(".docx") ||
    lower.includes("wordprocessingml.document") ||
    lower === "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
  );
}

export function isLegacyDocDocument(contentType: string | null | undefined, filename: string) {
  const lower = (contentType ?? "").toLowerCase();
  const name = filename.toLowerCase();
  if (name.endsWith(".docx")) return false;
  return (
    name.endsWith(".doc") ||
    lower === "application/msword" ||
    (lower.includes("msword") && !lower.includes("wordprocessingml"))
  );
}

export function isImageDocument(contentType: string | null | undefined, filename: string) {
  const lower = (contentType ?? "").toLowerCase();
  return lower.startsWith("image/") || /\.(png|jpe?g|gif|webp|bmp)$/i.test(filename);
}

export function isPdfDocument(contentType: string | null | undefined, filename: string) {
  const lower = (contentType ?? "").toLowerCase();
  const name = filename.toLowerCase();
  return lower.includes("pdf") || name.endsWith(".pdf");
}

export function needsArrayBufferPreview(contentType: string | null | undefined, filename: string) {
  return isPptxDocument(contentType, filename) || isDocxDocument(contentType, filename);
}

export function isPreviewableDocument(contentType: string | null | undefined, filename: string) {
  return (
    isPdfDocument(contentType, filename) ||
    isImageDocument(contentType, filename) ||
    isPptxDocument(contentType, filename) ||
    isDocxDocument(contentType, filename)
  );
}

export function DocxPreviewPane({
  arrayBuffer,
  compact = false,
}: {
  arrayBuffer: ArrayBuffer;
  compact?: boolean;
}) {
  const hostRef = useRef<HTMLDivElement>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    let cancelled = false;

    void (async () => {
      setLoading(true);
      setError(null);
      host.innerHTML = "";
      try {
        await renderAsync(arrayBuffer.slice(0), host, undefined, {
          className: "docx-preview-body",
          inWrapper: true,
          ignoreWidth: compact,
          ignoreHeight: true,
          breakPages: !compact,
          useBase64URL: true,
        });
        if (cancelled) host.innerHTML = "";
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Unable to preview this Word document");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
      host.innerHTML = "";
    };
  }, [arrayBuffer, compact]);

  return (
    <div className="relative h-full w-full overflow-hidden rounded-lg bg-white">
      {loading ? (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-white/90 text-sm text-gray-500">
          Loading document…
        </div>
      ) : null}
      {error ? (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-white p-4 text-center text-xs text-rose-600">
          {error}
        </div>
      ) : null}
      <div
        ref={hostRef}
        className={`h-full w-full overflow-auto bg-gray-100 ${compact ? "p-2" : "p-4"}`}
      />
    </div>
  );
}

export function PptxPreviewPane({
  arrayBuffer,
  compact = false,
}: {
  arrayBuffer: ArrayBuffer;
  compact?: boolean;
}) {
  const hostRef = useRef<HTMLDivElement>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    let cancelled = false;
    let previewer: PptxPreviewer | null = null;

    void (async () => {
      setLoading(true);
      setError(null);
      host.innerHTML = "";
      try {
        const width = compact
          ? Math.max(Math.floor(host.clientWidth || 480), 280)
          : Math.max(Math.floor(host.clientWidth || 880), 480);
        const height = compact
          ? Math.max(Math.floor(host.clientHeight || 220), 180)
          : Math.max(Math.floor(host.clientHeight || 560), 320);
        previewer = init(host, { width, height, mode: "slide" });
        await previewer.preview(arrayBuffer.slice(0));
        if (cancelled) {
          previewer.destroy();
          previewer = null;
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Unable to preview this PowerPoint file");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
      previewer?.destroy();
      host.innerHTML = "";
    };
  }, [arrayBuffer, compact]);

  return (
    <div className="relative h-full w-full overflow-hidden rounded-lg bg-white">
      {loading ? (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-white/90 text-sm text-gray-500">
          Loading presentation…
        </div>
      ) : null}
      {error ? (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-white p-4 text-center text-xs text-rose-600">
          {error}
        </div>
      ) : null}
      <div ref={hostRef} className="h-full w-full overflow-auto p-1" />
    </div>
  );
}

function InlinePreviewBody({ preview }: { preview: LoadedPreview }) {
  if (isImageDocument(preview.contentType, preview.filename)) {
    return (
      <div className="flex h-full items-center justify-center bg-white p-2">
        <img
          src={preview.blobUrl}
          alt={preview.filename}
          className="max-h-full max-w-full object-contain"
        />
      </div>
    );
  }

  if (isDocxDocument(preview.contentType, preview.filename) && preview.arrayBuffer) {
    return <DocxPreviewPane arrayBuffer={preview.arrayBuffer} compact />;
  }

  if (isPptxDocument(preview.contentType, preview.filename) && preview.arrayBuffer) {
    return <PptxPreviewPane arrayBuffer={preview.arrayBuffer} compact />;
  }

  if (isPdfDocument(preview.contentType, preview.filename)) {
    return (
      <iframe
        title={preview.filename}
        src={preview.blobUrl}
        className="h-full w-full border-0 bg-white"
      />
    );
  }

  return (
    <div className="flex h-full items-center justify-center px-4 text-center text-xs text-gray-500">
      {isLegacyPptDocument(preview.contentType, preview.filename)
        ? "Legacy .ppt preview is not supported. Re-save as .pptx to preview here."
        : isLegacyDocDocument(preview.contentType, preview.filename)
          ? "Legacy .doc preview is not supported. Re-save as .docx to preview here."
          : "Preview is not available for this file type."}
    </div>
  );
}

export function DocumentInlinePreview({
  contentPath,
  filename,
  contentType,
  label = "Template",
  onOpenFull,
}: {
  contentPath: string;
  filename: string;
  contentType?: string | null;
  label?: string;
  onOpenFull?: () => void;
}) {
  const [preview, setPreview] = useState<LoadedPreview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const previewRef = useRef<LoadedPreview | null>(null);

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      setLoading(true);
      setError(null);
      try {
        const blob = await api.getBlob(contentPath);
        if (cancelled) return;

        const resolvedType = contentType || blob.type || "application/octet-stream";
        const blobUrl = URL.createObjectURL(blob);
        const arrayBuffer = needsArrayBufferPreview(resolvedType, filename)
          ? await blob.arrayBuffer()
          : undefined;

        if (previewRef.current?.blobUrl) URL.revokeObjectURL(previewRef.current.blobUrl);
        const loaded = {
          filename,
          contentType: resolvedType,
          blobUrl,
          arrayBuffer,
        };
        previewRef.current = loaded;
        setPreview(loaded);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Unable to load template");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
      if (previewRef.current?.blobUrl) URL.revokeObjectURL(previewRef.current.blobUrl);
      previewRef.current = null;
    };
  }, [contentPath, filename, contentType]);

  return (
    <div className="mt-2 w-full rounded-lg border border-gray-100 bg-gray-50/80 p-2">
      <div className="mb-2 flex items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">{label}</p>
          <p className="truncate font-mono text-[11px] text-gray-400">{filename}</p>
        </div>
        {onOpenFull && isPreviewableDocument(preview?.contentType, filename) ? (
          <button
            type="button"
            onClick={onOpenFull}
            className="inline-flex shrink-0 items-center gap-1 rounded-md border border-gray-200 bg-white px-2 py-1 text-[11px] font-medium text-gray-700 hover:bg-gray-50"
          >
            <Eye className="size-3 text-indigo-500" strokeWidth={2} />
            Open full
          </button>
        ) : null}
      </div>
      <div className="h-52 overflow-hidden rounded-md border border-gray-100 bg-white">
        {loading ? (
          <div className="flex h-full items-center justify-center text-xs text-gray-400">
            Loading template…
          </div>
        ) : error ? (
          <div className="flex h-full items-center justify-center px-4 text-center text-xs text-rose-600">
            {error}
          </div>
        ) : preview ? (
          <InlinePreviewBody preview={preview} />
        ) : null}
      </div>
    </div>
  );
}
