"use client";

import { useEffect, useRef, useCallback } from "react";
import { Icon } from "./Icon";

/**
 * Shared DropdownMenu — positioned dropdown with menu items.
 */
export interface DropdownItem {
  label: string;
  icon?: string;
  onClick: () => void;
  danger?: boolean;
  disabled?: boolean;
}

interface DropdownMenuProps {
  open: boolean;
  onClose: () => void;
  items: DropdownItem[];
  align?: "left" | "right";
}

export function DropdownMenu({ open, onClose, items, align = "right" }: DropdownMenuProps) {
  const ref = useRef<HTMLDivElement>(null);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    },
    [onClose]
  );

  const handleClickOutside = useCallback(
    (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    },
    [onClose]
  );

  useEffect(() => {
    if (open) {
      document.addEventListener("keydown", handleKeyDown);
      document.addEventListener("mousedown", handleClickOutside);
      return () => {
        document.removeEventListener("keydown", handleKeyDown);
        document.removeEventListener("mousedown", handleClickOutside);
      };
    }
  }, [open, handleKeyDown, handleClickOutside]);

  if (!open) return null;

  return (
    <div
      ref={ref}
      className="dropdown-menu"
      role="menu"
      style={{ [align === "right" ? "right" : "left"]: 0 }}
    >
      {items.map((item, i) => (
        <button
          key={i}
          role="menuitem"
          className={`dropdown-item${item.danger ? " danger" : ""}`}
          disabled={item.disabled}
          onClick={() => {
            item.onClick();
            onClose();
          }}
        >
          {item.icon && <Icon path={item.icon} size={14} />}
          {item.label}
        </button>
      ))}
    </div>
  );
}
