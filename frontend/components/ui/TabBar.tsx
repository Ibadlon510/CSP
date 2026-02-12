"use client";

/**
 * Shared TabBar component — underline style, unified across all pages.
 * Replaces pill tabs (contacts), button-toggle tabs (CRM), and inline tab bars.
 */
export interface Tab {
  key: string;
  label: string;
  count?: number;
}

interface TabBarProps {
  tabs: Tab[];
  activeTab: string;
  onTabChange: (key: string) => void;
}

export function TabBar({ tabs, activeTab, onTabChange }: TabBarProps) {
  return (
    <div className="tab-bar" role="tablist">
      {tabs.map((tab) => (
        <button
          key={tab.key}
          role="tab"
          aria-selected={activeTab === tab.key}
          className={`tab-bar-btn${activeTab === tab.key ? " active" : ""}`}
          onClick={() => onTabChange(tab.key)}
        >
          {tab.label}
          {tab.count != null && (
            <span
              style={{
                fontSize: 11,
                fontWeight: 700,
                borderRadius: "var(--radius-full)",
                padding: "1px 7px",
                lineHeight: "16px",
                marginLeft: 6,
                background: activeTab === tab.key ? "var(--brand-primary)" : "var(--bg-tertiary)",
                color: activeTab === tab.key ? "var(--text-inverse)" : "var(--text-tertiary)",
              }}
            >
              {tab.count}
            </span>
          )}
        </button>
      ))}
    </div>
  );
}
