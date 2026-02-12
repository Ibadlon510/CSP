"use client";

import { useMemo } from "react";

/* ─── Types ─── */

export interface TimelineItem {
  id: string;
  title: string;
  startDate?: string;
  endDate?: string;
  color: string;
  bg: string;
  onClick?: () => void;
  subtitle?: string;
}

interface TimelineViewProps {
  items: TimelineItem[];
  rowHeight?: number;
  dayWidth?: number;
  labelWidth?: number;
  emptyLabel?: string;
}

/* ─── Helpers ─── */

const DAY_MS = 86400000;

function parseDate(d?: string): Date | null {
  if (!d) return null;
  const parsed = new Date(d);
  return isNaN(parsed.getTime()) ? null : parsed;
}

/* ─── TimelineView ─── */

export function TimelineView({
  items,
  rowHeight = 36,
  dayWidth = 40,
  labelWidth = 180,
  emptyLabel = "No items to display on timeline",
}: TimelineViewProps) {
  const { days, startDate, totalDays } = useMemo(() => {
    const allDates: number[] = [];
    const now = Date.now();

    items.forEach((item) => {
      const s = parseDate(item.startDate);
      const e = parseDate(item.endDate);
      if (s) allDates.push(s.getTime());
      if (e) allDates.push(e.getTime());
    });

    const rangeStart = allDates.length > 0 ? Math.min(...allDates, now) : now;
    const rangeEnd = allDates.length > 0 ? Math.max(...allDates, now + 14 * DAY_MS) : now + 30 * DAY_MS;

    const sd = new Date(rangeStart - 2 * DAY_MS);
    sd.setHours(0, 0, 0, 0);

    const td = Math.max(14, Math.ceil((rangeEnd - sd.getTime()) / DAY_MS) + 4);
    const daysArr = Array.from({ length: td }, (_, i) => new Date(sd.getTime() + i * DAY_MS));

    return { days: daysArr, startDate: sd, totalDays: td };
  }, [items]);

  const dayToX = (d: Date) => ((d.getTime() - startDate.getTime()) / DAY_MS) * dayWidth;

  if (items.length === 0) {
    return (
      <div className="card" style={{ padding: "16px 20px" }}>
        <p style={{ textAlign: "center", padding: "32px 0", color: "var(--text-quaternary)", fontSize: 13 }}>
          {emptyLabel}
        </p>
      </div>
    );
  }

  return (
    <div className="card" style={{ padding: "16px 20px" }}>
      <div style={{ overflowX: "auto" }}>
        <div style={{ display: "flex", minWidth: labelWidth + totalDays * dayWidth }}>
          {/* Label column */}
          <div style={{ width: labelWidth, flexShrink: 0, borderRight: "1px solid var(--border-primary)" }}>
            <div style={{ height: 28, borderBottom: "1px solid var(--border-primary)" }} />
            {items.map((item) => (
              <div
                key={item.id}
                onClick={item.onClick}
                style={{
                  height: rowHeight,
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  padding: "0 10px",
                  fontSize: 11,
                  fontWeight: 500,
                  color: "var(--text-secondary)",
                  cursor: item.onClick ? "pointer" : "default",
                  overflow: "hidden",
                  whiteSpace: "nowrap",
                  textOverflow: "ellipsis",
                  borderBottom: "1px solid var(--border-secondary)",
                }}
              >
                <span style={{ width: 6, height: 6, borderRadius: "50%", background: item.color, flexShrink: 0 }} />
                {item.title}
              </div>
            ))}
          </div>

          {/* Chart area */}
          <div style={{ flex: 1, position: "relative" }}>
            {/* Day header */}
            <div style={{ display: "flex", height: 28, borderBottom: "1px solid var(--border-primary)" }}>
              {days.map((d, i) => {
                const isToday = d.toDateString() === new Date().toDateString();
                const isWeekend = d.getDay() === 0 || d.getDay() === 6;
                return (
                  <div
                    key={i}
                    style={{
                      width: dayWidth,
                      flexShrink: 0,
                      textAlign: "center",
                      fontSize: 9,
                      fontWeight: isToday ? 700 : 500,
                      color: isToday ? "var(--accent-blue)" : isWeekend ? "var(--text-quaternary)" : "var(--text-tertiary)",
                      lineHeight: "28px",
                      borderRight: "1px solid var(--border-secondary)",
                    }}
                  >
                    {d.getDate()}
                  </div>
                );
              })}
            </div>

            {/* Item rows with bars */}
            {items.map((item) => {
              const tStart = parseDate(item.startDate) || new Date();
              const tEnd = parseDate(item.endDate) || new Date(tStart.getTime() + 3 * DAY_MS);
              const left = dayToX(tStart);
              const width = Math.max(dayWidth, dayToX(tEnd) - left);

              return (
                <div key={item.id} style={{ height: rowHeight, position: "relative", borderBottom: "1px solid var(--border-secondary)" }}>
                  {/* Grid lines */}
                  {days.map((d, i) => (
                    <div
                      key={i}
                      style={{
                        position: "absolute",
                        left: i * dayWidth,
                        top: 0,
                        bottom: 0,
                        width: dayWidth,
                        borderRight: "1px solid var(--border-secondary)",
                        background:
                          d.toDateString() === new Date().toDateString()
                            ? "var(--accent-blue-light)"
                            : d.getDay() === 0 || d.getDay() === 6
                            ? "var(--bg-tertiary)"
                            : "transparent",
                        opacity: 0.5,
                      }}
                    />
                  ))}
                  {/* Bar */}
                  <div
                    onClick={item.onClick}
                    style={{
                      position: "absolute",
                      top: 8,
                      height: rowHeight - 16,
                      left,
                      width,
                      background: item.bg,
                      border: `1px solid ${item.color}40`,
                      borderRadius: "var(--radius-sm)",
                      cursor: item.onClick ? "pointer" : "default",
                      display: "flex",
                      alignItems: "center",
                      padding: "0 6px",
                      overflow: "hidden",
                      zIndex: 2,
                    }}
                  >
                    <span
                      style={{
                        fontSize: 10,
                        fontWeight: 600,
                        color: item.color,
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                      }}
                    >
                      {item.title}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
