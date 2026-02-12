"use client";

/**
 * Shared FormField — label + input/select/textarea + optional hint.
 * Replaces duplicated FieldGroup / FieldLabel patterns across the codebase.
 */
interface FormFieldProps {
  label: string;
  children: React.ReactNode;
  hint?: string;
  required?: boolean;
  error?: string;
}

export function FormField({ label, children, hint, required, error }: FormFieldProps) {
  return (
    <div>
      <label
        style={{
          fontSize: 11,
          fontWeight: 600,
          color: "var(--text-quaternary)",
          textTransform: "uppercase",
          letterSpacing: "0.05em",
          marginBottom: 6,
          display: "block",
        }}
      >
        {label}
        {required && <span style={{ color: "var(--danger)", marginLeft: 2 }}>*</span>}
      </label>
      {children}
      {hint && (
        <span
          style={{
            fontSize: 11,
            color: "var(--text-quaternary)",
            marginTop: 4,
            display: "block",
          }}
        >
          {hint}
        </span>
      )}
      {error && (
        <span
          style={{
            fontSize: 11,
            color: "var(--danger)",
            marginTop: 4,
            display: "block",
            fontWeight: 500,
          }}
        >
          {error}
        </span>
      )}
    </div>
  );
}
