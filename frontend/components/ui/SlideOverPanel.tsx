"use client";

import { useEffect, useCallback } from "react";
import { Icon } from "./Icon";

/**
 * Shared SlideOverPanel — right-side panel for detail views, forms, previews.
 * Reconciles CRM SlidePanel and DocumentViewer into one standard.
 */
interface SlideOverPanelProps {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  width?: number;
}

export function SlideOverPanel({
  open,
  onClose,
  title,
  subtitle,
  children,
  footer,
  width = 560,
}: SlideOverPanelProps) {
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    },
    [onClose]
  );

  useEffect(() => {
    if (open) {
      document.addEventListener("keydown", handleKeyDown);
      return () => document.removeEventListener("keydown", handleKeyDown);
    }
  }, [open, handleKeyDown]);

  if (!open) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="slide-over-backdrop"
        onClick={onClose}
        aria-hidden="true"
      />
      {/* Panel */}
      <div
        className="slide-over-panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="slide-over-title"
        style={{ width, maxWidth: "90vw", display: "flex", flexDirection: "column" }}
      >
        {/* Header */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            padding: "20px 24px",
            borderBottom: "1px solid var(--border-primary)",
            position: "sticky",
            top: 0,
            background: "var(--bg-secondary)",
            zIndex: 1,
          }}
        >
          <div>
            <h3 id="slide-over-title" style={{ fontSize: 16, fontWeight: 700, color: "var(--text-primary)", margin: 0 }}>
              {title}
            </h3>
            {subtitle && (
              <p style={{ fontSize: 12, color: "var(--text-quaternary)", marginTop: 2, margin: 0 }}>
                {subtitle}
              </p>
            )}
          </div>
          <button
            onClick={onClose}
            className="btn-ghost"
            style={{ padding: 6, flexShrink: 0 }}
            aria-label="Close panel"
          >
            <Icon path="M18 6L6 18M6 6l12 12" size={16} />
          </button>
        </div>

        {/* Body */}
        <div style={{ flex: 1, padding: 24, overflowY: "auto" }}>{children}</div>

        {/* Footer (optional) */}
        {footer && (
          <div
            style={{
              padding: "16px 24px",
              borderTop: "1px solid var(--border-primary)",
              display: "flex",
              gap: 12,
              background: "var(--bg-secondary)",
              position: "sticky",
              bottom: 0,
            }}
          >
            {footer}
          </div>
        )}
      </div>
    </>
  );
}
