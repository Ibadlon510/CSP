"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import { getMe, logout, type User } from "@/lib/auth";
import { api } from "@/lib/api";
import { DocumentViewerProvider } from "@/components/DocumentViewer";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import { Icon } from "@/components/ui/Icon";

const NAV_ITEMS = [
  { label: "Dashboard", href: "/dashboard", icon: "M3 13h8V3H3v10zm0 8h8v-6H3v6zm10 0h8V11h-8v10zm0-18v6h8V3h-8z", moduleId: null as string | null },
  { label: "Contacts", href: "/dashboard/contacts", icon: "M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2 M16 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0z", moduleId: "contacts" },
  { label: "CRM", href: "/dashboard/crm", icon: "M22 12h-4l-3 9L9 3l-3 9H2", moduleId: "crm" },
  { label: "Quotations", href: "/dashboard/quotations", icon: "M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z M14 2v6h6 M16 13H8 M16 17H8 M10 9H8", moduleId: "quotations" },
  { label: "Orders", href: "/dashboard/orders", icon: "M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z", moduleId: "orders" },
  { label: "Invoices", href: "/dashboard/invoices", icon: "M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z M14 2v6h6 M12 18v-6 M9 15h6", moduleId: "invoices" },
  { label: "Documents", href: "/dashboard/documents", icon: "M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z M11 3v6h6", moduleId: "documents" },
  { label: "Wallets", href: "/dashboard/wallets", icon: "M21 12V7H5a2 2 0 0 1 0-4h14v4 M3 5v14a2 2 0 0 0 2 2h16v-5 M18 12a2 2 0 0 0 0 4h4v-4h-4z", moduleId: "wallets" },
  { label: "Projects", href: "/dashboard/projects", icon: "M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2M9 5a2 2 0 0 0 2 2h2a2 2 0 0 0 2-2M9 5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2", moduleId: "projects" },
  { label: "Task", href: "/dashboard/tasks", icon: "M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4", moduleId: "projects" },
  { label: "Calendar", href: "/dashboard/calendar", icon: "M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z", moduleId: "calendar" },
  { label: "Products", href: "/dashboard/products", icon: "M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4", moduleId: null, roles: ["super_admin", "admin", "manager"] },
  { label: "Compliance", href: "/dashboard/compliance", icon: "M9 12l2 2 4-4 M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z", moduleId: "compliance" },
  { label: "Users", href: "/dashboard/users", icon: "M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2 M23 21v-2a4 4 0 0 0-3-3.87 M13 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0z M20 8a4 4 0 1 1 0-8", moduleId: "users" },
  { label: "Audit Log", href: "/dashboard/audit-log", icon: "M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z", moduleId: null, roles: ["super_admin", "admin"] },
  { label: "Settings", href: "/dashboard/settings", icon: "M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z M15 12a3 3 0 11-6 0 3 3 0 016 0z", moduleId: null, roles: ["super_admin", "admin", "manager", "accountant"] },
];

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [enabledModules, setEnabledModules] = useState<Record<string, boolean> | null>(null);
  const [favorites, setFavorites] = useState<{ id: string; project_id: string; project_title: string; project_status?: string }[]>([]);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  function loadFavorites() {
    api.get("/api/projects/favorites").then((d: any) => setFavorites(d)).catch(() => {});
  }

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) {
      router.replace("/login");
      return;
    }
    getMe()
      .then(setUser)
      .catch(() => router.replace("/login"))
      .finally(() => setLoading(false));

    // Listen for 401 logout events from the API layer (soft redirect)
    const onAuthLogout = () => router.replace("/login");
    window.addEventListener("auth:logout", onAuthLogout);
    return () => window.removeEventListener("auth:logout", onAuthLogout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!user) return;
    api
      .get("/api/settings/modules")
      .then((data: any) => {
        const map: Record<string, boolean> = {};
        data.modules.forEach((m: any) => { map[m.module_id] = m.enabled; });
        setEnabledModules(map);
      })
      .catch(() => setEnabledModules({}));
    loadFavorites();
  }, [user]);

  // Close mobile sidebar on route change
  useEffect(() => {
    setSidebarOpen(false);
  }, [pathname]);

  if (loading) {
    return (
      <div className="flex items-center justify-center" style={{ height: "100vh" }}>
        <div className="loading-spinner" style={{ width: 32, height: 32 }}></div>
      </div>
    );
  }

  return (
    <div className="dashboard-shell">
      {/* Mobile hamburger button */}
      <button
        className="mobile-menu-btn"
        onClick={() => setSidebarOpen(!sidebarOpen)}
        aria-label="Toggle sidebar"
      >
        <Icon path={sidebarOpen ? "M18 6L6 18M6 6l12 12" : "M4 6h16M4 12h16M4 18h16"} size={20} />
      </button>

      {/* Mobile backdrop */}
      {sidebarOpen && (
        <div
          className="sidebar-backdrop"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Modern Sidebar */}
      <aside className={`dashboard-sidebar${sidebarOpen ? " open" : ""}`}>
        {/* Logo Section */}
        <div style={{ 
          padding: "24px 20px",
          borderBottom: "1px solid var(--sidebar-border)"
        }}>
          <div style={{
            display: "flex",
            alignItems: "center",
            gap: 12
          }}>
            <div style={{
              width: 36,
              height: 36,
              background: "var(--brand-primary)",
              borderRadius: "var(--radius-md)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "white",
              fontSize: 18,
              fontWeight: 700
            }}>
              C
            </div>
            <div>
              <h2 style={{ 
                color: "var(--text-primary)", 
                fontSize: 16, 
                fontWeight: 700, 
                letterSpacing: "-0.015em",
                lineHeight: 1
              }}>
                CSP ERP
              </h2>
              <p style={{ 
                fontSize: 11, 
                color: "var(--text-tertiary)",
                fontWeight: 500,
                marginTop: 2
              }}>
                {user?.org_name || "Organization"}
              </p>
            </div>
          </div>
        </div>

        {/* Pinned / Favourites */}
        {favorites.length > 0 && (
          <div style={{ padding: "12px 12px 0", borderBottom: "1px solid var(--sidebar-border)" }}>
            <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--text-quaternary)", padding: "0 12px 6px" }}>
              Pinned
            </div>
            {favorites.map((fav) => {
              const active = pathname === `/dashboard/projects/${fav.project_id}`;
              return (
                <Link
                  key={fav.project_id}
                  href={`/dashboard/projects/${fav.project_id}`}
                  style={{
                    display: "flex", alignItems: "center", gap: 10, padding: "8px 12px", marginBottom: 2,
                    fontSize: 13, fontWeight: active ? 600 : 500,
                    color: active ? "var(--sidebar-text-active)" : "var(--sidebar-text)",
                    background: active ? "var(--sidebar-active)" : "transparent",
                    borderRadius: "var(--radius-md)", textDecoration: "none",
                    transition: "all var(--transition-fast)", overflow: "hidden",
                  }}
                  onMouseEnter={(e) => { if (!active) { e.currentTarget.style.background = "var(--sidebar-hover)"; e.currentTarget.style.color = "var(--sidebar-text-active)"; } }}
                  onMouseLeave={(e) => { if (!active) { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "var(--sidebar-text)"; } }}
                >
                  <Icon path="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" size={14} />
                  <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{fav.project_title}</span>
                </Link>
              );
            })}
            <div style={{ height: 8 }} />
          </div>
        )}

        {/* Navigation */}
        <nav style={{ 
          flex: 1, 
          padding: "16px 12px",
          overflowY: "auto"
        }}>
          {NAV_ITEMS.filter((item) => {
            const roles = (item as { roles?: string[] }).roles;
            if (roles && user && !roles.includes(user.role)) return false;
            if (item.moduleId && enabledModules !== null) {
              return enabledModules[item.moduleId] !== false;
            }
            return true;
          }).map((item) => {
            const active = pathname === item.href
              || (item.href === "/dashboard/settings" && pathname.startsWith("/dashboard/settings"))
              || (item.href === "/dashboard/products" && pathname.startsWith("/dashboard/products"));
            return (
              <Link
                key={item.href}
                href={item.href}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  padding: "10px 12px",
                  margin: "2px 0",
                  fontSize: 14,
                  fontWeight: active ? 600 : 500,
                  color: active ? "var(--sidebar-text-active)" : "var(--sidebar-text)",
                  background: active ? "var(--sidebar-active)" : "transparent",
                  borderRadius: "var(--radius-md)",
                  textDecoration: "none",
                  transition: "all var(--transition-fast)",
                  letterSpacing: "-0.011em",
                  position: "relative",
                }}
                onMouseEnter={(e) => {
                  if (!active) {
                    e.currentTarget.style.background = "var(--sidebar-hover)";
                    e.currentTarget.style.color = "var(--sidebar-text-active)";
                  }
                }}
                onMouseLeave={(e) => {
                  if (!active) {
                    e.currentTarget.style.background = "transparent";
                    e.currentTarget.style.color = "var(--sidebar-text)";
                  }
                }}
              >
                {active && (
                  <div style={{
                    position: "absolute",
                    left: 0,
                    top: "50%",
                    transform: "translateY(-50%)",
                    width: 3,
                    height: 20,
                    background: "var(--brand-primary)",
                    borderRadius: "0 2px 2px 0"
                  }} />
                )}
                <Icon path={item.icon} size={18} />
                {item.label}
              </Link>
            );
          })}
        </nav>

        {/* User Section */}
        <div style={{ 
          padding: "16px",
          borderTop: "1px solid var(--sidebar-border)",
          display: "flex",
          flexDirection: "column",
          gap: 12,
        }}>
          <div style={{ 
            background: "var(--bg-tertiary)", 
            borderRadius: "var(--radius-lg)", 
            padding: "12px",
            border: "1px solid var(--border-primary)"
          }}>
            <div style={{
              display: "flex",
              alignItems: "center",
              gap: 10
            }}>
              <div style={{
                width: 32,
                height: 32,
                borderRadius: "var(--radius-md)",
                background: "linear-gradient(135deg, var(--accent-blue), var(--accent-purple))",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "white",
                fontSize: 13,
                fontWeight: 600
              }}>
                {user?.full_name?.charAt(0) || "U"}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p className="truncate" style={{ 
                  fontSize: 13, 
                  color: "var(--text-primary)",
                  fontWeight: 600,
                  lineHeight: 1.3
                }}>
                  {user?.full_name}
                </p>
                <p className="truncate" style={{ 
                  fontSize: 11, 
                  color: "var(--text-tertiary)",
                  fontWeight: 500
                }}>
                  {user?.role}
                </p>
              </div>
            </div>
          </div>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <ThemeToggle />
            <button 
              className="btn-ghost btn-sm" 
              style={{ 
                flex: 1,
                justifyContent: "center",
                color: "var(--danger)",
                fontWeight: 600
              }} 
              onClick={logout}
            >
              <Icon path="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4 M16 17l5-5-5-5 M21 12H9" size={16} />
              Sign out
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="dashboard-main">
        <DocumentViewerProvider>
          {children}
        </DocumentViewerProvider>
      </main>
    </div>
  );
}
