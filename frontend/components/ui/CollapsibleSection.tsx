"use client";

import { useState } from "react";
import { Icon } from "./Icon";

/**
 * Shared CollapsibleSection — expandable/collapsible content group.
 * Used in Contact Details form and Project Settings.
 */
interface CollapsibleSectionProps {
  title: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}

export function CollapsibleSection({ title, defaultOpen = true, children }: CollapsibleSectionProps) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          width: "100%",
          padding: "12px 0",
          marginBottom: open ? 16 : 0,
          background: "none",
          border: "none",
          cursor: "pointer",
        }}
      >
        <span style={{ fontSize: 16, fontWeight: 600, color: "var(--text-primary)" }}>{title}</span>
        <Icon path={open ? "M6 9l6 6 6-6" : "M9 18l6-6-6-6"} size={16} />
      </button>
      {open && children}
    </div>
  );
}
