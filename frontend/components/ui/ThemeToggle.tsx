"use client";

import { useEffect, useState } from "react";
import { Icon } from "./Icon";

export function ThemeToggle() {
  const [dark, setDark] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem("theme");
    if (stored === "dark" || (!stored && window.matchMedia("(prefers-color-scheme: dark)").matches)) {
      setDark(true);
      document.documentElement.setAttribute("data-theme", "dark");
    }
  }, []);

  function toggle() {
    const next = !dark;
    setDark(next);
    document.documentElement.setAttribute("data-theme", next ? "dark" : "light");
    localStorage.setItem("theme", next ? "dark" : "light");
  }

  return (
    <button
      onClick={toggle}
      title={dark ? "Switch to light mode" : "Switch to dark mode"}
      style={{
        background: "none",
        border: "1px solid var(--border-primary)",
        borderRadius: "var(--radius-sm)",
        padding: 6,
        cursor: "pointer",
        color: "var(--text-tertiary)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        transition: "all var(--transition-fast)",
      }}
    >
      {dark ? (
        <Icon path="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" size={16} />
      ) : (
        <Icon path="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z" size={16} />
      )}
    </button>
  );
}
