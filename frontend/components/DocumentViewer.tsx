"use client";

import React, { createContext, useCallback, useContext, useEffect, useState } from "react";
import { api } from "@/lib/api";

export type DocumentViewerOptions = {
  /** API path to fetch the file (e.g. /api/contacts/xyz/documents/abc/file or /api/documents/123/preview) */
  apiPath: string;
  fileName: string;
  /** Optional; if not set, inferred from fileName extension */
  mimeType?: string | null;
};

type ContextValue = {
  openViewer: (opts: DocumentViewerOptions) => void;
  closeViewer: () => void;
};

const DocumentViewerContext = createContext<ContextValue | null>(null);

export function useDocumentViewer(): ContextValue {
  const ctx = useContext(DocumentViewerContext);
  if (!ctx) {
    return {
      openViewer: () => {},
      closeViewer: () => {},
    };
  }
  return ctx;
}

function inferMimeType(fileName: string): "pdf" | "image" | "other" {
  const lower = fileName.toLowerCase();
  if (lower.endsWith(".pdf")) return "pdf";
  if ([".png", ".jpg", ".jpeg", ".gif", ".webp", ".svg", ".bmp"].some((ext) => lower.endsWith(ext))) return "image";
  return "other";
}

function getViewType(mimeType: string | null | undefined, fileName: string): "pdf" | "image" | "other" {
  if (mimeType === "application/pdf") return "pdf";
  if (mimeType?.startsWith("image/")) return "image";
  return inferMimeType(fileName);
}

export function DocumentViewerProvider({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const [fileName, setFileName] = useState("");
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [viewType, setViewType] = useState<"pdf" | "image" | "other">("other");

  const closeViewer = useCallback(() => {
    setOpen(false);
    setBlobUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return null;
    });
    setFileName("");
    setError(null);
  }, []);

  useEffect(() => {
    if (!open || !blobUrl) return;
    return () => {
      URL.revokeObjectURL(blobUrl);
    };
  }, [open, blobUrl]);

  const openViewer = useCallback(async (opts: DocumentViewerOptions) => {
    setFileName(opts.fileName);
    setViewType(getViewType(opts.mimeType ?? null, opts.fileName));
    setBlobUrl(null);
    setError(null);
    setLoading(true);
    setOpen(true);
    try {
      const blob = await api.getBlob(opts.apiPath);
      const url = URL.createObjectURL(blob);
      setBlobUrl(url);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load document");
    } finally {
      setLoading(false);
    }
  }, []);

  const value: ContextValue = { openViewer, closeViewer };

  return (
    <DocumentViewerContext.Provider value={value}>
      {children}
      {open && (
        <DocumentViewerPanel
          fileName={fileName}
          blobUrl={blobUrl}
          loading={loading}
          error={error}
          viewType={viewType}
          onClose={closeViewer}
        />
      )}
    </DocumentViewerContext.Provider>
  );
}

function DocumentViewerPanel({
  fileName,
  blobUrl,
  loading,
  error,
  viewType,
  onClose,
}: {
  fileName: string;
  blobUrl: string | null;
  loading: boolean;
  error: string | null;
  viewType: "pdf" | "image" | "other";
  onClose: () => void;
}) {
  useEffect(() => {
    const onEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onEscape);
    return () => window.removeEventListener("keydown", onEscape);
  }, [onClose]);

  return (
    <>
      <div
        role="presentation"
        className="document-viewer-overlay"
        style={{
          position: "fixed",
          inset: 0,
          background: "rgba(0,0,0,0.4)",
          zIndex: 9998,
        }}
        onClick={onClose}
      />
      <aside
        role="dialog"
        aria-label="Document viewer"
        className="document-viewer-panel"
        style={{
          position: "fixed",
          top: 0,
          right: 0,
          width: "min(560px, 100vw)",
          maxWidth: "100%",
          height: "100vh",
          background: "var(--bg-primary)",
          boxShadow: "-4px 0 24px rgba(0,0,0,0.15)",
          zIndex: 9999,
          display: "flex",
          flexDirection: "column",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <header
          style={{
            flexShrink: 0,
            padding: "16px 20px",
            borderBottom: "1px solid var(--border)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 12,
            background: "var(--bg-secondary)",
          }}
        >
          <h2
            className="truncate"
            style={{
              margin: 0,
              fontSize: 16,
              fontWeight: 600,
              color: "var(--text-primary)",
              minWidth: 0,
            }}
            title={fileName}
          >
            {fileName}
          </h2>
          <button
            type="button"
            className="btn-ghost btn-sm"
            onClick={onClose}
            style={{ flexShrink: 0 }}
            aria-label="Close viewer"
          >
            <svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </header>
        <div
          style={{
            flex: 1,
            overflow: "auto",
            padding: 20,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            minHeight: 0,
          }}
        >
          {loading && (
            <div className="loading-spinner" style={{ width: 40, height: 40 }} />
          )}
          {error && (
            <p style={{ color: "var(--danger)", textAlign: "center", margin: 0 }}>{error}</p>
          )}
          {!loading && !error && blobUrl && viewType === "pdf" && (
            <iframe
              src={blobUrl}
              title={fileName}
              style={{
                width: "100%",
                height: "100%",
                minHeight: "480px",
                border: "1px solid var(--border)",
                borderRadius: 8,
                background: "#fff",
              }}
            />
          )}
          {!loading && !error && blobUrl && viewType === "image" && (
            <img
              src={blobUrl}
              alt={fileName}
              style={{
                maxWidth: "100%",
                maxHeight: "100%",
                objectFit: "contain",
                borderRadius: 8,
              }}
            />
          )}
          {!loading && !error && blobUrl && viewType === "other" && (
            <div style={{ textAlign: "center", color: "var(--text-tertiary)" }}>
              <p style={{ marginBottom: 12 }}>Preview not available for this file type.</p>
              <a href={blobUrl} download={fileName} className="btn-primary">
                Download
              </a>
            </div>
          )}
        </div>
      </aside>
    </>
  );
}
