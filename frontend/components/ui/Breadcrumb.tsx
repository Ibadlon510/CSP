"use client";

import Link from "next/link";
import { Icon } from "./Icon";

/**
 * Shared Breadcrumb component with context-aware navigation.
 */
export interface BreadcrumbItem {
  label: string;
  href?: string;
}

interface BreadcrumbProps {
  items: BreadcrumbItem[];
}

const chevronPath = "M9 18l6-6-6-6";

export function Breadcrumb({ items }: BreadcrumbProps) {
  return (
    <nav className="breadcrumb" aria-label="Breadcrumb">
      {items.map((item, i) => {
        const isLast = i === items.length - 1;
        return (
          <span key={i} style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
            {i > 0 && <Icon path={chevronPath} size={14} />}
            {isLast || !item.href ? (
              <span className={isLast ? "current" : undefined}>{item.label}</span>
            ) : (
              <Link href={item.href}>{item.label}</Link>
            )}
          </span>
        );
      })}
    </nav>
  );
}
