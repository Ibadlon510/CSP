"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { useToast } from "@/components/Toast";
import { Icon } from "@/components/ui/Icon";
import { fmtDate } from "@/lib/format";

type RelatedParty = {
  link_id: string;
  contact_id: string;
  contact_name?: string;
  contact_type?: string;
  passport_no?: string;
  nationality?: string;
  percentage?: number;
  link_type?: string;
  is_ubo?: boolean;
  is_secretary?: boolean;
  is_poa_authorized?: boolean;
  role_label?: string;
  number_of_shares?: number;
};

type ComplianceData = {
  project_id: string;
  client_contact_id?: string;
  screening_form?: { document_id: string; file_name: string; file_path: string; submitted_at?: string };
  onboarding_form?: { document_id: string; file_name: string; file_path: string; submitted_at?: string };
  related_parties: RelatedParty[];
};

type ContactOption = { id: string; name: string; contact_type?: string };

const LINK_TYPES = [
  { value: "ownership", label: "Shareholder" },
  { value: "director", label: "Director" },
  { value: "manages", label: "Manager" },
  { value: "employee", label: "Employee" },
  { value: "family", label: "Family" },
];

const ROLE_BADGE_COLORS: Record<string, { color: string; bg: string }> = {
  Shareholder: { color: "#7c3aed", bg: "#f5f3ff" },
  Director: { color: "#0066ff", bg: "#e6f2ff" },
  Manager: { color: "#059669", bg: "#ecfdf5" },
  UBO: { color: "#dc2626", bg: "#fef2f2" },
  Secretary: { color: "#b45309", bg: "#fffbeb" },
  POA: { color: "#ec4899", bg: "#fce7f3" },
};

/* ── Reusable styled primitives ── */

const SectionCard = ({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) => (
  <div style={{
    background: "var(--bg-secondary)", borderRadius: "var(--radius-lg)", border: "1px solid var(--border-primary)",
    padding: "24px 28px", marginBottom: 20, boxShadow: "var(--shadow-xs)", ...style,
  }}>{children}</div>
);

const SectionLabel = ({ icon, children, trailing }: { icon?: string; children: React.ReactNode; trailing?: React.ReactNode }) => (
  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      {icon && <Icon path={icon} size={16} color="var(--text-quaternary)" />}
      <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--text-quaternary)" }}>{children}</span>
    </div>
    {trailing}
  </div>
);

const FieldGroup = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <div>
    <label style={{ fontSize: 12, fontWeight: 500, color: "var(--text-tertiary)", marginBottom: 6, display: "block" }}>{label}</label>
    {children}
  </div>
);

