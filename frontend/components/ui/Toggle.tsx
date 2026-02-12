"use client";

/**
 * Shared Toggle — accessible switch component with label.
 * Used in HandoverTab, settings forms, and filters.
 */
interface ToggleProps {
  id: string;
  checked: boolean;
  onChange: (value: boolean) => void;
  label: string;
  disabled?: boolean;
}

export function Toggle({ id, checked, onChange, label, disabled = false }: ToggleProps) {
  return (
    <label
      htmlFor={id}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 10,
        cursor: disabled ? "not-allowed" : "pointer",
        userSelect: "none",
        opacity: disabled ? 0.5 : 1,
      }}
    >
      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => !disabled && onChange(!checked)}
        style={{
          width: 36,
          height: 20,
          borderRadius: 10,
          position: "relative",
          transition: "background var(--transition-fast)",
          background: checked ? "var(--accent-blue)" : "var(--border-primary)",
          cursor: disabled ? "not-allowed" : "pointer",
          border: "none",
          padding: 0,
          flexShrink: 0,
        }}
      >
        <span
          style={{
            width: 16,
            height: 16,
            borderRadius: "50%",
            background: "#fff",
            position: "absolute",
            top: 2,
            left: checked ? 18 : 2,
            transition: "left var(--transition-fast)",
            boxShadow: "var(--shadow-sm)",
          }}
        />
      </button>
      <span style={{ fontSize: 13, fontWeight: 500, color: "var(--text-secondary)" }}>
        {label}
      </span>
    </label>
  );
}
