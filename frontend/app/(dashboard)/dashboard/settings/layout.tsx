"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import { api } from "@/lib/api";
import { Icon } from "@/components/ui/Icon";

const SETTINGS_TABS = [
  { key: "system" as const, label: "System", href: "/dashboard/settings/system", icon: "M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" },
  { key: "technical" as const, label: "Technical", href: "/dashboard/settings/technical", icon: "M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" },
  { key: "defaults" as const, label: "Defaults", href: "/dashboard/settings/defaults", icon: "M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" },
  { key: "access_rights" as const, label: "Access Rights", href: "/dashboard/settings/access", icon: "M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" },
  { key: "modules" as const, label: "Modules", href: "/dashboard/settings/modules", icon: "M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6z M14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6z M4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2z M14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" },
  { key: "approvals" as const, label: "Approvals", href: "/dashboard/settings/approvals", icon: "M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" },
];

interface VisibleSections {
  system: boolean;
  technical: boolean;
  defaults: boolean;
  access_rights: boolean;
  modules: boolean;
  approvals: boolean;
}

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [visible, setVisible] = useState<VisibleSections | null>(null);

  const visibleTabs = visible
    ? SETTINGS_TABS.filter((tab) => visible[tab.key])
    : [];

  useEffect(() => {
    api
      .get("/api/settings/access/visible-sections")
      .then(setVisible)
      .catch(() => router.push("/dashboard"));
  }, [router]);

  useEffect(() => {
    if (visible !== null && visibleTabs.length === 0) {
      router.replace("/dashboard");
    }
  }, [visible, visibleTabs.length, router]);

  if (visible === null) {
    return (
      <div style={{ display: "flex", justifyContent: "center", alignItems: "center", minHeight: 300 }}>
        <div className="loading-spinner" style={{ width: 32, height: 32 }}></div>
      </div>
    );
  }

  if (visibleTabs.length === 0) {
    return null;
  }

  return (
    <div>
      <div style={{ marginBottom: 32 }}>
        <h1 style={{ fontSize: 28, fontWeight: 800, letterSpacing: "-0.025em", marginBottom: 4 }}>
          Settings
        </h1>
        <p style={{ fontSize: 15, color: "var(--text-tertiary)" }}>
          System, technical info, defaults, access rights, and module configuration
        </p>
      </div>

      <div style={{ display: "flex", gap: 24, flexWrap: "wrap" }}>
        <nav
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 2,
            minWidth: 200,
            flexShrink: 0,
          }}
        >
          {visibleTabs.map((tab) => {
            const active = pathname === tab.href;
            return (
              <Link
                key={tab.href}
                href={tab.href}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  padding: "10px 14px",
                  fontSize: 14,
                  fontWeight: active ? 600 : 500,
                  color: active ? "var(--sidebar-text-active)" : "var(--sidebar-text)",
                  background: active ? "var(--sidebar-active)" : "transparent",
                  borderRadius: "var(--radius-md)",
                  textDecoration: "none",
                  transition: "all var(--transition-fast)",
                }}
              >
                <Icon path={tab.icon} size={18} />
                {tab.label}
              </Link>
            );
          })}
        </nav>
        <div style={{ flex: 1, minWidth: 0 }}>{children}</div>
      </div>
    </div>
  );
}