export default function ComplianceTab({ projectId }: { projectId: string }) {
  const toast = useToast();
  const [data, setData] = useState<ComplianceData | null>(null);
  const [loading, setLoading] = useState(true);
  const [showPanel, setShowPanel] = useState(false);
  const [contacts, setContacts] = useState<ContactOption[]>([]);
  const [showCreateContact, setShowCreateContact] = useState(false);

  const [panelContactId, setPanelContactId] = useState("");
  const [panelLinkType, setPanelLinkType] = useState("ownership");
  const [panelPercentage, setPanelPercentage] = useState("");
  const [panelShares, setPanelShares] = useState("");
  const [panelIsUbo, setPanelIsUbo] = useState(false);
  const [panelIsSecretary, setPanelIsSecretary] = useState(false);
  const [panelIsPoa, setPanelIsPoa] = useState(false);
  const [panelContactType, setPanelContactType] = useState("individual");
  const [newFirst, setNewFirst] = useState("");
  const [newLast, setNewLast] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [newMobile, setNewMobile] = useState("");
  const [newNationality, setNewNationality] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => { loadData(); loadContacts(); }, [projectId]);

  async function loadData() {
    setLoading(true);
    try { setData(await api.get(`/api/projects/${projectId}/compliance`) as ComplianceData); } catch {}
    setLoading(false);
  }
  async function loadContacts() {
    try { const res = await api.get("/api/contacts/") as any[]; setContacts(res.map((c: any) => ({ id: c.id, name: c.name, contact_type: c.contact_type }))); } catch {}
  }
  function resetPanel() {
    setPanelContactId(""); setPanelLinkType("ownership"); setPanelPercentage(""); setPanelShares("");
    setPanelIsUbo(false); setPanelIsSecretary(false); setPanelIsPoa(false); setPanelContactType("individual");
    setShowCreateContact(false); setNewFirst(""); setNewLast(""); setNewEmail(""); setNewMobile(""); setNewNationality("");
  }
  async function handleCreateContact() {
    if (!newFirst.trim()) { toast.error("First name required"); return; }
    try {
      const res = await api.post("/api/contacts/", { name: `${newFirst.trim()} ${newLast.trim()}`.trim(), email: newEmail || undefined, phone_mobile: newMobile || undefined, nationality: newNationality || undefined, contact_type: panelContactType }) as any;
      await loadContacts(); setPanelContactId(res.id); setShowCreateContact(false); toast.success("Contact created");
    } catch (err: any) { toast.error(err.message || "Failed to create contact"); }
  }
  async function handleSaveRelatedParty() {
    if (!panelContactId || !data?.client_contact_id) { toast.error("Select a contact first"); return; }
    setSaving(true);
    try {
      await api.post("/api/compliance/ownership-links", { parent_id: data.client_contact_id, child_id: panelContactId, link_type: panelLinkType, percentage: panelPercentage ? Number(panelPercentage) : undefined, number_of_shares: panelShares ? Number(panelShares) : undefined, is_ubo: panelIsUbo, is_secretary: panelIsSecretary, is_poa_authorized: panelIsPoa });
      toast.success("Related party added"); setShowPanel(false); resetPanel(); loadData();
    } catch (err: any) { toast.error(err.message || "Failed to add related party"); }
    setSaving(false);
  }

  function roleBadges(p: RelatedParty) {
    const roles: string[] = [];
    if (p.link_type === "ownership") roles.push("Shareholder");
    if (p.link_type === "director") roles.push("Director");
    if (p.link_type === "manages") roles.push("Manager");
    if (p.is_ubo) roles.push("UBO");
    if (p.is_secretary) roles.push("Secretary");
    if (p.is_poa_authorized) roles.push("POA");
    return roles;
  }

  if (loading) return <div style={{ display: "flex", justifyContent: "center", alignItems: "center", minHeight: 200 }}><div className="loading-spinner" style={{ width: 28, height: 28 }} /></div>;
  if (!data) return <div style={{ padding: 40, textAlign: "center", color: "var(--text-tertiary)" }}>Unable to load compliance data</div>;

  const selectedContact = contacts.find((c) => c.id === panelContactId);

  return (
    <div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr", gap: 20 }}>
        {/* KYC Documents */}
        <SectionCard style={{ marginBottom: 0 }}>
        <SectionLabel icon="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z">KYC Documents</SectionLabel>
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {/* Screening Form */}
          <div style={{
            display: "flex", alignItems: "center", gap: 14, padding: "16px 18px",
            background: data.screening_form ? "var(--success-light)" : "var(--bg-tertiary)",
            borderRadius: "var(--radius-md)",
            border: `1px solid ${data.screening_form ? "var(--success-border)" : "var(--border-primary)"}`,
          }}>
            <div style={{
              width: 40, height: 40, borderRadius: "var(--radius-md)", flexShrink: 0,
              display: "flex", alignItems: "center", justifyContent: "center",
              background: data.screening_form ? "var(--success)" : "var(--border-primary)",
            }}>
              <Icon path={data.screening_form ? "M9 12l2 2 4-4" : "M12 6v6m0 0v6m0-6h6m-6 0H6"} size={18} color="#fff" />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)", marginBottom: 2 }}>Screening Form</div>
              {data.screening_form ? (
                <div style={{ fontSize: 11, color: "var(--text-tertiary)" }}>
                  {data.screening_form.file_name}
                  {data.screening_form.submitted_at && <> &middot; {fmtDate(data.screening_form.submitted_at)}</>}
                </div>
              ) : (
                <div style={{ fontSize: 11, color: "var(--text-quaternary)" }}>Not submitted</div>
              )}
            </div>
            {data.screening_form && (
              <span style={{ fontSize: 10, fontWeight: 700, padding: "3px 8px", borderRadius: "var(--radius-full)", background: "var(--success)", color: "#fff" }}>SUBMITTED</span>
            )}
          </div>

          {/* Onboarding Form */}
          <div style={{
            display: "flex", alignItems: "center", gap: 14, padding: "16px 18px",
            background: data.onboarding_form ? "var(--info-light)" : "var(--bg-tertiary)",
            borderRadius: "var(--radius-md)",
            border: `1px solid ${data.onboarding_form ? "var(--info-border)" : "var(--border-primary)"}`,
          }}>
            <div style={{
              width: 40, height: 40, borderRadius: "var(--radius-md)", flexShrink: 0,
              display: "flex", alignItems: "center", justifyContent: "center",
              background: data.onboarding_form ? "var(--info)" : "var(--border-primary)",
            }}>
              <Icon path={data.onboarding_form ? "M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" : "M12 6v6m0 0v6m0-6h6m-6 0H6"} size={18} color="#fff" />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)", marginBottom: 2 }}>Onboarding Form</div>
              {data.onboarding_form ? (
                <div style={{ fontSize: 11, color: "var(--text-tertiary)" }}>
                  {data.onboarding_form.file_name}
                  {data.onboarding_form.submitted_at && <> &middot; {fmtDate(data.onboarding_form.submitted_at)}</>}
                </div>
              ) : (
                <div style={{ fontSize: 11, color: "var(--text-quaternary)" }}>Not available</div>
              )}
            </div>
            {data.onboarding_form && (
              <span style={{ fontSize: 10, fontWeight: 700, padding: "3px 8px", borderRadius: "var(--radius-full)", background: "var(--info)", color: "#fff" }}>AVAILABLE</span>
            )}
          </div>
        </div>
      </SectionCard>

      {/* Related Parties */}
      <SectionCard style={{ marginBottom: 0 }}>
        <SectionLabel
          icon="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z"
          trailing={
            <button onClick={() => { resetPanel(); setShowPanel(true); }} style={{
              background: "var(--brand-primary)", color: "#fff", border: "none",
              borderRadius: "var(--radius-sm)", padding: "6px 14px", fontSize: 12, fontWeight: 600,
              cursor: "pointer", transition: "all var(--transition-fast)",
              display: "flex", alignItems: "center", gap: 6,
            }}>
              <Icon path="M12 4v16m8-8H4" size={14} color="#fff" />
              Add Party
            </button>
          }
        >Related Parties <span style={{ fontWeight: 500, color: "var(--text-quaternary)", marginLeft: 4 }}>({data.related_parties.length})</span></SectionLabel>

        {data.related_parties.length === 0 ? (
          <div style={{
            textAlign: "center", padding: "40px 0", color: "var(--text-quaternary)", fontSize: 13,
            borderRadius: "var(--radius-md)", border: "2px dashed var(--border-primary)", background: "var(--bg-tertiary)",
          }}>
            <Icon path="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" size={32} color="var(--border-primary)" />
            <div style={{ marginTop: 12 }}>No related parties linked to this project</div>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {data.related_parties.map((p) => {
              const roles = roleBadges(p);
              return (
                <div key={p.link_id} style={{
                  display: "flex", alignItems: "center", gap: 14, padding: "14px 16px",
                  background: "var(--bg-tertiary)", borderRadius: "var(--radius-md)",
                  border: "1px solid var(--border-secondary)", transition: "all var(--transition-fast)",
                }}>
                  {/* Avatar */}
                  <a href={`/dashboard/contacts/${p.contact_id}`} style={{ textDecoration: "none", flexShrink: 0 }}>
                    <div style={{
                      width: 38, height: 38, borderRadius: "50%",
                      background: p.contact_type === "company"
                        ? "linear-gradient(135deg, var(--accent-purple-light), var(--accent-pink-light))"
                        : "linear-gradient(135deg, var(--accent-blue-light), var(--accent-purple-light))",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      fontSize: 14, fontWeight: 700,
                      color: p.contact_type === "company" ? "var(--accent-purple)" : "var(--accent-blue)",
                    }}>
                      {(p.contact_name || "?").charAt(0).toUpperCase()}
                    </div>
                  </a>

                  {/* Info */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <a href={`/dashboard/contacts/${p.contact_id}`} style={{ textDecoration: "none", fontSize: 13, fontWeight: 600, color: "var(--text-primary)" }}>
                      {p.contact_name || "—"}
                    </a>
                    <div style={{ display: "flex", gap: 16, marginTop: 3 }}>
                      {p.contact_type && <span style={{ fontSize: 11, color: "var(--text-quaternary)", textTransform: "capitalize" }}>{p.contact_type}</span>}
                      {p.passport_no && <span style={{ fontSize: 11, color: "var(--text-quaternary)" }}>Passport: {p.passport_no}</span>}
                      {p.nationality && <span style={{ fontSize: 11, color: "var(--text-quaternary)" }}>{p.nationality}</span>}
                    </div>
                  </div>

                  {/* Shareholding */}
                  {p.percentage != null && (
                    <div style={{ textAlign: "right", marginRight: 4 }}>
                      <div style={{ fontSize: 16, fontWeight: 700, color: "var(--text-primary)", lineHeight: 1 }}>{p.percentage}%</div>
                      <div style={{ fontSize: 10, color: "var(--text-quaternary)", marginTop: 2 }}>shares</div>
                    </div>
                  )}

                  {/* Role badges */}
                  <div style={{ display: "flex", gap: 4, flexWrap: "wrap", maxWidth: 180, justifyContent: "flex-end" }}>
                    {roles.map((r) => {
                      const bc = ROLE_BADGE_COLORS[r] || { color: "var(--text-tertiary)", bg: "var(--bg-tertiary)" };
                      return (
                        <span key={r} style={{
                          fontSize: 10, fontWeight: 600, padding: "2px 8px",
                          borderRadius: "var(--radius-full)", color: bc.color, background: bc.bg,
                          whiteSpace: "nowrap",
                        }}>{r}</span>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </SectionCard>

      </div>

      {/* Slide-over Panel */}
      {showPanel && (
        <>
          <div
            onClick={() => setShowPanel(false)}
            style={{
              position: "fixed", top: 0, left: 0, right: 0, bottom: 0,
              background: "rgba(0,0,0,0.4)", backdropFilter: "blur(4px)",
              zIndex: "var(--z-modal-backdrop)" as any, transition: "opacity var(--transition-base)",
            }}
          />
          <div style={{
            position: "fixed", top: 0, right: 0, bottom: 0, width: 540,
            background: "var(--bg-secondary)", boxShadow: "var(--shadow-xl)",
            zIndex: "var(--z-modal)" as any, overflowY: "auto",
            display: "flex", flexDirection: "column",
          }}>
            {/* Panel header */}
            <div style={{
              display: "flex", justifyContent: "space-between", alignItems: "center",
              padding: "20px 28px", borderBottom: "1px solid var(--border-primary)",
              position: "sticky", top: 0, background: "var(--bg-secondary)", zIndex: 1,
            }}>
              <div>
                <h3 style={{ fontSize: 16, fontWeight: 700, color: "var(--text-primary)" }}>Add Related Party</h3>
                <p style={{ fontSize: 12, color: "var(--text-quaternary)", marginTop: 2 }}>Link an existing or new contact as a related party</p>
              </div>
              <button onClick={() => setShowPanel(false)} style={{
                background: "var(--bg-tertiary)", border: "none", borderRadius: "var(--radius-sm)",
                padding: 6, cursor: "pointer", color: "var(--text-tertiary)",
                transition: "all var(--transition-fast)",
              }} onMouseEnter={(e) => { e.currentTarget.style.background = "var(--danger-light)"; e.currentTarget.style.color = "var(--danger)"; }}
                 onMouseLeave={(e) => { e.currentTarget.style.background = "var(--bg-tertiary)"; e.currentTarget.style.color = "var(--text-tertiary)"; }}>
                <Icon path="M18 6L6 18M6 6l12 12" size={16} />
              </button>
            </div>

            <div style={{ flex: 1, padding: "24px 28px" }}>
              {/* Contact Selection */}
              <div style={{ marginBottom: 24 }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
                  <label style={{ fontSize: 12, fontWeight: 600, color: "var(--text-tertiary)", marginBottom: 0 }}>Contact</label>
                  {!showCreateContact && (
                    <button onClick={() => setShowCreateContact(true)} style={{
                      background: "none", border: "none", cursor: "pointer", fontSize: 12, fontWeight: 600,
                      color: "var(--accent-blue)", display: "flex", alignItems: "center", gap: 4,
                    }}>
                      <Icon path="M12 4v16m8-8H4" size={12} color="var(--accent-blue)" /> New Contact
                    </button>
                  )}
                </div>
                {!showCreateContact ? (
                  <>
                    <select value={panelContactId} onChange={(e) => setPanelContactId(e.target.value)} style={{ margin: 0 }}>
                      <option value="">Select an existing contact...</option>
                      {contacts.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                    {selectedContact && (
                      <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 10, padding: "8px 12px", background: "var(--accent-blue-light)", borderRadius: "var(--radius-sm)" }}>
                        <div style={{ width: 24, height: 24, borderRadius: "50%", background: "var(--accent-blue)", color: "#fff", fontSize: 11, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center" }}>
                          {selectedContact.name.charAt(0).toUpperCase()}
                        </div>
                        <span style={{ fontSize: 12, fontWeight: 600, color: "var(--accent-blue)" }}>{selectedContact.name}</span>
                      </div>
                    )}
                  </>
                ) : (
                  <div style={{ background: "var(--bg-tertiary)", padding: 18, borderRadius: "var(--radius-md)", border: "1px solid var(--border-primary)" }}>
                    <div style={{ display: "flex", gap: 16, marginBottom: 14 }}>
                      {["individual", "company"].map((t) => (
                        <label key={t} onClick={() => setPanelContactType(t)} style={{
                          display: "flex", alignItems: "center", gap: 6, cursor: "pointer",
                          padding: "6px 14px", borderRadius: "var(--radius-full)", fontSize: 12, fontWeight: 600,
                          background: panelContactType === t ? "var(--brand-primary)" : "transparent",
                          color: panelContactType === t ? "#fff" : "var(--text-tertiary)",
                          border: panelContactType === t ? "none" : "1px solid var(--border-primary)",
                          transition: "all var(--transition-fast)", marginBottom: 0,
                        }}>
                          {t === "individual" ? "Individual" : "Company"}
                        </label>
                      ))}
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
                      <FieldGroup label="First Name *"><input value={newFirst} onChange={(e) => setNewFirst(e.target.value)} style={{ margin: 0 }} /></FieldGroup>
                      <FieldGroup label="Last Name"><input value={newLast} onChange={(e) => setNewLast(e.target.value)} style={{ margin: 0 }} /></FieldGroup>
                      <FieldGroup label="Email"><input type="email" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} style={{ margin: 0 }} /></FieldGroup>
                      <FieldGroup label="Mobile"><input value={newMobile} onChange={(e) => setNewMobile(e.target.value)} style={{ margin: 0 }} /></FieldGroup>
                    </div>
                    <FieldGroup label="Nationality"><input value={newNationality} onChange={(e) => setNewNationality(e.target.value)} style={{ margin: 0, marginBottom: 14 }} /></FieldGroup>
                    <div style={{ display: "flex", gap: 8 }}>
                      <button onClick={handleCreateContact} style={{
                        background: "var(--brand-primary)", color: "#fff", border: "none", borderRadius: "var(--radius-sm)",
                        padding: "7px 16px", fontSize: 12, fontWeight: 600, cursor: "pointer",
                      }}>Create & Select</button>
                      <button onClick={() => setShowCreateContact(false)} style={{
                        background: "var(--bg-secondary)", color: "var(--text-secondary)", border: "1px solid var(--border-primary)",
                        borderRadius: "var(--radius-sm)", padding: "7px 16px", fontSize: 12, fontWeight: 500, cursor: "pointer",
                      }}>Cancel</button>
                    </div>
                  </div>
                )}
              </div>

              {/* Divider */}
              <div style={{ height: 1, background: "var(--border-secondary)", margin: "4px 0 24px" }} />

              {/* Relationship Type */}
              <FieldGroup label="Relationship Type">
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 4, marginBottom: 24 }}>
                  {LINK_TYPES.map((lt) => (
                    <button key={lt.value} onClick={() => setPanelLinkType(lt.value)} style={{
                      padding: "6px 14px", borderRadius: "var(--radius-full)", fontSize: 12, fontWeight: 600,
                      background: panelLinkType === lt.value ? "var(--brand-primary)" : "var(--bg-tertiary)",
                      color: panelLinkType === lt.value ? "#fff" : "var(--text-secondary)",
                      border: panelLinkType === lt.value ? "none" : "1px solid var(--border-primary)",
                      cursor: "pointer", transition: "all var(--transition-fast)",
                    }}>{lt.label}</button>
                  ))}
                </div>
              </FieldGroup>

              {/* Ownership */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 24 }}>
                <FieldGroup label="Number of Shares"><input type="number" value={panelShares} onChange={(e) => setPanelShares(e.target.value)} style={{ margin: 0 }} /></FieldGroup>
                <FieldGroup label="Shareholding %"><input type="number" step="0.01" value={panelPercentage} onChange={(e) => setPanelPercentage(e.target.value)} style={{ margin: 0 }} /></FieldGroup>
              </div>

              {/* Role Flags */}
              <div style={{ marginBottom: 8 }}>
                <label style={{ fontSize: 12, fontWeight: 600, color: "var(--text-tertiary)", display: "block", marginBottom: 10 }}>Roles & Flags</label>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  {[
                    { key: "ubo", label: "UBO", checked: panelIsUbo, set: setPanelIsUbo, color: "#dc2626", bg: "#fef2f2" },
                    { key: "secretary", label: "Secretary", checked: panelIsSecretary, set: setPanelIsSecretary, color: "#b45309", bg: "#fffbeb" },
                    { key: "poa", label: "POA Authorized", checked: panelIsPoa, set: setPanelIsPoa, color: "#ec4899", bg: "#fce7f3" },
                  ].map((r) => (
                    <button key={r.key} onClick={() => r.set(!r.checked)} style={{
                      padding: "6px 14px", borderRadius: "var(--radius-full)", fontSize: 12, fontWeight: 600,
                      background: r.checked ? r.bg : "var(--bg-tertiary)",
                      color: r.checked ? r.color : "var(--text-quaternary)",
                      border: r.checked ? `1px solid ${r.color}33` : "1px solid var(--border-primary)",
                      cursor: "pointer", transition: "all var(--transition-fast)",
                    }}>
                      {r.checked && <span style={{ marginRight: 4 }}>&#10003;</span>}
                      {r.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Panel footer */}
            <div style={{
              padding: "16px 28px", borderTop: "1px solid var(--border-primary)",
              display: "flex", gap: 12, background: "var(--bg-secondary)",
              position: "sticky", bottom: 0,
            }}>
              <button onClick={handleSaveRelatedParty} disabled={saving || !panelContactId} style={{
                flex: 1, background: panelContactId ? "var(--brand-primary)" : "var(--bg-tertiary)",
                color: panelContactId ? "#fff" : "var(--text-quaternary)", border: "none",
                borderRadius: "var(--radius-md)", padding: "10px 0", fontSize: 14, fontWeight: 600,
                cursor: panelContactId ? "pointer" : "default", transition: "all var(--transition-fast)",
              }}>{saving ? "Saving..." : "Add Related Party"}</button>
              <button onClick={() => setShowPanel(false)} style={{
                background: "var(--bg-tertiary)", color: "var(--text-secondary)", border: "none",
                borderRadius: "var(--radius-md)", padding: "10px 24px", fontSize: 14, fontWeight: 500, cursor: "pointer",
              }}>Cancel</button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
