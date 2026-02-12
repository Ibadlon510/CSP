"use client";

import { useEffect, useState, useMemo } from "react";
import { api } from "@/lib/api";
import { useToast } from "@/components/Toast";
import { Icon } from "@/components/ui/Icon";
import { SearchFilterBar, type FilterFieldConfig } from "@/components/ui/SearchFilterBar";

interface UserItem {
  id: string;
  email: string;
  full_name: string;
  role: string;
  is_active: boolean;
  manager_id?: string;
}

export default function UsersPage() {
  const toast = useToast();
  const [users, setUsers] = useState<UserItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [filters, setFilters] = useState<Record<string, string[]>>({ role: [], is_active: [] });
  const [groupBy, setGroupBy] = useState("");

  useEffect(() => {
    loadUsers();
  }, []);

  function loadUsers() {
    setLoading(true);
    api
      .get("/api/users/")
      .then(setUsers)
      .catch((e: any) => setError(e.message))
      .finally(() => setLoading(false));
  }

  async function updateManager(userId: string, managerId: string) {
    try {
      await api.patch(`/api/users/${userId}`, { manager_id: managerId || null });
      setUsers((prev) => prev.map((u) => u.id === userId ? { ...u, manager_id: managerId || undefined } : u));
      toast.success("Manager updated");
    } catch (err: any) {
      toast.error(err.message || "Failed to update manager");
    }
  }

  const managerOptions = users.filter((u) => ["super_admin", "admin", "manager"].includes(u.role));

  const userFilterConfig: FilterFieldConfig[] = [
    { key: "role", label: "Role", options: ["super_admin", "admin", "manager", "pro", "accountant", "viewer"].map((r) => ({ value: r, label: r.replace("_", " ") })) },
    { key: "is_active", label: "Status", options: [{ value: "active", label: "Active" }, { value: "inactive", label: "Inactive" }] },
  ];
  const userGroupOptions = [{ value: "role", label: "Role" }];

  const filteredUsers = useMemo(() => {
    let list = users;
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter((u) => u.full_name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q));
    }
    if (filters.role?.length) list = list.filter((u) => filters.role.includes(u.role));
    if (filters.is_active?.includes("active")) list = list.filter((u) => u.is_active);
    if (filters.is_active?.includes("inactive")) list = list.filter((u) => !u.is_active);
    return list;
  }, [users, search, filters]);

  const getRoleBadgeClass = (role: string) => {
    if (role === "admin" || role === "super_admin") return "badge-accent";
    if (role === "manager") return "badge-info";
    if (role === "pro") return "badge-warning";
    if (role === "accountant") return "badge-success";
    return "badge-neutral";
  };

  return (
    <div>
      {/* Modern Page Header */}
      <div className="page-header">
        <div className="page-header-content">
          <h1 className="page-title">Team Members</h1>
          <p className="page-subtitle">Users in your organization</p>
        </div>
        <div className="page-header-actions">
          <button className="btn-secondary btn-sm">
            <Icon path="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4 M17 8l-5-5-5 5 M12 3v12" size={16} />
            Export
          </button>
          <button className="btn-primary" disabled>
            <Icon path="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2 M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z M20 8v6 M23 11h-6" size={18} />
            Invite User
          </button>
        </div>
      </div>

      {/* Search / Filter bar */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, flexWrap: "wrap", gap: 12 }}>
        <SearchFilterBar search={search} onSearchChange={setSearch} filters={filters} onFiltersChange={setFilters} filterConfig={userFilterConfig} groupBy={groupBy} onGroupByChange={setGroupBy} groupOptions={userGroupOptions} pageKey="users" placeholder="Search team members..." />
      </div>

      {error && (
        <div className="alert alert-danger" style={{ marginBottom: 20 }}>
          <Icon path="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z M12 9v4 M12 17h.01" size={18} />
          <span>{error}</span>
        </div>
      )}

      <div className="table-container">
        {loading ? (
          <div className="empty-state">
            <div className="loading-spinner" style={{ width: 32, height: 32 }}></div>
            <p style={{ marginTop: 16, color: "var(--text-tertiary)" }}>Loading team members...</p>
          </div>
        ) : filteredUsers.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">
              <Icon path="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2 M23 21v-2a4 4 0 0 0-3-3.87 M13 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0z M20 8a4 4 0 1 1 0-8" size={48} />
            </div>
            <div className="empty-state-title">No team members yet</div>
            <div className="empty-state-description">
              Invite users to collaborate on your organization
            </div>
          </div>
        ) : (
          <table>
            <thead>
              <tr>
                <th>User</th>
                <th>Email</th>
                <th>Role</th>
                <th>Reports To</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {filteredUsers.map((u) => (
                <tr key={u.id}>
                  <td>
                    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                      <div style={{
                        width: 36,
                        height: 36,
                        borderRadius: "var(--radius-md)",
                        background: "linear-gradient(135deg, var(--accent-blue), var(--accent-purple))",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        color: "white",
                        fontSize: 14,
                        fontWeight: 600
                      }}>
                        {u.full_name?.charAt(0) || "U"}
                      </div>
                      <span style={{ fontWeight: 600, color: "var(--text-primary)" }}>{u.full_name}</span>
                    </div>
                  </td>
                  <td style={{ color: "var(--text-tertiary)" }}>{u.email}</td>
                  <td>
                    <span className={`badge ${getRoleBadgeClass(u.role)}`}>
                      {u.role.replace("_", " ")}
                    </span>
                  </td>
                  <td>
                    <select
                      value={u.manager_id || ""}
                      onChange={(e) => updateManager(u.id, e.target.value)}
                      style={{ padding: "4px 8px", fontSize: 13, margin: 0, width: "auto", minWidth: 140 }}
                    >
                      <option value="">None</option>
                      {managerOptions.filter((m) => m.id !== u.id).map((m) => (
                        <option key={m.id} value={m.id}>{m.full_name}</option>
                      ))}
                    </select>
                  </td>
                  <td>
                    {u.is_active ? (
                      <span className="badge badge-success badge-dot">
                        Active
                      </span>
                    ) : (
                      <span className="badge badge-danger badge-dot">
                        Inactive
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Results count */}
      {!loading && filteredUsers.length > 0 && (
        <div style={{ marginTop: 16, textAlign: "center", fontSize: 13, color: "var(--text-tertiary)", fontWeight: 500 }}>
          {filteredUsers.length} team member{filteredUsers.length !== 1 ? "s" : ""} in your organization
        </div>
      )}
    </div>
  );
}
