"use client";

import { Icon } from "./Icon";

/**
 * Shared StatusStepper — linear step indicator for Orders, Invoices, Quotations.
 * Replaces 3 near-identical copies.
 */
export interface StepConfig {
  key: string;
  label: string;
  icon: string;
  color: string;
  bg: string;
  border: string;
}

interface StatusStepperProps {
  steps: StepConfig[];
  currentStep: string;
}

export function StatusStepper({ steps, currentStep }: StatusStepperProps) {
  const currentIndex = steps.findIndex((s) => s.key === currentStep);

  return (
    <div style={{ display: "flex", alignItems: "center", width: "100%", gap: 0 }}>
      {steps.map((step, i) => {
        const isReached = i <= currentIndex;
        const isCurrent = i === currentIndex;
        const stepColor = isReached ? step.color : "var(--text-quaternary)";

        return (
          <div key={step.key} style={{ display: "contents" }}>
            {/* Connector line before step (except first) */}
            {i > 0 && (
              <div
                style={{
                  flex: 1,
                  height: 2,
                  minWidth: 24,
                  borderRadius: 1,
                  background: isReached ? step.color : "var(--border-primary)",
                  opacity: isReached ? 0.4 : 1,
                }}
              />
            )}

            {/* Step node */}
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
              {isCurrent ? (
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    padding: "6px 14px",
                    borderRadius: "var(--radius-full)",
                    background: step.bg,
                    border: `1.5px solid ${step.border}`,
                  }}
                >
                  <div
                    style={{
                      width: 22,
                      height: 22,
                      borderRadius: "50%",
                      background: step.color,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      color: "white",
                    }}
                  >
                    <Icon path={step.icon} size={12} />
                  </div>
                  <span style={{ fontSize: 12, fontWeight: 700, color: step.color, textTransform: "capitalize" }}>
                    {step.label}
                  </span>
                </div>
              ) : isReached ? (
                <div
                  style={{
                    width: 22,
                    height: 22,
                    borderRadius: "50%",
                    background: step.color,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color: "white",
                  }}
                >
                  <Icon path={step.icon} size={12} />
                </div>
              ) : (
                <div
                  style={{
                    width: 22,
                    height: 22,
                    borderRadius: "50%",
                    background: "var(--bg-tertiary)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <div
                    style={{
                      width: 6,
                      height: 6,
                      borderRadius: "50%",
                      background: "var(--border-hover)",
                    }}
                  />
                </div>
              )}

              {/* Label (only for non-current reached & future steps) */}
              {!isCurrent && (
                <span
                  style={{
                    fontSize: 12,
                    fontWeight: 500,
                    color: isReached ? "var(--text-secondary)" : "var(--text-quaternary)",
                    textTransform: "capitalize",
                    whiteSpace: "nowrap",
                  }}
                >
                  {step.label}
                </span>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
