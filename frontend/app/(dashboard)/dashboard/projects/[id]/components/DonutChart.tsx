"use client";

type CategoryProgress = Record<string, { total: number; completed: number }>;

const COLORS = [
  "#0066ff", "#8b5cf6", "#ec4899", "#f59e0b", "#22c55e",
  "#ef4444", "#06b6d4", "#84cc16", "#f97316", "#6366f1",
];

export default function DonutChart({
  categories,
  size = 140,
  strokeWidth = 18,
}: {
  categories: CategoryProgress;
  size?: number;
  strokeWidth?: number;
}) {
  const entries = Object.entries(categories);
  const totalTasks = entries.reduce((s, [, v]) => s + v.total, 0);
  const totalDone = entries.reduce((s, [, v]) => s + v.completed, 0);
  const pct = totalTasks > 0 ? Math.round((totalDone / totalTasks) * 100) : 0;

  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const center = size / 2;

  // Build arcs
  let offset = 0;
  const arcs = entries.map(([cat, val], i) => {
    const fraction = totalTasks > 0 ? val.total / totalTasks : 0;
    const dashLen = fraction * circumference;
    const dashGap = circumference - dashLen;
    const completedFraction = val.total > 0 ? val.completed / val.total : 0;
    const arc = (
      <circle
        key={cat}
        cx={center}
        cy={center}
        r={radius}
        fill="none"
        stroke={COLORS[i % COLORS.length]}
        strokeWidth={strokeWidth}
        strokeDasharray={`${dashLen} ${dashGap}`}
        strokeDashoffset={-offset}
        strokeLinecap="round"
        opacity={completedFraction < 1 ? 0.35 : 1}
        style={{ transition: "all 0.5s ease" }}
      />
    );
    offset += dashLen;
    return arc;
  });

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12 }}>
      <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
        <circle
          cx={center}
          cy={center}
          r={radius}
          fill="none"
          stroke="var(--bg-tertiary)"
          strokeWidth={strokeWidth}
        />
        {arcs}
        {/* Center text */}
        <text
          x={center}
          y={center}
          textAnchor="middle"
          dominantBaseline="central"
          style={{
            transform: "rotate(90deg)",
            transformOrigin: `${center}px ${center}px`,
            fontSize: 28,
            fontWeight: 700,
            fill: "var(--text-primary)",
          }}
        >
          {pct}%
        </text>
      </svg>
      <div style={{ display: "flex", flexWrap: "wrap", gap: "6px 16px", justifyContent: "center" }}>
        {entries.map(([cat, val], i) => (
          <div key={cat} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "var(--text-secondary)" }}>
            <span
              style={{
                width: 8,
                height: 8,
                borderRadius: "50%",
                background: COLORS[i % COLORS.length],
                display: "inline-block",
                opacity: val.completed === val.total && val.total > 0 ? 1 : 0.5,
              }}
            />
            {cat}: {val.completed}/{val.total}
          </div>
        ))}
      </div>
    </div>
  );
}
