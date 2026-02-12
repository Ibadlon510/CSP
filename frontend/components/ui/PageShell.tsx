"use client";

import Link from "next/link";
import { Icon } from "./Icon";

/**
 * Shared PageShell — handles loading, not-found, and error states consistently.
 * Wraps page content with standard loading spinner or not-found message.
 */
interface PageShellProps {
  loading: boolean;
  notFound?: boolean;
  error?: string | null;
  entityName: string;
  backHref: string;
  backLabel: string;
  title?: string;
  children: React.ReactNode;
}

export function PageShell({
  loading,
  notFound,
  error,
  entityName,
  backHref,
  backLabel,
  title,
  children,
}: PageShellProps) {
  if (loading) {
    return (
      <div>
        <div className="page-header">
          <div className="page-header-content">
            <h1 className="page-title">{title || entityName}</h1>
            <p className="page-subtitle">Loading...</p>
          </div>
        </div>
        <div style={{ display: "flex", justifyContent: "center", alignItems: "center", padding: 80 }}>
          <div className="loading-spinner" style={{ width: 32, height: 32 }} />
        </div>
      </div>
    );
  }

  if (notFound) {
    return (
      <div>
        <div className="page-header">
          <div className="page-header-content">
            <h1 className="page-title">Not Found</h1>
          </div>
        </div>
        <div className="empty-state">
          <div className="empty-state-icon">
            <Icon path="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z M12 9v4 M12 17h.01" size={48} />
          </div>
          <div className="empty-state-title">{entityName} not found</div>
          <div className="empty-state-description">
            This {entityName.toLowerCase()} may have been deleted or you don&apos;t have permission to view it.
          </div>
          <Link href={backHref} className="btn-primary">
            <Icon path="M19 12H5 M12 19l-7-7 7-7" size={16} />
            {backLabel}
          </Link>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div>
        <div className="page-header">
          <div className="page-header-content">
            <h1 className="page-title">{title || entityName}</h1>
          </div>
        </div>
        <div className="card" style={{ background: "var(--danger-light)", borderColor: "var(--danger-border)" }}>
          <p style={{ margin: 0, color: "var(--danger)", fontSize: 14 }}>{error}</p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
