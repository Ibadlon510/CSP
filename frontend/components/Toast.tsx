"use client";

import React, { createContext, useCallback, useContext, useState } from "react";

export type ToastType = "success" | "error" | "warning" | "info" | "default";

export interface ToastItem {
  id: string;
  message: string;
  type: ToastType;
  duration?: number;
  createdAt: number;
}

interface ToastContextValue {
  toasts: ToastItem[];
  toast: (message: string, type?: ToastType, duration?: number) => void;
  success: (message: string, duration?: number) => void;
  error: (message: string, duration?: number) => void;
  warning: (message: string, duration?: number) => void;
  info: (message: string, duration?: number) => void;
  dismiss: (id: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

const DEFAULT_DURATION = 5000;
const MAX_TOASTS = 5;

function generateId() {
  return `toast-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

// Icon paths (Feather-style)
const ICONS: Record<ToastType, string> = {
  success: "M22 11.08V12a10 10 0 1 1-5.93-9.14 M22 4L12 14.01l-3-3",
  error: "M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z M12 9v4 M12 17h.01",
  warning: "M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z M12 9v4 M12 17h.01",
  info: "M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z M12 16v-4 M12 8h.01",
  default: "M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z",
};

function ToastIcon({ type, size = 20 }: { type: ToastType; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d={ICONS[type]} />
    </svg>
  );
}

function ToastItemComponent({
  item,
  onDismiss,
}: {
  item: ToastItem;
  onDismiss: (id: string) => void;
}) {
  const duration = item.duration ?? DEFAULT_DURATION;

  React.useEffect(() => {
    if (duration <= 0) return;
    const t = setTimeout(() => onDismiss(item.id), duration);
    return () => clearTimeout(t);
  }, [item.id, duration, onDismiss]);

  return (
    <div
      className={`toast toast-${item.type}`}
      role="alert"
      aria-live="polite"
    >
      <div className="toast-icon">
        <ToastIcon type={item.type} size={20} />
      </div>
      <p className="toast-message">{item.message}</p>
      <button
        type="button"
        className="toast-close"
        onClick={() => onDismiss(item.id)}
        aria-label="Dismiss notification"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M18 6L6 18 M6 6l12 12" />
        </svg>
      </button>
    </div>
  );
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const dismiss = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const addToast = useCallback(
    (message: string, type: ToastType = "default", duration: number = DEFAULT_DURATION) => {
      const id = generateId();
      const item: ToastItem = { id, message, type, duration, createdAt: Date.now() };
      setToasts((prev) => {
        const next = [item, ...prev].slice(0, MAX_TOASTS);
        return next;
      });
      return id;
    },
    []
  );

  const toast = useCallback(
    (message: string, type?: ToastType, duration?: number) => {
      return addToast(message, type ?? "default", duration ?? DEFAULT_DURATION);
    },
    [addToast]
  );

  const success = useCallback((message: string, duration?: number) => addToast(message, "success", duration ?? DEFAULT_DURATION), [addToast]);
  const error = useCallback((message: string, duration?: number) => addToast(message, "error", duration ?? DEFAULT_DURATION), [addToast]);
  const warning = useCallback((message: string, duration?: number) => addToast(message, "warning", duration ?? DEFAULT_DURATION), [addToast]);
  const info = useCallback((message: string, duration?: number) => addToast(message, "info", duration ?? DEFAULT_DURATION), [addToast]);

  const value: ToastContextValue = {
    toasts,
    toast,
    success,
    error,
    warning,
    info,
    dismiss,
  };

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="toast-container" aria-label="Notifications">
        {toasts.map((item) => (
          <ToastItemComponent key={item.id} item={item} onDismiss={dismiss} />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error("useToast must be used within ToastProvider");
  }
  return ctx;
}
