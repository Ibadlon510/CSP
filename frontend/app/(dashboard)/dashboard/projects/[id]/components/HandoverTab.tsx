"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { useToast } from "@/components/Toast";
import { Icon } from "@/components/ui/Icon";
import { fmtNumber } from "@/lib/format";

const VISA_STATUS_MAP: Record<string, { label: string; color: string; bg: string }> = {
  not_started: { label: "Not Started", color: "var(--text-tertiary)", bg: "var(--bg-tertiary)" },
  entry_permit_applied: { label: "Entry Permit Applied", color: "#b45309", bg: "#fffbeb" },
  entry_permit_issued: { label: "Entry Permit Issued", color: "#b45309", bg: "#fef3c7" },
  medical_done: { label: "Medical Done", color: "#1d4ed8", bg: "#eff6ff" },
  emirates_id_applied: { label: "Emirates ID Applied", color: "#7c3aed", bg: "#f5f3ff" },
  visa_stamped: { label: "Visa Stamped", color: "#059669", bg: "#ecfdf5" },
  completed: { label: "Completed", color: "#15803d", bg: "#f0fdf4" },
};

const VISA_STATUSES = Object.entries(VISA_STATUS_MAP);

type Handover = {
  id?: string;
  project_id: string;
  contact_id?: string;
  contact_type?: string;
  name?: string;
  email?: string;
  phone_mobile?: string;
  phone_primary?: string;
  trade_license_no?: string;
  jurisdiction?: string;
  legal_form?: string;
  license_issue_date?: string;
  license_expiry_date?: string;
  activity_license_activities?: string;
  vat_registered?: boolean;
  vat_period_type?: string;
  vat_period_end_day?: number;
  vat_first_period_end_date?: string;
  vat_return_due_days?: number;
  vat_notes?: string;
  ct_registered?: boolean;
  ct_registration_no?: string;
  ct_period_type?: string;
  ct_financial_year_start_month?: number;
  ct_financial_year_start_day?: number;
  ct_filing_due_months?: number;
  ct_notes?: string;
  is_visa_application?: boolean;
  channel_partner_plan?: string;
  initial_company_formation?: boolean;
  price_per_share?: number;
  total_number_of_shares?: number;
  shareholding_total?: number;
  total_share_value?: number;
  license_authority?: string;
  legal_entity_type_detailed?: string;
  applied_years?: string;
  top_5_countries?: string;
  visa_eligibility?: number;
  preferred_mobile_country?: string;
  // Individual-specific
  gender?: string;
  nationality?: string;
  date_of_birth?: string;
  place_of_birth?: string;
  passport_no?: string;
  passport_expiry?: string;
  visa_type?: string;
  emirates_id?: string;
  emirates_id_expiry?: string;
  designation_title?: string;
  proposed_names?: { id: string; name: string; priority: number }[];
  license_activities?: { id: string; activity_name: string; activity_code?: string }[];
  visa_applications?: any[];
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

const FieldGroup = ({ label, children, hint }: { label: string; children: React.ReactNode; hint?: string }) => (
  <div>
    <label style={{ fontSize: 12, fontWeight: 500, color: "var(--text-tertiary)", marginBottom: 6, display: "block" }}>{label}</label>
    {children}
    {hint && <span style={{ fontSize: 11, color: "var(--text-quaternary)", marginTop: 3, display: "block" }}>{hint}</span>}
  </div>
);

const Toggle = ({ id, checked, onChange, label }: { id: string; checked: boolean; onChange: (v: boolean) => void; label: string }) => (
  <label htmlFor={id} style={{ display: "inline-flex", alignItems: "center", gap: 10, cursor: "pointer", marginBottom: 0, userSelect: "none" }}>
    <div
      onClick={() => onChange(!checked)}
      style={{
        width: 36, height: 20, borderRadius: 10, position: "relative", transition: "background var(--transition-fast)",
        background: checked ? "var(--accent-blue)" : "var(--border-primary)", cursor: "pointer",
      }}
    >
      <div style={{
        width: 16, height: 16, borderRadius: "50%", background: "#fff", position: "absolute", top: 2,
        left: checked ? 18 : 2, transition: "left var(--transition-fast)", boxShadow: "var(--shadow-sm)",
      }} />
    </div>
    <span style={{ fontSize: 13, fontWeight: 500, color: "var(--text-secondary)" }}>{label}</span>
  </label>
);

export default function HandoverTab({ projectId }: { projectId: string }) {
  const toast = useToast();
  const [data, setData] = useState<Handover | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<Record<string, any>>({});
  const [newActivity, setNewActivity] = useState({ activity_name: "", activity_code: "" });
  const [showAddLicenseActivity, setShowAddLicenseActivity] = useState(false);
  const [newName, setNewName] = useState({ name: "", priority: 1 });
  const [showAddName, setShowAddName] = useState(false);
  const [contacts, setContacts] = useState<{ id: string; name: string }[]>([]);
  const [relatedPartyIds, setRelatedPartyIds] = useState<Set<string>>(new Set());
  const [showAddVisa, setShowAddVisa] = useState(false);
  const [newVisa, setNewVisa] = useState({ contact_id: "", visa_type: "", designation: "", salary: "" });

  useEffect(() => { loadHandover(); loadContacts(); loadRelatedParties(); }, [projectId]);

  async function loadContacts() {
    try { const res = await api.get("/api/contacts/") as any[]; setContacts(res.map((c: any) => ({ id: c.id, name: c.name }))); } catch {}
  }
  async function loadRelatedParties() {
    try {
      const res = await api.get(`/api/projects/${projectId}/compliance`) as any;
      const ids = new Set<string>((res.related_parties || []).map((p: any) => p.contact_id));
      setRelatedPartyIds(ids);
    } catch {}
  }

  async function loadHandover() {
    setLoading(true);
    try { const res = await api.get(`/api/projects/${projectId}/handover`) as Handover; setData(res); setForm(res); } catch {}
    setLoading(false);
  }

  async function saveHandover() {
    setSaving(true);
    try {
      const { proposed_names, license_activities, visa_applications, id, project_id, contact_id, ...payload } = form;
      await api.put(`/api/projects/${projectId}/handover`, payload);
      toast.success("Handover saved");
      loadHandover();
    } catch (err: any) { toast.error(err.message || "Failed to save"); }
    setSaving(false);
  }

  async function addActivity() {
    if (!newActivity.activity_name) return;
    try { await api.post(`/api/projects/${projectId}/license-activities`, newActivity); setNewActivity({ activity_name: "", activity_code: "" }); setShowAddLicenseActivity(false); loadHandover(); }
    catch (err: any) { toast.error(err.message || "Failed"); }
  }
  async function deleteActivity(id: string) {
    try { await api.delete(`/api/projects/${projectId}/license-activities/${id}`); loadHandover(); } catch (err: any) { toast.error(err.message || "Failed"); }
  }
  async function addProposedName() {
    if (!newName.name.trim()) return;
    try { await api.post(`/api/projects/${projectId}/proposed-names`, { name: newName.name.trim(), priority: (data?.proposed_names?.length || 0) + 1 }); setNewName({ name: "", priority: 1 }); setShowAddName(false); loadHandover(); }
    catch (err: any) { toast.error(err.message || "Max 3 names"); }
  }
  async function deleteProposedName(id: string) {
    try { await api.delete(`/api/projects/${projectId}/proposed-names/${id}`); loadHandover(); } catch (err: any) { toast.error(err.message || "Failed"); }
  }
  async function addVisaApplication() {
    if (!newVisa.contact_id) { toast.error("Select a contact"); return; }
    try {
      await api.post(`/api/projects/${projectId}/visa-applications`, { contact_id: newVisa.contact_id, visa_type: newVisa.visa_type || undefined, designation: newVisa.designation || undefined, salary: newVisa.salary ? Number(newVisa.salary) : undefined });
      setNewVisa({ contact_id: "", visa_type: "", designation: "", salary: "" }); setShowAddVisa(false); loadHandover(); toast.success("Visa applicant added");
    } catch (err: any) { toast.error(err.message || "Failed — check visa allocation cap"); }
  }
  async function deleteVisaApplication(id: string) {
    if (!confirm("Remove this visa applicant?")) return;
    try { await api.delete(`/api/projects/${projectId}/visa-applications/${id}`); loadHandover(); } catch (err: any) { toast.error(err.message || "Failed"); }
  }
  async function updateVisaStatus(id: string, status: string) {
    try { await api.patch(`/api/projects/${projectId}/visa-applications/${id}`, { status }); loadHandover(); } catch (err: any) { toast.error(err.message || "Failed"); }
  }
  function updateField(field: string, value: any) { setForm((prev) => ({ ...prev, [field]: value })); }

  if (loading) return <div style={{ display: "flex", justifyContent: "center", alignItems: "center", minHeight: 200 }}><div className="loading-spinner" style={{ width: 28, height: 28 }} /></div>;

  const visaUsed = (data?.visa_applications || []).length;
  const visaCap = data?.visa_eligibility ?? 0;

  return (
    <div>

      {/* ═══ Row 1: Client Info + Company Details ═══ */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, marginBottom: 20 }}>

      {/* ═══════ Client Information ═══════ */}
      <SectionCard style={{ marginBottom: 0 }}>
        <SectionLabel icon="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2 M12 3a4 4 0 100 8 4 4 0 000-8z">Client Information</SectionLabel>
        {/* Contact Type Selector */}
        <div style={{ display: "flex", gap: 8, marginBottom: 18 }}>
          {["company", "individual"].map((ct) => (
            <button key={ct} onClick={() => updateField("contact_type", ct)} style={{
              padding: "6px 16px", borderRadius: "var(--radius-full)", fontSize: 12, fontWeight: 600,
              background: form.contact_type === ct ? "var(--brand-primary)" : "var(--bg-tertiary)",
              color: form.contact_type === ct ? "#fff" : "var(--text-secondary)",
              border: form.contact_type === ct ? "none" : "1px solid var(--border-primary)",
              cursor: "pointer", transition: "all var(--transition-fast)", textTransform: "capitalize",
            }}>{ct}</button>
          ))}
          {form.contact_type && (
            <span style={{ fontSize: 11, color: "var(--text-quaternary)", display: "flex", alignItems: "center", marginLeft: 4 }}>
              <Icon path="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" size={13} color="var(--text-quaternary)" />
              <span style={{ marginLeft: 4 }}>Type syncs to contact record</span>
            </span>
          )}
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
          <FieldGroup label={form.contact_type === "individual" ? "Full Name" : "Company / Contact Name"}>
            <div style={{ position: "relative" }}>
              <input value={form.name || ""} onChange={(e) => updateField("name", e.target.value)} placeholder={form.contact_type === "individual" ? "Enter full name" : "Enter company name"} style={{ margin: 0, paddingRight: data?.contact_id ? 32 : undefined }} />
              {data?.contact_id && (
                <a
                  href={`/dashboard/contacts/${data.contact_id}`}
                  title="Open contact profile"
                  style={{
                    position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)",
                    color: "var(--accent-blue)", display: "flex", alignItems: "center",
                    padding: 4, borderRadius: 4, transition: "all var(--transition-fast)",
                  }}
                >
                  <Icon path="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6M15 3h6v6M10 14L21 3" size={14} />
                </a>
              )}
            </div>
          </FieldGroup>
          <FieldGroup label="Email Address">
            <input type="email" value={form.email || ""} onChange={(e) => updateField("email", e.target.value)} placeholder="email@example.com" style={{ margin: 0 }} />
          </FieldGroup>
          <FieldGroup label="Mobile Number">
            <input value={form.phone_mobile || ""} onChange={(e) => updateField("phone_mobile", e.target.value)} placeholder="+971 XX XXX XXXX" style={{ margin: 0 }} />
          </FieldGroup>
          <FieldGroup label="Channel Partner">
            <input value={form.channel_partner_plan || ""} onChange={(e) => updateField("channel_partner_plan", e.target.value)} placeholder="Partner name" style={{ margin: 0 }} />
          </FieldGroup>
          <FieldGroup label="Visa Eligibility" hint="Max visa slots">
            <input type="number" value={form.visa_eligibility ?? ""} onChange={(e) => updateField("visa_eligibility", parseInt(e.target.value) || undefined)} style={{ margin: 0 }} />
          </FieldGroup>
        </div>
        <div style={{ marginTop: 14, paddingBottom: 2 }}>
          <Toggle id="visa_toggle" checked={!!form.is_visa_application} onChange={(v) => updateField("is_visa_application", v)} label="Visa Application" />
        </div>
      </SectionCard>

      {/* ═══════ Company / Individual Details ═══════ */}
      <SectionCard style={{ marginBottom: 0 }}>
        <SectionLabel icon={form.contact_type === "individual" ? "M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2 M12 3a4 4 0 100 8 4 4 0 000-8z" : "M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"}>{form.contact_type === "individual" ? "Individual Details" : "Company Details"}</SectionLabel>

        {form.contact_type === "individual" ? (
          /* ── Individual Details ── */
          <>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <FieldGroup label="Gender">
                <select value={form.gender || ""} onChange={(e) => updateField("gender", e.target.value)} style={{ margin: 0 }}>
                  <option value="">Select...</option>
                  <option value="male">Male</option>
                  <option value="female">Female</option>
                </select>
              </FieldGroup>
              <FieldGroup label="Nationality"><input value={form.nationality || ""} onChange={(e) => updateField("nationality", e.target.value)} placeholder="e.g. Indian" style={{ margin: 0 }} /></FieldGroup>
              <FieldGroup label="Date of Birth"><input type="date" value={form.date_of_birth ? String(form.date_of_birth).slice(0, 10) : ""} onChange={(e) => updateField("date_of_birth", e.target.value)} style={{ margin: 0 }} /></FieldGroup>
              <FieldGroup label="Place of Birth"><input value={form.place_of_birth || ""} onChange={(e) => updateField("place_of_birth", e.target.value)} placeholder="City, Country" style={{ margin: 0 }} /></FieldGroup>
              <FieldGroup label="Passport No."><input value={form.passport_no || ""} onChange={(e) => updateField("passport_no", e.target.value)} style={{ margin: 0 }} /></FieldGroup>
              <FieldGroup label="Passport Expiry"><input type="date" value={form.passport_expiry ? String(form.passport_expiry).slice(0, 10) : ""} onChange={(e) => updateField("passport_expiry", e.target.value)} style={{ margin: 0 }} /></FieldGroup>
              <FieldGroup label="Visa Type"><input value={form.visa_type || ""} onChange={(e) => updateField("visa_type", e.target.value)} placeholder="e.g. Employment" style={{ margin: 0 }} /></FieldGroup>
              <FieldGroup label="Designation / Title"><input value={form.designation_title || ""} onChange={(e) => updateField("designation_title", e.target.value)} placeholder="e.g. Manager" style={{ margin: 0 }} /></FieldGroup>
              <FieldGroup label="Emirates ID"><input value={form.emirates_id || ""} onChange={(e) => updateField("emirates_id", e.target.value)} placeholder="784-XXXX-XXXXXXX-X" style={{ margin: 0 }} /></FieldGroup>
              <FieldGroup label="Emirates ID Expiry"><input type="date" value={form.emirates_id_expiry ? String(form.emirates_id_expiry).slice(0, 10) : ""} onChange={(e) => updateField("emirates_id_expiry", e.target.value)} style={{ margin: 0 }} /></FieldGroup>
            </div>
          </>
        ) : (
          /* ── Company Details ── */
          <>
            <div style={{
              display: "flex", alignItems: "center", gap: 10, marginBottom: 16,
              padding: "10px 14px", borderRadius: "var(--radius-md)",
              background: form.initial_company_formation ? "var(--accent-blue-light)" : "var(--bg-tertiary)",
              border: `1px solid ${form.initial_company_formation ? "var(--accent-blue)" : "var(--border-primary)"}`,
              transition: "all var(--transition-fast)", cursor: "pointer",
            }} onClick={() => updateField("initial_company_formation", !form.initial_company_formation)}>
              <div style={{
                width: 18, height: 18, borderRadius: 4, display: "flex", alignItems: "center", justifyContent: "center",
                background: form.initial_company_formation ? "var(--accent-blue)" : "transparent",
                border: form.initial_company_formation ? "none" : "2px solid var(--border-primary)", transition: "all var(--transition-fast)",
              }}>
                {form.initial_company_formation && <Icon path="M20 6L9 17l-5-5" size={12} color="#fff" />}
              </div>
              <span style={{ fontSize: 13, fontWeight: 600, color: form.initial_company_formation ? "var(--accent-blue)" : "var(--text-secondary)" }}>Initial Company Formation</span>
            </div>

            {form.initial_company_formation && (
              <div style={{
                background: "var(--bg-tertiary)", borderRadius: "var(--radius-md)", padding: 16, marginBottom: 16,
                border: "1px dashed var(--border-primary)",
              }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
                  <span style={{ fontSize: 12, fontWeight: 600, color: "var(--text-tertiary)" }}>Proposed Company Names</span>
                  <span style={{ fontSize: 11, color: "var(--text-quaternary)" }}>{(data?.proposed_names || []).length} / 3</span>
                </div>
                {(data?.proposed_names || []).map((n) => (
                  <div key={n.id} style={{
                    display: "flex", alignItems: "center", gap: 10, padding: "8px 12px", marginBottom: 6,
                    background: "var(--bg-secondary)", borderRadius: "var(--radius-sm)", border: "1px solid var(--border-secondary)",
                  }}>
                    <span style={{
                      width: 22, height: 22, borderRadius: "50%", background: "var(--accent-blue-light)", color: "var(--accent-blue)",
                      fontSize: 11, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
                    }}>{n.priority}</span>
                    <span style={{ fontSize: 13, fontWeight: 500, flex: 1, color: "var(--text-primary)" }}>{n.name}</span>
                    <button onClick={() => deleteProposedName(n.id)} style={{
                      background: "none", border: "none", cursor: "pointer", padding: 2, color: "var(--text-quaternary)",
                      borderRadius: 4, transition: "all var(--transition-fast)",
                    }} onMouseEnter={(e) => { e.currentTarget.style.color = "var(--danger)"; e.currentTarget.style.background = "var(--danger-light)"; }}
                       onMouseLeave={(e) => { e.currentTarget.style.color = "var(--text-quaternary)"; e.currentTarget.style.background = "none"; }}>
                      <Icon path="M18 6L6 18M6 6l12 12" size={14} />
                    </button>
                  </div>
                ))}
                {(data?.proposed_names?.length || 0) < 3 && (
                  <button onClick={() => setShowAddName(true)} style={{
                    background: "var(--accent-blue)", color: "#fff", border: "none", borderRadius: "var(--radius-sm)",
                    padding: "6px 14px", fontSize: 12, fontWeight: 600, cursor: "pointer", marginTop: 8,
                    display: "flex", alignItems: "center", gap: 6,
                  }}><Icon path="M12 4v16m8-8H4" size={13} color="#fff" /> Add Name</button>
                )}
              </div>
            )}

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <FieldGroup label="License Authority"><input value={form.license_authority || ""} onChange={(e) => updateField("license_authority", e.target.value)} style={{ margin: 0 }} /></FieldGroup>
              <FieldGroup label="Legal Entity Type"><input value={form.legal_entity_type_detailed || ""} onChange={(e) => updateField("legal_entity_type_detailed", e.target.value)} style={{ margin: 0 }} /></FieldGroup>
              <FieldGroup label="Applied Years"><input value={form.applied_years || ""} onChange={(e) => updateField("applied_years", e.target.value)} style={{ margin: 0 }} /></FieldGroup>
              <FieldGroup label="Top 5 Countries"><input value={form.top_5_countries || ""} onChange={(e) => updateField("top_5_countries", e.target.value)} placeholder="e.g. UAE, UK, India, USA, China" style={{ margin: 0 }} /></FieldGroup>
              <FieldGroup label="Price per Share"><input type="number" value={form.price_per_share ?? ""} onChange={(e) => updateField("price_per_share", e.target.value)} style={{ margin: 0 }} /></FieldGroup>
              <FieldGroup label="Total Shares"><input type="number" value={form.total_number_of_shares ?? ""} onChange={(e) => updateField("total_number_of_shares", e.target.value)} style={{ margin: 0 }} /></FieldGroup>
              <FieldGroup label="Shareholding Total"><input type="number" value={form.shareholding_total ?? ""} onChange={(e) => updateField("shareholding_total", e.target.value)} style={{ margin: 0 }} /></FieldGroup>
              <FieldGroup label="Total Share Value"><input type="number" value={form.total_share_value ?? ""} onChange={(e) => updateField("total_share_value", e.target.value)} style={{ margin: 0 }} /></FieldGroup>
            </div>
          </>
        )}
      </SectionCard>

      </div>{/* end Row 1 */}

      {/* ═══ Row 2: CT&VAT + License Activities ═══ */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, marginBottom: 20 }}>

      {/* ═══════ Corporate Tax & VAT ═══════ */}
      <SectionCard style={{ marginBottom: 0 }}>
        <SectionLabel icon="M9 14l6-6m-5.5.5h.01m4.99 5h.01M19 21l-7-5-7 5V5a2 2 0 012-2h10a2 2 0 012 2z">Corporate Tax & VAT</SectionLabel>

        {/* Corporate Tax row */}
        <div style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text-tertiary)", marginBottom: 10, display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ width: 6, height: 6, borderRadius: "50%", background: form.ct_registered ? "var(--success)" : "var(--border-primary)" }} />
            Corporate Tax
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "auto 1fr 1fr", gap: 16, alignItems: "end" }}>
            <div style={{ paddingBottom: 6 }}>
              <Toggle id="ct_reg" checked={!!form.ct_registered} onChange={(v) => updateField("ct_registered", v)} label="CT Registered" />
            </div>
            <FieldGroup label="Registration No."><input value={form.ct_registration_no || ""} onChange={(e) => updateField("ct_registration_no", e.target.value)} style={{ margin: 0 }} disabled={!form.ct_registered} /></FieldGroup>
            <FieldGroup label="CT Period">
              <select value={form.ct_period_type || ""} onChange={(e) => updateField("ct_period_type", e.target.value)} style={{ margin: 0 }} disabled={!form.ct_registered}>
                <option value="">Select...</option>
                <option value="calendar_year">Calendar Year</option>
                <option value="fiscal_year">Fiscal Year</option>
              </select>
            </FieldGroup>
          </div>
          {form.ct_registered && (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, marginTop: 12 }}>
              <FieldGroup label="FY Start Month">
                <select value={form.ct_financial_year_start_month ?? ""} onChange={(e) => updateField("ct_financial_year_start_month", e.target.value ? parseInt(e.target.value) : undefined)} style={{ margin: 0 }}>
                  <option value="">Select...</option>
                  {["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"].map((m, i) => (
                    <option key={i + 1} value={i + 1}>{m}</option>
                  ))}
                </select>
              </FieldGroup>
              <FieldGroup label="FY Start Day">
                <input type="number" min={1} max={31} value={form.ct_financial_year_start_day ?? ""} onChange={(e) => updateField("ct_financial_year_start_day", e.target.value ? parseInt(e.target.value) : undefined)} style={{ margin: 0 }} />
              </FieldGroup>
              <FieldGroup label="Filing Due (months)">
                <input type="number" min={0} value={form.ct_filing_due_months ?? ""} onChange={(e) => updateField("ct_filing_due_months", e.target.value ? parseInt(e.target.value) : undefined)} placeholder="e.g. 9" style={{ margin: 0 }} />
              </FieldGroup>
            </div>
          )}
          {form.ct_registered && (
            <div style={{ marginTop: 12 }}>
              <FieldGroup label="CT Notes">
                <textarea value={form.ct_notes || ""} onChange={(e) => updateField("ct_notes", e.target.value)} rows={2} placeholder="Additional CT notes..." style={{ margin: 0, resize: "vertical" }} />
              </FieldGroup>
            </div>
          )}
        </div>

        {/* Divider */}
        <div style={{ height: 1, background: "var(--border-secondary)", margin: "0 0 20px" }} />

        {/* VAT row */}
        <div>
          <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text-tertiary)", marginBottom: 10, display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ width: 6, height: 6, borderRadius: "50%", background: form.vat_registered ? "var(--success)" : "var(--border-primary)" }} />
            Value Added Tax (VAT)
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "auto 1fr 1fr", gap: 16, alignItems: "end" }}>
            <div style={{ paddingBottom: 6 }}>
              <Toggle id="vat_reg" checked={!!form.vat_registered} onChange={(v) => updateField("vat_registered", v)} label="VAT Registered" />
            </div>
            <FieldGroup label="VAT Period Type">
              <select value={form.vat_period_type || ""} onChange={(e) => updateField("vat_period_type", e.target.value)} style={{ margin: 0 }} disabled={!form.vat_registered}>
                <option value="">Select...</option>
                <option value="monthly">Monthly</option>
                <option value="quarterly">Quarterly</option>
                <option value="annual">Annual</option>
              </select>
            </FieldGroup>
            <FieldGroup label="Period End Day">
              <input type="number" min={1} max={31} value={form.vat_period_end_day ?? ""} onChange={(e) => updateField("vat_period_end_day", e.target.value ? parseInt(e.target.value) : undefined)} placeholder="e.g. 28" style={{ margin: 0 }} disabled={!form.vat_registered} />
            </FieldGroup>
          </div>
          {form.vat_registered && (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginTop: 12 }}>
              <FieldGroup label="First Period End Date">
                <input type="date" value={form.vat_first_period_end_date ? String(form.vat_first_period_end_date).slice(0, 10) : ""} onChange={(e) => updateField("vat_first_period_end_date", e.target.value)} style={{ margin: 0 }} />
              </FieldGroup>
              <FieldGroup label="Return Due (days)">
                <input type="number" min={0} value={form.vat_return_due_days ?? ""} onChange={(e) => updateField("vat_return_due_days", e.target.value ? parseInt(e.target.value) : undefined)} placeholder="e.g. 28" style={{ margin: 0 }} />
              </FieldGroup>
            </div>
          )}
          {form.vat_registered && (
            <div style={{ marginTop: 12 }}>
              <FieldGroup label="VAT Notes">
                <textarea value={form.vat_notes || ""} onChange={(e) => updateField("vat_notes", e.target.value)} rows={2} placeholder="Additional VAT notes..." style={{ margin: 0, resize: "vertical" }} />
              </FieldGroup>
            </div>
          )}
        </div>
      </SectionCard>

      {/* ═══════ License Activities ═══════ */}
      <SectionCard style={{ marginBottom: 0 }}>
        <SectionLabel icon="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2">
          License Activities
        </SectionLabel>
        {(data?.license_activities || []).length === 0 && !newActivity.activity_name ? (
          <div style={{ textAlign: "center", padding: "24px 0", color: "var(--text-quaternary)", fontSize: 13 }}>
            No activities added yet
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {(data?.license_activities || []).map((a) => (
              <div key={a.id} style={{
                display: "flex", alignItems: "center", gap: 12, padding: "10px 14px",
                background: "var(--bg-tertiary)", borderRadius: "var(--radius-sm)", border: "1px solid var(--border-secondary)",
              }}>
                <span style={{ flex: 1, fontSize: 13, fontWeight: 500, color: "var(--text-primary)" }}>{a.activity_name}</span>
                <span style={{
                  fontSize: 11, fontWeight: 600, color: "var(--accent-purple)", background: "var(--accent-purple-light)",
                  padding: "2px 8px", borderRadius: "var(--radius-full)",
                }}>{a.activity_code || "—"}</span>
                <button onClick={() => deleteActivity(a.id)} style={{
                  background: "none", border: "none", cursor: "pointer", padding: 2, color: "var(--text-quaternary)",
                  borderRadius: 4, transition: "all var(--transition-fast)",
                }} onMouseEnter={(e) => { e.currentTarget.style.color = "var(--danger)"; }}
                   onMouseLeave={(e) => { e.currentTarget.style.color = "var(--text-quaternary)"; }}>
                  <Icon path="M18 6L6 18M6 6l12 12" size={14} />
                </button>
              </div>
            ))}
          </div>
        )}
        <div style={{ marginTop: 12 }}>
          <button onClick={() => setShowAddLicenseActivity(true)} style={{
            background: "var(--brand-primary)", color: "#fff", border: "none", borderRadius: "var(--radius-sm)",
            padding: "6px 14px", fontSize: 12, fontWeight: 600, cursor: "pointer",
            display: "flex", alignItems: "center", gap: 6,
          }}><Icon path="M12 4v16m8-8H4" size={13} color="#fff" /> Add Activity</button>
        </div>
      </SectionCard>

      </div>{/* end Row 2 */}

      {/* ═══════ Visa Applications (full-width) ═══════ */}
      {form.is_visa_application && (
        <SectionCard>
          <SectionLabel
            icon="M3 21v-4m0 0V5a2 2 0 012-2h6.5l1 1H21l-3 6 3 6h-8.5l-1-1H5a2 2 0 00-2 2zm0 0h10"
            trailing={
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                {visaCap > 0 && (
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <div style={{ width: 80, height: 6, borderRadius: 3, background: "var(--bg-tertiary)", overflow: "hidden" }}>
                      <div style={{
                        height: "100%", borderRadius: 3, transition: "width var(--transition-base)",
                        width: `${Math.min(100, (visaUsed / visaCap) * 100)}%`,
                        background: visaUsed >= visaCap ? "var(--danger)" : "var(--accent-blue)",
                      }} />
                    </div>
                    <span style={{ fontSize: 12, fontWeight: 600, color: visaUsed >= visaCap ? "var(--danger)" : "var(--text-secondary)" }}>
                      {visaUsed}/{visaCap}
                    </span>
                  </div>
                )}
                {(!visaCap || visaUsed < visaCap) && (
                  <button onClick={() => setShowAddVisa(true)} style={{
                    background: "var(--brand-primary)", color: "#fff",
                    border: "none", borderRadius: "var(--radius-sm)", padding: "6px 14px", fontSize: 12, fontWeight: 600, cursor: "pointer",
                    transition: "all var(--transition-fast)",
                  }}>+ Add Applicant</button>
                )}
              </div>
            }
          >Visa Applications</SectionLabel>

          {(data?.visa_applications || []).length === 0 ? (
            <div style={{ textAlign: "center", padding: "32px 0", color: "var(--text-quaternary)", fontSize: 13 }}>
              No visa applications yet. Click "+ Add Applicant" to get started.
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {(data?.visa_applications || []).map((v: any) => {
                const st = VISA_STATUS_MAP[v.status] || VISA_STATUS_MAP.not_started;
                return (
                  <div key={v.id} style={{
                    display: "flex", alignItems: "center", gap: 16, padding: "12px 16px",
                    background: "var(--bg-tertiary)", borderRadius: "var(--radius-md)", border: "1px solid var(--border-secondary)",
                    transition: "all var(--transition-fast)",
                  }}>
                    <div style={{
                      width: 34, height: 34, borderRadius: "50%",
                      background: "linear-gradient(135deg, var(--accent-blue-light), var(--accent-purple-light))",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      fontSize: 13, fontWeight: 700, color: "var(--accent-blue)", flexShrink: 0,
                    }}>{(v.contact_name || "?").charAt(0).toUpperCase()}</div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)", marginBottom: 2 }}>{v.contact_name || "Unknown"}</div>
                      <div style={{ fontSize: 11, color: "var(--text-tertiary)" }}>
                        {v.visa_type ? <span style={{ textTransform: "capitalize" }}>{v.visa_type}</span> : "—"}
                        {v.designation && <> &middot; {v.designation}</>}
                        {v.salary != null && <> &middot; AED {fmtNumber(v.salary, 0)}/mo</>}
                      </div>
                    </div>
                    <select
                      value={v.status || "not_started"}
                      onChange={(e) => updateVisaStatus(v.id, e.target.value)}
                      style={{
                        padding: "4px 10px", fontSize: 11, fontWeight: 600, width: "auto", margin: 0,
                        background: st.bg, color: st.color, border: "none", borderRadius: "var(--radius-full)",
                        cursor: "pointer", appearance: "auto",
                      }}
                    >
                      {VISA_STATUSES.map(([key, val]) => <option key={key} value={key}>{val.label}</option>)}
                    </select>
                    <button onClick={() => deleteVisaApplication(v.id)} style={{
                      background: "none", border: "none", cursor: "pointer", padding: 4, color: "var(--text-quaternary)",
                      borderRadius: 4, transition: "all var(--transition-fast)",
                    }} onMouseEnter={(e) => { e.currentTarget.style.color = "var(--danger)"; }}
                       onMouseLeave={(e) => { e.currentTarget.style.color = "var(--text-quaternary)"; }}>
                      <Icon path="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" size={15} />
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </SectionCard>
      )}

      {/* ═══════ Save Footer ═══════ */}
      <div style={{
        display: "flex", justifyContent: "flex-end", alignItems: "center", gap: 12,
        paddingTop: 20, marginTop: 4,
        borderTop: "1px solid var(--border-secondary)",
      }}>
        <span style={{ fontSize: 12, color: "var(--text-quaternary)", marginRight: "auto" }}>
          Changes sync back to the linked contact record
        </span>
        <button onClick={saveHandover} disabled={saving} style={{
          background: "var(--brand-primary)", color: "#fff", border: "none",
          borderRadius: "var(--radius-md)", padding: "10px 28px", fontSize: 14, fontWeight: 600,
          cursor: saving ? "wait" : "pointer", opacity: saving ? 0.7 : 1,
          boxShadow: "var(--shadow-sm)", transition: "all var(--transition-fast)",
        }}>
          {saving ? "Saving..." : "Save Handover"}
        </button>
      </div>

      {/* ═══════ Add Proposed Name Panel ═══════ */}
      {showAddName && (
        <>
          <div onClick={() => setShowAddName(false)}
            style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(0,0,0,0.4)", backdropFilter: "blur(4px)", zIndex: "var(--z-modal-backdrop)" as any, transition: "opacity var(--transition-base)" }} />
          <div style={{
            position: "fixed", top: 0, right: 0, bottom: 0, width: 540,
            background: "var(--bg-secondary)", boxShadow: "var(--shadow-xl)",
            zIndex: "var(--z-modal)" as any, overflowY: "auto",
            display: "flex", flexDirection: "column",
          }}>
            <div style={{
              display: "flex", justifyContent: "space-between", alignItems: "center",
              padding: "20px 28px", borderBottom: "1px solid var(--border-primary)",
              position: "sticky", top: 0, background: "var(--bg-secondary)", zIndex: 1,
            }}>
              <div>
                <h3 style={{ fontSize: 16, fontWeight: 700, color: "var(--text-primary)" }}>Add Proposed Name</h3>
                <p style={{ fontSize: 12, color: "var(--text-quaternary)", marginTop: 2 }}>Add a proposed company name ({(data?.proposed_names?.length || 0) + 1} of 3)</p>
              </div>
              <button onClick={() => setShowAddName(false)} style={{
                background: "var(--bg-tertiary)", border: "none", borderRadius: "var(--radius-sm)",
                padding: 6, cursor: "pointer", color: "var(--text-tertiary)", transition: "all var(--transition-fast)",
              }} onMouseEnter={(e) => { e.currentTarget.style.background = "var(--danger-light)"; e.currentTarget.style.color = "var(--danger)"; }}
                 onMouseLeave={(e) => { e.currentTarget.style.background = "var(--bg-tertiary)"; e.currentTarget.style.color = "var(--text-tertiary)"; }}>
                <Icon path="M18 6L6 18M6 6l12 12" size={16} />
              </button>
            </div>
            <div style={{ flex: 1, padding: "24px 28px" }}>
              <FieldGroup label="Company Name *">
                <input
                  value={newName.name}
                  onChange={(e) => setNewName((p) => ({ ...p, name: e.target.value }))}
                  onKeyDown={(e) => e.key === "Enter" && addProposedName()}
                  placeholder="Enter proposed company name"
                  autoFocus
                  style={{ margin: 0 }}
                />
              </FieldGroup>
            </div>
            <div style={{
              padding: "16px 28px", borderTop: "1px solid var(--border-primary)",
              display: "flex", gap: 12, background: "var(--bg-secondary)",
              position: "sticky", bottom: 0,
            }}>
              <button onClick={addProposedName} disabled={!newName.name.trim()} style={{
                flex: 1, background: newName.name.trim() ? "var(--brand-primary)" : "var(--bg-tertiary)",
                color: newName.name.trim() ? "#fff" : "var(--text-quaternary)", border: "none",
                borderRadius: "var(--radius-md)", padding: "10px 0", fontSize: 14, fontWeight: 600,
                cursor: newName.name.trim() ? "pointer" : "default", transition: "all var(--transition-fast)",
              }}>Add Name</button>
              <button onClick={() => setShowAddName(false)} style={{
                background: "var(--bg-tertiary)", color: "var(--text-secondary)", border: "none",
                borderRadius: "var(--radius-md)", padding: "10px 24px", fontSize: 14, fontWeight: 500, cursor: "pointer",
              }}>Cancel</button>
            </div>
          </div>
        </>
      )}

      {/* ═══════ Add License Activity Panel ═══════ */}
      {showAddLicenseActivity && (
        <>
          <div onClick={() => setShowAddLicenseActivity(false)}
            style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(0,0,0,0.4)", backdropFilter: "blur(4px)", zIndex: "var(--z-modal-backdrop)" as any, transition: "opacity var(--transition-base)" }} />
          <div style={{
            position: "fixed", top: 0, right: 0, bottom: 0, width: 540,
            background: "var(--bg-secondary)", boxShadow: "var(--shadow-xl)",
            zIndex: "var(--z-modal)" as any, overflowY: "auto",
            display: "flex", flexDirection: "column",
          }}>
            <div style={{
              display: "flex", justifyContent: "space-between", alignItems: "center",
              padding: "20px 28px", borderBottom: "1px solid var(--border-primary)",
              position: "sticky", top: 0, background: "var(--bg-secondary)", zIndex: 1,
            }}>
              <div>
                <h3 style={{ fontSize: 16, fontWeight: 700, color: "var(--text-primary)" }}>Add License Activity</h3>
                <p style={{ fontSize: 12, color: "var(--text-quaternary)", marginTop: 2 }}>Add a license activity for this project</p>
              </div>
              <button onClick={() => setShowAddLicenseActivity(false)} style={{
                background: "var(--bg-tertiary)", border: "none", borderRadius: "var(--radius-sm)",
                padding: 6, cursor: "pointer", color: "var(--text-tertiary)", transition: "all var(--transition-fast)",
              }} onMouseEnter={(e) => { e.currentTarget.style.background = "var(--danger-light)"; e.currentTarget.style.color = "var(--danger)"; }}
                 onMouseLeave={(e) => { e.currentTarget.style.background = "var(--bg-tertiary)"; e.currentTarget.style.color = "var(--text-tertiary)"; }}>
                <Icon path="M18 6L6 18M6 6l12 12" size={16} />
              </button>
            </div>
            <div style={{ flex: 1, padding: "24px 28px" }}>
              <div style={{ marginBottom: 14 }}>
                <FieldGroup label="Activity Name *">
                  <input
                    value={newActivity.activity_name}
                    onChange={(e) => setNewActivity((p) => ({ ...p, activity_name: e.target.value }))}
                    onKeyDown={(e) => e.key === "Enter" && addActivity()}
                    placeholder="Activity name"
                    autoFocus
                    style={{ margin: 0 }}
                  />
                </FieldGroup>
              </div>
              <FieldGroup label="Code">
                <input
                  value={newActivity.activity_code}
                  onChange={(e) => setNewActivity((p) => ({ ...p, activity_code: e.target.value }))}
                  onKeyDown={(e) => e.key === "Enter" && addActivity()}
                  placeholder="Code"
                  style={{ margin: 0 }}
                />
              </FieldGroup>
            </div>
            <div style={{
              padding: "16px 28px", borderTop: "1px solid var(--border-primary)",
              display: "flex", gap: 12, background: "var(--bg-secondary)",
              position: "sticky", bottom: 0,
            }}>
              <button onClick={addActivity} disabled={!newActivity.activity_name} style={{
                flex: 1, background: newActivity.activity_name ? "var(--brand-primary)" : "var(--bg-tertiary)",
                color: newActivity.activity_name ? "#fff" : "var(--text-quaternary)", border: "none",
                borderRadius: "var(--radius-md)", padding: "10px 0", fontSize: 14, fontWeight: 600,
                cursor: newActivity.activity_name ? "pointer" : "default", transition: "all var(--transition-fast)",
              }}>Add Activity</button>
              <button onClick={() => setShowAddLicenseActivity(false)} style={{
                background: "var(--bg-tertiary)", color: "var(--text-secondary)", border: "none",
                borderRadius: "var(--radius-md)", padding: "10px 24px", fontSize: 14, fontWeight: 500, cursor: "pointer",
              }}>Cancel</button>
            </div>
          </div>
        </>
      )}

      {/* ═══════ Add Visa Applicant Panel ═══════ */}
      {showAddVisa && (
        <>
          <div onClick={() => setShowAddVisa(false)}
            style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(0,0,0,0.4)", backdropFilter: "blur(4px)", zIndex: "var(--z-modal-backdrop)" as any, transition: "opacity var(--transition-base)" }} />
          <div style={{
            position: "fixed", top: 0, right: 0, bottom: 0, width: 540,
            background: "var(--bg-secondary)", boxShadow: "var(--shadow-xl)",
            zIndex: "var(--z-modal)" as any, overflowY: "auto",
            display: "flex", flexDirection: "column",
          }}>
            <div style={{
              display: "flex", justifyContent: "space-between", alignItems: "center",
              padding: "20px 28px", borderBottom: "1px solid var(--border-primary)",
              position: "sticky", top: 0, background: "var(--bg-secondary)", zIndex: 1,
            }}>
              <div>
                <h3 style={{ fontSize: 16, fontWeight: 700, color: "var(--text-primary)" }}>Add Visa Applicant</h3>
                <p style={{ fontSize: 12, color: "var(--text-quaternary)", marginTop: 2 }}>Link a contact as a visa applicant</p>
              </div>
              <button onClick={() => setShowAddVisa(false)} style={{
                background: "var(--bg-tertiary)", border: "none", borderRadius: "var(--radius-sm)",
                padding: 6, cursor: "pointer", color: "var(--text-tertiary)", transition: "all var(--transition-fast)",
              }} onMouseEnter={(e) => { e.currentTarget.style.background = "var(--danger-light)"; e.currentTarget.style.color = "var(--danger)"; }}
                 onMouseLeave={(e) => { e.currentTarget.style.background = "var(--bg-tertiary)"; e.currentTarget.style.color = "var(--text-tertiary)"; }}>
                <Icon path="M18 6L6 18M6 6l12 12" size={16} />
              </button>
            </div>
            <div style={{ flex: 1, padding: "24px 28px" }}>
              <div style={{ marginBottom: 14 }}>
                <FieldGroup label="Applicant *">
                  {(() => {
                    const existingIds = new Set((data?.visa_applications || []).map((v: any) => v.contact_id));
                    const available = contacts.filter((c) => !existingIds.has(c.id));
                    const related = available.filter((c) => relatedPartyIds.has(c.id));
                    const others = available.filter((c) => !relatedPartyIds.has(c.id));
                    return (
                      <select value={newVisa.contact_id} onChange={(e) => setNewVisa((p) => ({ ...p, contact_id: e.target.value }))} style={{ margin: 0 }}>
                        <option value="">Select contact...</option>
                        {related.length > 0 && (
                          <optgroup label="Related Parties">
                            {related.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                          </optgroup>
                        )}
                        {others.length > 0 && (
                          <optgroup label="Other Contacts">
                            {others.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                          </optgroup>
                        )}
                      </select>
                    );
                  })()}
                </FieldGroup>
              </div>
              <div style={{ height: 1, background: "var(--border-secondary)", margin: "4px 0 14px" }} />
              <div style={{ marginBottom: 14 }}>
                <FieldGroup label="Visa Type">
                  <select value={newVisa.visa_type} onChange={(e) => setNewVisa((p) => ({ ...p, visa_type: e.target.value }))} style={{ margin: 0 }}>
                    <option value="">Select...</option>
                    <option value="employment">Employment</option>
                    <option value="investor">Investor</option>
                    <option value="partner">Partner</option>
                    <option value="dependent">Dependent</option>
                    <option value="golden">Golden</option>
                    <option value="tourist">Tourist</option>
                  </select>
                </FieldGroup>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <FieldGroup label="Designation"><input value={newVisa.designation} onChange={(e) => setNewVisa((p) => ({ ...p, designation: e.target.value }))} placeholder="Job title" style={{ margin: 0 }} /></FieldGroup>
                <FieldGroup label="Salary (AED)"><input type="number" value={newVisa.salary} onChange={(e) => setNewVisa((p) => ({ ...p, salary: e.target.value }))} placeholder="Monthly" style={{ margin: 0 }} /></FieldGroup>
              </div>
            </div>
            <div style={{
              padding: "16px 28px", borderTop: "1px solid var(--border-primary)",
              display: "flex", gap: 12, background: "var(--bg-secondary)",
              position: "sticky", bottom: 0,
            }}>
              <button onClick={addVisaApplication} disabled={!newVisa.contact_id} style={{
                flex: 1, background: newVisa.contact_id ? "var(--brand-primary)" : "var(--bg-tertiary)",
                color: newVisa.contact_id ? "#fff" : "var(--text-quaternary)", border: "none",
                borderRadius: "var(--radius-md)", padding: "10px 0", fontSize: 14, fontWeight: 600,
                cursor: newVisa.contact_id ? "pointer" : "default", transition: "all var(--transition-fast)",
              }}>Add Applicant</button>
              <button onClick={() => setShowAddVisa(false)} style={{
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
