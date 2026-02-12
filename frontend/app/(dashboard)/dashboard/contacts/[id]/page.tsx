"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { useDocumentViewer } from "@/components/DocumentViewer";
import { useToast } from "@/components/Toast";
import { Icon } from "@/components/ui/Icon";
import { SlideOverPanel } from "@/components/ui/SlideOverPanel";
import { FormField } from "@/components/ui/FormField";

const JURISDICTIONS = ["", "DED Mainland", "DMCC", "ADGM", "DIFC", "RAK ICC", "JAFZA", "Other"];
const ADDRESS_TYPES = ["registered_office", "mailing", "branch", "billing", "residential", "other"];

const LINK_TYPES = ["ownership", "control", "director", "manages", "employee", "family"] as const;
const FAMILY_KINDS = ["father", "mother", "spouse", "child", "sibling", "dependent", "other"];

interface Doc {
  id: string;
  category: string;
  file_name: string;
  file_path: string;
  file_size: string | null;
}

interface Address {
  id: string;
  contact_id: string;
  address_type: string;
  address_line_1: string;
  address_line_2: string | null;
  city: string | null;
  state_emirate: string | null;
  postal_code: string | null;
  country: string | null;
  is_primary?: boolean | null;
  notes?: string | null;
  created_at: string;
}

interface Contact {
  id: string;
  contact_type: string;
  name: string;
  email: string | null;
  phone_primary: string | null;
  phone_mobile: string | null;
  phone_office: string | null;
  status: string;
  notes: string | null;
  country: string | null;
  trade_license_no: string | null;
  jurisdiction: string | null;
  legal_form: string | null;
  license_issue_date: string | null;
  license_expiry_date: string | null;
  establishment_card_expiry: string | null;
  visa_expiry_date: string | null;
  tax_registration_no: string | null;
  website: string | null;
  activity_license_activities: string | null;
  vat_registered: boolean | null;
  vat_period_type: string | null;
  vat_period_end_day: number | null;
  vat_first_period_end_date: string | null;
  vat_return_due_days: number | null;
  vat_notes: string | null;
  ct_registered: boolean | null;
  ct_registration_no: string | null;
  ct_period_type: string | null;
  ct_financial_year_start_month: number | null;
  ct_financial_year_start_day: number | null;
  ct_filing_due_months: number | null;
  ct_notes: string | null;
  first_name: string | null;
  last_name: string | null;
  passport_no: string | null;
  passport_expiry: string | null;
  nationality: string | null;
  date_of_birth: string | null;
  visa_type: string | null;
  emirates_id: string | null;
  emirates_id_expiry: string | null;
  gender: string | null;
  designation_title: string | null;
  addresses: Address[];
  documents: Doc[];
  created_at: string;
}

interface ContactLinkItem {
  link_id: string;
  direction: string;
  other_contact_id: string;
  other_contact_name: string;
  other_contact_type: string;
  link_type: string;
  percentage?: number | null;
  voting_pct?: number | null;
  role_label?: string | null;
  relationship_kind?: string | null;
  inverse_label?: string | null;
  number_of_shares?: number | null;
  share_class?: string | null;
  nominal_value_per_share?: number | null;
  share_currency?: string | null;
}

interface ContactLinksData {
  contact_id: string;
  contact_name: string;
  outgoing: ContactLinkItem[];
  incoming: ContactLinkItem[];
}

/** Full link from GET /api/compliance/ownership-links/{id} (for edit) */
interface OwnershipLinkFull {
  id: string;
  owner_contact_id: string;
  owned_contact_id: string;
  link_type: string;
  percentage?: number | null;
  voting_pct?: number | null;
  is_nominee: boolean;
  start_date?: string | null;
  end_date?: string | null;
  role_label?: string | null;
  relationship_kind?: string | null;
  number_of_shares?: number | null;
  share_class?: string | null;
  nominal_value_per_share?: number | null;
  share_currency?: string | null;
}

interface ContactOption {
  id: string;
  name: string;
  contact_type: string;
}

function toDateStr(s: string | null): string {
  if (!s) return "";
  return s.slice(0, 10);
}

function nextVatDue(c: Contact): string | null {
  if (!c.vat_first_period_end_date || c.vat_return_due_days == null) return null;
  const periodEnd = new Date(c.vat_first_period_end_date.slice(0, 10));
  const monthsPerPeriod = c.vat_period_type === "quarterly" ? 3 : 1;
  const now = new Date();
  while (periodEnd < now) periodEnd.setMonth(periodEnd.getMonth() + monthsPerPeriod);
  const due = new Date(periodEnd);
  due.setDate(due.getDate() + c.vat_return_due_days);
  return due.toISOString().slice(0, 10);
}

function nextCtDue(c: Contact): string | null {
  if (c.ct_financial_year_start_month == null || c.ct_filing_due_months == null) return null;
  const now = new Date();
  // Period end = last day of month before financial year start (e.g. 31 Mar for Apr 1 start)
  let yearEnd = new Date(now.getFullYear(), c.ct_financial_year_start_month - 1, 0);
  if (yearEnd > now) yearEnd = new Date(now.getFullYear() - 1, c.ct_financial_year_start_month - 1, 0);
  const due = new Date(yearEnd);
  due.setMonth(due.getMonth() + c.ct_filing_due_months);
  return due.toISOString().slice(0, 10);
}

function linkItemLabel(item: ContactLinkItem): string {
  if (item.link_type === "ownership" && item.percentage != null) return `${item.percentage}%`;
  if (item.role_label) return item.role_label;
  if (item.link_type === "family" && item.inverse_label) return item.inverse_label;
  if (item.link_type === "family" && item.relationship_kind) return item.relationship_kind;
  return item.link_type;
}

export default function ContactDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;
  const [contact, setContact] = useState<Contact | null>(null);
  const [contactIds, setContactIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadCategory, setUploadCategory] = useState("other");
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const [newAddrOpen, setNewAddrOpen] = useState(false);
  const [newAddr, setNewAddr] = useState({ address_type: "other", address_line_1: "", address_line_2: "", city: "", state_emirate: "", postal_code: "", country: "UAE", is_primary: false, notes: "" });
  const [addingAddr, setAddingAddr] = useState(false);
  const [editingAddrId, setEditingAddrId] = useState<string | null>(null);
  const [editAddr, setEditAddr] = useState({ address_type: "other", address_line_1: "", address_line_2: "", city: "", state_emirate: "", postal_code: "", country: "", is_primary: false, notes: "" });
  const [linkData, setLinkData] = useState<ContactLinksData | null>(null);
  const [linkFormOpen, setLinkFormOpen] = useState(false);
  const [linkFormMode, setLinkFormMode] = useState<"add" | "edit">("add");
  const [linkFormEditingId, setLinkFormEditingId] = useState<string | null>(null);
  const [contactsForPicker, setContactsForPicker] = useState<ContactOption[]>([]);
  const [linkForm, setLinkForm] = useState({
    thisContactIsOwner: true,
    other_contact_id: "",
    link_type: "ownership" as string,
    percentage: null as number | null,
    voting_pct: null as number | null,
    role_label: "",
    relationship_kind: "",
    number_of_shares: null as number | null,
    share_class: "",
    nominal_value_per_share: null as number | null,
    share_currency: "",
    start_date: "",
    end_date: "",
    is_nominee: false,
  });
  const [linkFormError, setLinkFormError] = useState("");
  const [linkFormSaving, setLinkFormSaving] = useState(false);
  const [linkFormOtherName, setLinkFormOtherName] = useState("");
  const [activeTab, setActiveTab] = useState<"details" | "documents" | "addresses" | "connections">("details");
  const [editSection, setEditSection] = useState<"basic" | "company" | "tax" | "individual" | "notes" | null>(null);
  const [collapsedSections, setCollapsedSections] = useState<Record<string, boolean>>({});
  const [sidebarTab, setSidebarTab] = useState<"info" | "activities">("info");
  const [contactActivities, setContactActivities] = useState<Array<{ id: string; title: string; activity_type: string; status: string; start_datetime: string }>>([]);
  const [moreOpen, setMoreOpen] = useState(false);
  const [linkedRecords, setLinkedRecords] = useState<{
    quotations: { id: string; number: string; status: string }[];
    sales_orders: { id: string; number: string; status: string }[];
    invoices: { id: string; number: string; status: string }[];
    projects: { id: string; title: string; status: string }[];
    opportunities: { id: string; name: string; stage: string }[];
  } | null>(null);
  const toast = useToast();

  function toggleSection(key: string) {
    setCollapsedSections((prev) => ({ ...prev, [key]: !prev[key] }));
  }

  function copyToClipboard(text: string) {
    navigator.clipboard.writeText(text).then(() => toast.success("Copied")).catch(() => {});
  }

  function refetchLinkData() {
    if (!id) return;
    api.get(`/api/compliance/contact-links?contact_id=${encodeURIComponent(id)}`).then((d: ContactLinksData) => setLinkData(d)).catch(() => setLinkData(null));
  }

  function load() {
    if (!id) return;
    setLoading(true);
    api.get(`/api/contacts/${id}`).then((c: Contact) => setContact(c)).catch(() => setContact(null)).finally(() => setLoading(false));
  }

  useEffect(() => { load(); }, [id]);

  useEffect(() => {
    api.get("/api/contacts/").then((list) => setContactIds((list as { id: string }[]).map((c) => c.id))).catch(() => setContactIds([]));
  }, []);

  useEffect(() => {
    const currentIdx = contactIds.indexOf(id);
    const prev = currentIdx > 0 ? contactIds[currentIdx - 1] : null;
    const next = currentIdx >= 0 && currentIdx < contactIds.length - 1 ? contactIds[currentIdx + 1] : null;
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLSelectElement) return;
      if (e.key === "ArrowLeft" && prev) { e.preventDefault(); router.push(`/dashboard/contacts/${prev}`); }
      if (e.key === "ArrowRight" && next) { e.preventDefault(); router.push(`/dashboard/contacts/${next}`); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [id, contactIds, router]);

  useEffect(() => {
    if (!id) return;
    api.get(`/api/compliance/contact-links?contact_id=${encodeURIComponent(id)}`).then((d: ContactLinksData) => setLinkData(d)).catch(() => setLinkData(null));
    api.get(`/api/contacts/${id}/linked-records`).then((d: any) => setLinkedRecords(d)).catch(() => setLinkedRecords(null));
    api.get(`/api/activities/?contact_id=${encodeURIComponent(id)}`).then((d: any) => setContactActivities(Array.isArray(d) ? d.slice(0, 10) : [])).catch(() => setContactActivities([]));
  }, [id]);

  async function handleSaveContact(e: React.FormEvent) {
    e.preventDefault();
    if (!contact) return;
    setSaving(true);
    try {
      const body: Record<string, unknown> = {
        contact_type: contact.contact_type,
        name: contact.name,
        email: contact.email || null,
        phone_primary: contact.phone_primary || null,
        phone_mobile: contact.phone_mobile || null,
        phone_office: contact.phone_office || null,
        status: contact.status,
        notes: contact.notes || null,
        country: contact.country || null,
        trade_license_no: contact.trade_license_no || null,
        jurisdiction: contact.jurisdiction || null,
        legal_form: contact.legal_form || null,
        license_issue_date: contact.license_issue_date ? contact.license_issue_date.slice(0, 10) : null,
        license_expiry_date: contact.license_expiry_date ? contact.license_expiry_date.slice(0, 10) : null,
        establishment_card_expiry: contact.establishment_card_expiry ? contact.establishment_card_expiry.slice(0, 10) : null,
        visa_expiry_date: contact.visa_expiry_date ? contact.visa_expiry_date.slice(0, 10) : null,
        tax_registration_no: contact.tax_registration_no || null,
        website: contact.website || null,
        activity_license_activities: contact.activity_license_activities || null,
        first_name: contact.first_name || null,
        last_name: contact.last_name || null,
        passport_no: contact.passport_no || null,
        passport_expiry: contact.passport_expiry ? contact.passport_expiry.slice(0, 10) : null,
        nationality: contact.nationality || null,
        date_of_birth: contact.date_of_birth ? contact.date_of_birth.slice(0, 10) : null,
        visa_type: contact.visa_type || null,
        emirates_id: contact.emirates_id || null,
        emirates_id_expiry: contact.emirates_id_expiry ? contact.emirates_id_expiry.slice(0, 10) : null,
        gender: contact.gender || null,
        designation_title: contact.designation_title || null,
        vat_registered: contact.vat_registered ?? null,
        vat_period_type: contact.vat_period_type || null,
        vat_period_end_day: contact.vat_period_end_day ?? null,
        vat_first_period_end_date: contact.vat_first_period_end_date ? contact.vat_first_period_end_date.slice(0, 10) : null,
        vat_return_due_days: contact.vat_return_due_days ?? null,
        vat_notes: contact.vat_notes || null,
        ct_registered: contact.ct_registered ?? null,
        ct_registration_no: contact.ct_registration_no || null,
        ct_period_type: contact.ct_period_type || null,
        ct_financial_year_start_month: contact.ct_financial_year_start_month ?? null,
        ct_financial_year_start_day: contact.ct_financial_year_start_day ?? null,
        ct_filing_due_months: contact.ct_filing_due_months ?? null,
        ct_notes: contact.ct_notes || null,
      };
      const updated = await api.patch(`/api/contacts/${id}`, body);
      setContact(updated);
      setEditSection(null);
      toast.success("Contact saved successfully");
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to save contact");
    } finally {
      setSaving(false);
    }
  }

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !contact) return;
    setUploadError("");
    setUploading(true);
    try {
      const form = new FormData();
      form.append("file", file);
      form.append("contact_id", id);
      form.append("category", uploadCategory);
      const doc = await api.postForm("/api/documents/", form);
      setContact((prev) => prev ? { ...prev, documents: [...prev.documents, { id: doc.id, category: doc.category, file_name: doc.file_name, file_path: doc.file_path, file_size: doc.file_size ? String(doc.file_size) : null }] } : null);
      e.target.value = "";
      toast.success("Document uploaded");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Upload failed";
      setUploadError(msg);
      toast.error(msg);
    } finally {
      setUploading(false);
    }
  }

  const { openViewer } = useDocumentViewer();

  function downloadDoc(docId: string, fileName: string) {
    api.getBlob(`/api/documents/${docId}/download`).then((blob) => {
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = fileName;
      a.click();
      URL.revokeObjectURL(a.href);
    }).catch(() => {});
  }

  function viewDoc(docId: string, fileName: string) {
    openViewer({
      apiPath: `/api/documents/${docId}/preview`,
      fileName,
    });
  }

  async function addAddress(e: React.FormEvent) {
    e.preventDefault();
    if (!newAddr.address_line_1.trim()) return;
    setAddingAddr(true);
    try {
      const created = await api.post(`/api/contacts/${id}/addresses`, {
        address_type: newAddr.address_type,
        address_line_1: newAddr.address_line_1,
        address_line_2: newAddr.address_line_2 || null,
        city: newAddr.city || null,
        state_emirate: newAddr.state_emirate || null,
        postal_code: newAddr.postal_code || null,
        country: newAddr.country || null,
        is_primary: newAddr.is_primary,
        notes: newAddr.notes || null,
      });
      setContact((prev) => prev ? { ...prev, addresses: [...prev.addresses, created] } : null);
      setNewAddr({ address_type: "other", address_line_1: "", address_line_2: "", city: "", state_emirate: "", postal_code: "", country: "UAE", is_primary: false, notes: "" });
      setNewAddrOpen(false);
    } finally {
      setAddingAddr(false);
    }
  }

  async function updateAddress(addrId: string, patch: { address_type?: string; address_line_1?: string; address_line_2?: string | null; city?: string | null; state_emirate?: string | null; postal_code?: string | null; country?: string | null; is_primary?: boolean; notes?: string | null }) {
    const updated = await api.patch(`/api/contacts/${id}/addresses/${addrId}`, patch);
    setContact((prev) => prev ? { ...prev, addresses: prev.addresses.map((a) => (a.id === addrId ? updated : a)) } : null);
    setEditingAddrId(null);
  }

  async function deleteAddress(addrId: string) {
    await api.delete(`/api/contacts/${id}/addresses/${addrId}`);
    setContact((prev) => prev ? { ...prev, addresses: prev.addresses.filter((a) => a.id !== addrId) } : null);
  }

  function openAddLinkForm() {
    setLinkFormMode("add");
    setLinkFormEditingId(null);
    setLinkFormOtherName("");
    setLinkForm({
      thisContactIsOwner: true,
      other_contact_id: "",
      link_type: "ownership",
      percentage: null,
      voting_pct: null,
      role_label: "",
      relationship_kind: "",
      number_of_shares: null,
      share_class: "",
      nominal_value_per_share: null,
      share_currency: "",
      start_date: "",
      end_date: "",
      is_nominee: false,
    });
    setLinkFormError("");
    setLinkFormOpen(true);
    api.get("/api/contacts/").then((list: Contact[]) => {
      setContactsForPicker(list.filter((c) => c.id !== id).map((c) => ({ id: c.id, name: c.name, contact_type: c.contact_type })));
    }).catch(() => setContactsForPicker([]));
  }

  async function openEditLinkForm(linkId: string, otherContactName?: string) {
    setLinkFormError("");
    setLinkFormOpen(true);
    setLinkFormMode("edit");
    setLinkFormEditingId(linkId);
    setLinkFormOtherName(otherContactName ?? "");
    try {
      const link = await api.get(`/api/compliance/ownership-links/${linkId}`) as OwnershipLinkFull;
      const thisId = id!;
      setLinkForm({
        thisContactIsOwner: link.owner_contact_id === thisId,
        other_contact_id: link.owner_contact_id === thisId ? link.owned_contact_id : link.owner_contact_id,
        link_type: link.link_type,
        percentage: link.percentage ?? null,
        voting_pct: link.voting_pct ?? null,
        role_label: link.role_label ?? "",
        relationship_kind: link.relationship_kind ?? "",
        number_of_shares: link.number_of_shares ?? null,
        share_class: link.share_class ?? "",
        nominal_value_per_share: link.nominal_value_per_share ?? null,
        share_currency: link.share_currency ?? "",
        start_date: link.start_date ? link.start_date.toString().slice(0, 10) : "",
        end_date: link.end_date ? link.end_date.toString().slice(0, 10) : "",
        is_nominee: link.is_nominee ?? false,
      });
      if (!otherContactName && linkData) {
        const item = [...linkData.outgoing, ...linkData.incoming].find((l) => l.link_id === linkId);
        setLinkFormOtherName(item?.other_contact_name ?? "");
      }
      setContactsForPicker([]);
    } catch {
      setLinkFormError("Failed to load link");
    }
  }

  function closeLinkForm() {
    setLinkFormOpen(false);
    setLinkFormEditingId(null);
    setLinkFormError("");
    setLinkFormOtherName("");
  }

  function linkFormFilteredContacts(): ContactOption[] {
    if (linkFormMode === "edit") return contactsForPicker;
    const lt = linkForm.link_type;
    if (lt === "family") return contactsForPicker.filter((c) => c.contact_type === "individual");
    if (lt === "director" || lt === "manages" || lt === "employee") {
      if (linkForm.thisContactIsOwner) return contactsForPicker.filter((c) => c.contact_type === "company");
      return contactsForPicker.filter((c) => c.contact_type === "individual");
    }
    return contactsForPicker;
  }

  async function submitLinkForm(e: React.FormEvent) {
    e.preventDefault();
    setLinkFormError("");
    if (linkFormMode === "add") {
      if (!linkForm.other_contact_id.trim()) {
        setLinkFormError("Please select the other contact");
        return;
      }
      if (linkForm.link_type === "family" && !linkForm.relationship_kind.trim()) {
        setLinkFormError("Relationship type is required for family links");
        return;
      }
      const owner_id = linkForm.thisContactIsOwner ? id! : linkForm.other_contact_id;
      const owned_id = linkForm.thisContactIsOwner ? linkForm.other_contact_id : id!;
      setLinkFormSaving(true);
      try {
        await api.post("/api/compliance/ownership-links", {
          owner_contact_id: owner_id,
          owned_contact_id: owned_id,
          link_type: linkForm.link_type,
          percentage: linkForm.percentage ?? undefined,
          voting_pct: linkForm.voting_pct ?? undefined,
          is_nominee: linkForm.link_type === "director" ? linkForm.is_nominee : undefined,
          start_date: linkForm.start_date || undefined,
          end_date: linkForm.end_date || undefined,
          role_label: linkForm.role_label || undefined,
          relationship_kind: linkForm.relationship_kind || undefined,
          number_of_shares: linkForm.number_of_shares ?? undefined,
          share_class: linkForm.share_class || undefined,
          nominal_value_per_share: linkForm.nominal_value_per_share ?? undefined,
          share_currency: linkForm.share_currency || undefined,
        });
        refetchLinkData();
        closeLinkForm();
        toast.success("Connection added");
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : "Failed to add connection";
        setLinkFormError(msg);
        toast.error(msg);
      } finally {
        setLinkFormSaving(false);
      }
    } else {
      if (!linkFormEditingId) return;
      if (linkForm.link_type === "family" && !linkForm.relationship_kind.trim()) {
        setLinkFormError("Relationship type is required for family links");
        return;
      }
      setLinkFormSaving(true);
      try {
        await api.patch(`/api/compliance/ownership-links/${linkFormEditingId}`, {
          link_type: linkForm.link_type,
          percentage: linkForm.percentage ?? undefined,
          voting_pct: linkForm.voting_pct ?? undefined,
          is_nominee: linkForm.link_type === "director" ? linkForm.is_nominee : undefined,
          start_date: linkForm.start_date || undefined,
          end_date: linkForm.end_date || undefined,
          role_label: linkForm.role_label || undefined,
          relationship_kind: linkForm.relationship_kind || undefined,
          number_of_shares: linkForm.number_of_shares ?? undefined,
          share_class: linkForm.share_class || undefined,
          nominal_value_per_share: linkForm.nominal_value_per_share ?? undefined,
          share_currency: linkForm.share_currency || undefined,
        });
        refetchLinkData();
        closeLinkForm();
        toast.success("Connection updated");
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : "Failed to update connection";
        setLinkFormError(msg);
        toast.error(msg);
      } finally {
        setLinkFormSaving(false);
      }
    }
  }

  async function deleteLink(linkId: string) {
    if (!window.confirm("Remove this connection?")) return;
    try {
      await api.delete(`/api/compliance/ownership-links/${linkId}`);
      refetchLinkData();
      closeLinkForm();
      toast.success("Connection removed");
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to remove connection");
    }
  }

  if (loading) {
    return (
      <div>
        <div className="page-header">
          <div className="page-header-content">
            <h1 className="page-title">Contact Details</h1>
            <p className="page-subtitle">Loading contact information...</p>
          </div>
        </div>
        <div className="flex items-center justify-center" style={{ padding: 80 }}>
          <div className="loading-spinner" style={{ width: 32, height: 32 }}></div>
        </div>
      </div>
    );
  }

  if (!contact) {
    return (
      <div>
        <div className="page-header">
          <div className="page-header-content">
            <h1 className="page-title">Contact Not Found</h1>
            <p className="page-subtitle">The requested contact does not exist</p>
          </div>
        </div>
        <div className="empty-state" style={{ minHeight: 400 }}>
          <div className="empty-state-icon">
            <Icon path="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z M12 9v4 M12 17h.01" size={48} />
          </div>
          <div className="empty-state-title">Contact not found</div>
          <div className="empty-state-description">
            This contact may have been deleted or you don't have permission to view it
          </div>
          <a href="/dashboard/contacts" className="btn-primary">
            <Icon path="M19 12H5 M12 19l-7-7 7-7" size={16} />
            Back to Contacts
          </a>
        </div>
      </div>
    );
  }

  const isCompany = contact.contact_type === "company";
  const totalConnections = linkData ? linkData.outgoing.length + linkData.incoming.length : 0;

  // --- Expiry date helpers for sidebar ---
  const expiryDaysLeft = (dateStr: string | null): number | null => {
    if (!dateStr) return null;
    const d = new Date(dateStr.slice(0, 10));
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    return Math.ceil((d.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  };

  const expiryColor = (days: number | null): string => {
    if (days === null) return "var(--text-quaternary)";
    if (days < 0) return "var(--danger)";
    if (days <= 30) return "var(--danger)";
    if (days <= 90) return "var(--warning)";
    return "var(--success)";
  };

  const expiryItems: { label: string; date: string | null }[] = isCompany
    ? [
        { label: "License expiry", date: contact.license_expiry_date },
        { label: "Establishment card", date: contact.establishment_card_expiry },
        { label: "Visa expiry", date: contact.visa_expiry_date },
      ]
    : [
        { label: "Passport expiry", date: contact.passport_expiry },
        { label: "Visa expiry", date: contact.visa_expiry_date },
        { label: "Emirates ID expiry", date: contact.emirates_id_expiry },
      ];

  const tabs = [
    { key: "details" as const, label: "Details" },
    { key: "documents" as const, label: "Documents", count: contact.documents.length },
    { key: "addresses" as const, label: "Addresses", count: contact.addresses.length },
    { key: "connections" as const, label: "Connections", count: totalConnections },
  ];

  // --- Collapsible section header helper ---
  const renderSectionHeader = (sectionKey: string, title: string) => {
    const collapsed = collapsedSections[sectionKey];
    return (
      <button
        type="button"
        onClick={() => toggleSection(sectionKey)}
        style={{ display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%", background: "none", border: "none", padding: "12px 0", cursor: "pointer", marginBottom: collapsed ? 0 : 16 }}
      >
        <h3 style={{ fontSize: 16, fontWeight: 600, color: "var(--text-primary)", margin: 0 }}>{title}</h3>
        <Icon path={collapsed ? "M9 18l6-6-6-6" : "M6 9l6 6 6-6"} size={16} />
      </button>
    );
  };

  // --- Contact info row helper ---
  const renderInfoRow = (icon: string, label: string, value: string | null) => {
    if (!value) return null;
    return (
      <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "6px 0" }}>
        <div style={{ width: 28, height: 28, borderRadius: "var(--radius-sm)", background: "var(--bg-tertiary)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, color: "var(--text-tertiary)" }}>
          <Icon path={icon} size={14} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 11, color: "var(--text-quaternary)", fontWeight: 500, textTransform: "uppercase", letterSpacing: "0.04em" }}>{label}</div>
          <div style={{ fontSize: 13, color: "var(--text-primary)", fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{value}</div>
        </div>
        <button type="button" className="btn-ghost" style={{ padding: 4, flexShrink: 0 }} onClick={() => copyToClipboard(value)} title="Copy">
          <Icon path="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2 M9 2h6a1 1 0 0 1 1 1v2a1 1 0 0 1-1 1H9a1 1 0 0 1-1-1V3a1 1 0 0 1 1-1z" size={12} />
        </button>
      </div>
    );
  };

  const currentIndex = contactIds.indexOf(id);
  const prevId = currentIndex > 0 ? contactIds[currentIndex - 1] : null;
  const nextId = currentIndex >= 0 && currentIndex < contactIds.length - 1 ? contactIds[currentIndex + 1] : null;

  return (
    <div>
      {/* Breadcrumb & navigation */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12, marginBottom: 20 }}>
        <a href="/dashboard/contacts" style={{ fontSize: 13, color: "var(--text-tertiary)", textDecoration: "none", display: "inline-flex", alignItems: "center", gap: 6, fontWeight: 500 }}>
          <Icon path="M19 12H5 M12 19l-7-7 7-7" size={14} />
          Contacts
        </a>
        {contactIds.length > 0 && (
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <button
              type="button"
              className="btn-ghost btn-sm"
              disabled={!prevId}
              onClick={() => prevId && router.push(`/dashboard/contacts/${prevId}`)}
              style={{ display: "flex", alignItems: "center", gap: 4 }}
              title="Previous contact"
            >
              <Icon path="M19 12H5 M12 19l-7-7 7-7" size={14} />
              Prev
            </button>
            <span style={{ fontSize: 12, color: "var(--text-tertiary)", fontWeight: 500, minWidth: 60, textAlign: "center" }}>
              {currentIndex >= 0 ? `${currentIndex + 1} of ${contactIds.length}` : "—"}
            </span>
            <button
              type="button"
              className="btn-ghost btn-sm"
              disabled={!nextId}
              onClick={() => nextId && router.push(`/dashboard/contacts/${nextId}`)}
              style={{ display: "flex", alignItems: "center", gap: 4 }}
              title="Next contact"
            >
              Next
              <Icon path="M5 12h14 M12 5l7 7-7 7" size={14} />
            </button>
          </div>
        )}
      </div>

      {/* Two-column layout */}
      <div style={{ display: "flex", gap: 28, alignItems: "flex-start" }}>

        {/* ===== LEFT SIDEBAR ===== */}
        <div style={{ width: 300, flexShrink: 0, position: "sticky", top: 24, display: "flex", flexDirection: "column", gap: 16 }}>

          {/* Profile card */}
          <div className="card" style={{ textAlign: "center", padding: "28px 20px 20px" }}>
            <div style={{
              width: 64, height: 64, borderRadius: "var(--radius-full)", margin: "0 auto 12px",
              background: isCompany ? "var(--accent-blue-light)" : "var(--accent-purple-light)",
              color: isCompany ? "var(--accent-blue)" : "var(--accent-purple)",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 22, fontWeight: 700, letterSpacing: "-0.02em",
            }}>
              {contact.name.slice(0, 2).toUpperCase()}
            </div>
            <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 6, lineHeight: 1.3 }}>{contact.name}</h2>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
              <span className={`badge badge-${isCompany ? "primary" : "accent"}`} style={{ textTransform: "capitalize" }}>
                {contact.contact_type}
              </span>
              <span className={`badge badge-${contact.status === "active" ? "success" : "neutral"}`} style={{ textTransform: "capitalize" }}>
                {contact.status}
              </span>
              {isCompany && contact.jurisdiction && <span className="badge badge-neutral">{contact.jurisdiction}</span>}
            </div>
            {contact.trade_license_no && (
              <div style={{ fontSize: 12, color: "var(--text-tertiary)", fontFamily: "monospace" }}>{contact.trade_license_no}</div>
            )}
          </div>

          {/* Quick stats */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
            {[
              { label: "Docs", value: contact.documents.length, tab: "documents" as const },
              { label: "Links", value: totalConnections, tab: "connections" as const },
              { label: "Addr", value: contact.addresses.length, tab: "addresses" as const },
            ].map((s) => (
              <button key={s.label} type="button" onClick={() => setActiveTab(s.tab)} style={{
                background: "var(--bg-secondary)", border: "1px solid var(--border-primary)", borderRadius: "var(--radius-lg)",
                padding: "12px 8px", textAlign: "center", cursor: "pointer", transition: "all var(--transition-fast)",
              }}
              onMouseEnter={(e) => { e.currentTarget.style.borderColor = "var(--border-hover)"; e.currentTarget.style.boxShadow = "var(--shadow-sm)"; }}
              onMouseLeave={(e) => { e.currentTarget.style.borderColor = "var(--border-primary)"; e.currentTarget.style.boxShadow = "none"; }}
              >
                <div style={{ fontSize: 20, fontWeight: 700, color: "var(--text-primary)", lineHeight: 1 }}>{s.value}</div>
                <div style={{ fontSize: 11, fontWeight: 600, color: "var(--text-tertiary)", textTransform: "uppercase", letterSpacing: "0.04em", marginTop: 4 }}>{s.label}</div>
              </button>
            ))}
          </div>

          {/* Sidebar sub-tabs */}
          <div style={{ display: "flex", gap: 0, borderRadius: "var(--radius-md)", overflow: "hidden", border: "1px solid var(--border-primary)" }}>
            {(["info", "activities"] as const).map((t) => (
              <button key={t} type="button" onClick={() => setSidebarTab(t)} style={{
                flex: 1, padding: "8px 0", fontSize: 12, fontWeight: 600, border: "none", cursor: "pointer",
                background: sidebarTab === t ? "var(--bg-secondary)" : "var(--bg-tertiary)",
                color: sidebarTab === t ? "var(--text-primary)" : "var(--text-tertiary)",
                borderBottom: sidebarTab === t ? "2px solid var(--brand-primary)" : "2px solid transparent",
              }}>
                {t === "info" ? "Contact Info" : "Activities"}
              </button>
            ))}
          </div>

          {sidebarTab === "info" && (<>
          {/* Contact info */}
          <div className="card" style={{ padding: "16px 16px 12px" }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: "var(--text-quaternary)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 8 }}>Contact Info</div>
            {renderInfoRow("M4 4h16c1.1 0 2 .9 2 2v12a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V6c0-1.1.9-2 2-2z M22 6l-10 7L2 6", "Email", contact.email)}
            {renderInfoRow("M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z", "Phone", contact.phone_primary)}
            {contact.phone_mobile && renderInfoRow("M17 2H7a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2z M12 18h.01", "Mobile", contact.phone_mobile)}
            {contact.phone_office && renderInfoRow("M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z", "Office", contact.phone_office)}
            {contact.website && renderInfoRow("M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20z M2 12h20", "Website", contact.website)}
          </div>

          {/* Key dates */}
          <div className="card" style={{ padding: "16px 16px 12px" }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: "var(--text-quaternary)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 10 }}>Key Dates</div>
            {expiryItems.filter((e) => e.date).length === 0 ? (
              <div style={{ fontSize: 13, color: "var(--text-quaternary)" }}>No dates recorded</div>
            ) : (
              expiryItems.filter((e) => e.date).map((item) => {
                const days = expiryDaysLeft(item.date);
                return (
                  <div key={item.label} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "6px 0", borderBottom: "1px solid var(--border-secondary)" }}>
                    <span style={{ fontSize: 13, color: "var(--text-secondary)" }}>{item.label}</span>
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <span style={{ fontSize: 12, fontFamily: "monospace", color: "var(--text-tertiary)" }}>{item.date!.slice(0, 10)}</span>
                      <span style={{ width: 8, height: 8, borderRadius: "var(--radius-full)", background: expiryColor(days), flexShrink: 0 }} title={days !== null ? `${days} days` : ""} />
                    </div>
                  </div>
                );
              })
            )}
            {isCompany && (nextVatDue(contact) || nextCtDue(contact)) && (
              <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 4 }}>
                {nextVatDue(contact) && (
                  <div style={{ fontSize: 12, color: "var(--text-secondary)" }}>
                    <strong>Next VAT:</strong> {nextVatDue(contact)}
                  </div>
                )}
                {nextCtDue(contact) && (
                  <div style={{ fontSize: 12, color: "var(--text-secondary)" }}>
                    <strong>Next CT:</strong> {nextCtDue(contact)}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Linked modules */}
          {linkedRecords && (
            (() => {
              const fromContact = `from_contact=${encodeURIComponent(id)}&from_contact_name=${encodeURIComponent(contact.name)}`;
              const modules: { key: string; label: string; icon: string; items: { id: string }[]; href: (id: string) => string; listHref: string }[] = [
                { key: "quotations", label: "Quotation", icon: "M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z M14 2v6h6 M16 13H8 M16 17H8 M10 9H8", items: linkedRecords.quotations, href: (rid) => `/dashboard/quotations/${rid}?${fromContact}`, listHref: `/dashboard/quotations?${fromContact}` },
                { key: "sales_orders", label: "Sales Order", icon: "M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2M9 5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2M9 5a2 2 0 0 0 2 2h2a2 2 0 0 0 2-2", items: linkedRecords.sales_orders, href: (rid) => `/dashboard/orders/${rid}?${fromContact}`, listHref: `/dashboard/orders?${fromContact}` },
                { key: "invoices", label: "Invoice", icon: "M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z M14 2v6h6 M12 18v-6 M8 18v-1 M16 18v-3", items: linkedRecords.invoices, href: (rid) => `/dashboard/invoices/${rid}?${fromContact}`, listHref: `/dashboard/invoices?${fromContact}` },
                { key: "projects", label: "Project", icon: "M3 7v10a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-6l-2-2H5a2 2 0 0 0-2 2z", items: linkedRecords.projects, href: (rid) => `/dashboard/projects/${rid}?${fromContact}`, listHref: `/dashboard/projects?${fromContact}` },
                { key: "opportunities", label: "Opportunity", icon: "M22 12h-4l-3 9L9 3l-3 9H2", items: linkedRecords.opportunities, href: (rid) => `/dashboard/crm?opportunity=${rid}&${fromContact}`, listHref: `/dashboard/crm?${fromContact}` },
              ];
              const active = modules.filter((m) => m.items.length > 0);
              if (active.length === 0) return null;
              return (
                <div className="card" style={{ padding: "16px 16px 12px" }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: "var(--text-quaternary)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 10 }}>Linked Records</div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    {active.map((m) => (
                      <a
                        key={m.key}
                        href={m.items.length === 1 ? m.href(m.items[0].id) : m.listHref}
                        style={{
                          display: "flex", alignItems: "center", gap: 8, background: "var(--bg-tertiary)",
                          border: "1px solid var(--border-primary)", borderRadius: "var(--radius-sm)",
                          padding: "7px 12px", fontSize: 12, fontWeight: 600, cursor: "pointer",
                          color: "var(--text-secondary)", textDecoration: "none", transition: "border-color var(--transition-fast)",
                        }}
                        onMouseEnter={(e) => e.currentTarget.style.borderColor = "var(--accent-blue)"}
                        onMouseLeave={(e) => e.currentTarget.style.borderColor = "var(--border-primary)"}
                      >
                        <Icon path={m.icon} size={14} />
                        <span style={{ flex: 1 }}>{m.label}{m.items.length > 1 ? "s" : ""}</span>
                        <span style={{ fontSize: 11, fontWeight: 700, background: "var(--bg-secondary)", color: "var(--text-tertiary)", borderRadius: "var(--radius-full)", padding: "1px 7px", lineHeight: "16px" }}>
                          {m.items.length}
                        </span>
                      </a>
                    ))}
                  </div>
                </div>
              );
            })()
          )}

          {/* Quick actions dropdown */}
          {(() => {
            const [open, setOpen] = [moreOpen, setMoreOpen];
            return (
              <div style={{ position: "relative" }}>
                <button type="button" className="btn-secondary btn-sm" style={{ width: "100%", justifyContent: "center" }} onClick={() => setOpen(!open)}>
                  <Icon path="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 1 1 0-2 1 1 0 0 1 0 2zm0 7a1 1 0 1 1 0-2 1 1 0 0 1 0 2zm0 7a1 1 0 1 1 0-2 1 1 0 0 1 0 2z" size={14} />
                  More Actions
                  <Icon path={open ? "M18 15l-6-6-6 6" : "M6 9l6 6 6-6"} size={12} />
                </button>
                {open && (
                  <>
                    <div onClick={() => setOpen(false)} style={{ position: "fixed", inset: 0, zIndex: 10 }} />
                    <div style={{ position: "absolute", top: "100%", left: 0, right: 0, marginTop: 4, background: "var(--bg-secondary)", border: "1px solid var(--border-primary)", borderRadius: "var(--radius-md)", boxShadow: "var(--shadow-lg)", zIndex: 20, padding: "4px 0" }}>
                      <button type="button" onClick={() => { setActiveTab("details"); setEditSection("basic"); setOpen(false); }} style={{ display: "flex", alignItems: "center", gap: 8, width: "100%", padding: "8px 14px", background: "none", border: "none", cursor: "pointer", fontSize: 13, color: "var(--text-primary)", textAlign: "left" }} onMouseEnter={(e) => e.currentTarget.style.background = "var(--bg-tertiary)"} onMouseLeave={(e) => e.currentTarget.style.background = "none"}>
                        <Icon path="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7 M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" size={14} /> Edit Details
                      </button>
                      {isCompany && (
                        <a href={`/dashboard/compliance/map?root=${id}`} onClick={() => setOpen(false)} style={{ display: "flex", alignItems: "center", gap: 8, width: "100%", padding: "8px 14px", background: "none", border: "none", cursor: "pointer", fontSize: 13, color: "var(--text-primary)", textDecoration: "none" }} onMouseEnter={(e) => e.currentTarget.style.background = "var(--bg-tertiary)"} onMouseLeave={(e) => e.currentTarget.style.background = "none"}>
                          <Icon path="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20z M2 12h20 M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" size={14} /> Ownership Map
                        </a>
                      )}
                      <button type="button" onClick={() => { setSidebarTab("activities"); setOpen(false); }} style={{ display: "flex", alignItems: "center", gap: 8, width: "100%", padding: "8px 14px", background: "none", border: "none", cursor: "pointer", fontSize: 13, color: "var(--text-primary)", textAlign: "left" }} onMouseEnter={(e) => e.currentTarget.style.background = "var(--bg-tertiary)"} onMouseLeave={(e) => e.currentTarget.style.background = "none"}>
                        <Icon path="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" size={14} /> View Activities
                      </button>
                    </div>
                  </>
                )}
              </div>
            );
          })()}
          </>)}

          {/* Activities sub-tab */}
          {sidebarTab === "activities" && (
            <div className="card" style={{ padding: "16px 16px 12px" }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: "var(--text-quaternary)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 10 }}>Recent Activities</div>
              {contactActivities.length === 0 ? (
                <div style={{ fontSize: 13, color: "var(--text-quaternary)", padding: "8px 0" }}>No activities found</div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
                  {contactActivities.map((act, i) => {
                    const typeIcons: Record<string, string> = { call: "M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6A19.79 19.79 0 0 1 2.12 4.11 2 2 0 0 1 4.11 2h3", meeting: "M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2 M9 7a4 4 0 1 0 0-8 4 4 0 0 0 0 8z M23 21v-2a4 4 0 0 0-3-3.87 M16 3.13a4 4 0 0 1 0 7.75", email: "M4 4h16c1.1 0 2 .9 2 2v12a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V6c0-1.1.9-2 2-2z M22 6l-10 7L2 6", task: "M9 11l3 3L22 4 M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" };
                    return (
                      <div key={act.id} style={{ display: "flex", gap: 10, padding: "8px 0", borderBottom: i < contactActivities.length - 1 ? "1px solid var(--border-secondary)" : "none" }}>
                        <div style={{ width: 28, height: 28, borderRadius: "var(--radius-sm)", background: act.status === "completed" ? "var(--success-light, #ecfdf5)" : "var(--bg-tertiary)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, color: act.status === "completed" ? "var(--success)" : "var(--text-tertiary)" }}>
                          <Icon path={typeIcons[act.activity_type] || typeIcons.task} size={13} />
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 13, fontWeight: 500, color: "var(--text-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{act.title}</div>
                          <div style={{ fontSize: 11, color: "var(--text-quaternary)" }}>
                            {act.start_datetime ? new Date(act.start_datetime).toLocaleDateString(undefined, { month: "short", day: "numeric" }) : "—"}
                            {" · "}
                            <span style={{ textTransform: "capitalize" }}>{act.activity_type}</span>
                            {act.status === "completed" && <span style={{ color: "var(--success)", marginLeft: 4 }}>✓</span>}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
              <a href="/dashboard/calendar" style={{ display: "block", textAlign: "center", fontSize: 12, fontWeight: 600, color: "var(--brand-primary)", marginTop: 10, textDecoration: "none" }}>View All Activities →</a>
            </div>
          )}
        </div>

        {/* ===== RIGHT MAIN AREA ===== */}
        <div style={{ flex: 1, minWidth: 0 }}>

          {/* Tab bar (underline style) */}
          <div className="tab-bar" style={{ marginBottom: 24 }}>
            {tabs.map((tab) => (
              <button
                key={tab.key}
                type="button"
                className={`tab-bar-btn${activeTab === tab.key ? " active" : ""}`}
                onClick={() => setActiveTab(tab.key)}
              >
                {tab.label}
                {tab.count !== undefined && tab.count > 0 && (
                  <span style={{ fontSize: 11, fontWeight: 700, background: activeTab === tab.key ? "var(--brand-primary)" : "var(--bg-tertiary)", color: activeTab === tab.key ? "var(--text-inverse)" : "var(--text-tertiary)", borderRadius: "var(--radius-full)", padding: "1px 7px", lineHeight: "16px" }}>
                    {tab.count}
                  </span>
                )}
              </button>
            ))}
          </div>

          {/* ===== DETAILS TAB (Read-only) ===== */}
          {activeTab === "details" && (() => {
            const Field = ({ label, value }: { label: string; value: string | number | null | undefined }) => (
              <div style={{ padding: "10px 0", borderBottom: "1px solid var(--border-secondary)" }}>
                <div className="meta-label" style={{ marginBottom: 4 }}>{label}</div>
                <div style={{ fontSize: 14, fontWeight: 500, color: value ? "var(--text-primary)" : "var(--text-quaternary)" }}>{value || "—"}</div>
              </div>
            );
            const SectionEditBtn = ({ section }: { section: "basic" | "company" | "tax" | "individual" | "notes" }) => (
              <button type="button" className="btn-ghost btn-sm" onClick={() => setEditSection(section)} style={{ fontSize: 12, padding: "4px 10px" }}>
                <Icon path="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7 M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" size={12} /> Edit
              </button>
            );
            return (
              <div>
                {/* Basic Information */}
                <div className="card" style={{ marginBottom: 16 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    {renderSectionHeader("basic", "Basic Information")}
                    <SectionEditBtn section="basic" />
                  </div>
                  {!collapsedSections.basic && (
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 24px" }}>
                      <Field label="Name" value={contact.name} />
                      <Field label="Email" value={contact.email} />
                      <Field label="Phone (primary)" value={contact.phone_primary} />
                      <Field label="Phone (mobile)" value={contact.phone_mobile} />
                      <Field label="Phone (office)" value={contact.phone_office} />
                      <Field label="Status" value={contact.status} />
                      <Field label="Country" value={contact.country} />
                    </div>
                  )}
                </div>

                {/* Company Details */}
                {isCompany && (
                  <div className="card" style={{ marginBottom: 16 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      {renderSectionHeader("company", "Company Details")}
                      <SectionEditBtn section="company" />
                    </div>
                    {!collapsedSections.company && (
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 24px" }}>
                        <Field label="Trade License No." value={contact.trade_license_no} />
                        <Field label="Jurisdiction" value={contact.jurisdiction} />
                        <Field label="Legal Form" value={contact.legal_form} />
                        <Field label="Tax Registration" value={contact.tax_registration_no} />
                        <Field label="License Issue" value={toDateStr(contact.license_issue_date)} />
                        <Field label="License Expiry" value={toDateStr(contact.license_expiry_date)} />
                        <Field label="Establishment Card Expiry" value={toDateStr(contact.establishment_card_expiry)} />
                        <Field label="Visa Expiry" value={toDateStr(contact.visa_expiry_date)} />
                        <Field label="Website" value={contact.website} />
                        <div style={{ gridColumn: "1 / -1", padding: "10px 0" }}>
                          <div className="meta-label" style={{ marginBottom: 4 }}>Licensed Activities</div>
                          <div style={{ fontSize: 14, color: contact.activity_license_activities ? "var(--text-primary)" : "var(--text-quaternary)", whiteSpace: "pre-wrap" }}>{contact.activity_license_activities || "—"}</div>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Tax Information */}
                {isCompany && (
                  <div className="card" style={{ marginBottom: 16 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      {renderSectionHeader("tax", "Tax Information")}
                      <SectionEditBtn section="tax" />
                    </div>
                    {!collapsedSections.tax && (
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 24px" }}>
                        <Field label="VAT Registered" value={contact.vat_registered ? "Yes" : "No"} />
                        <Field label="VAT Period Type" value={contact.vat_period_type} />
                        <Field label="VAT Period End Day" value={contact.vat_period_end_day} />
                        <Field label="First Period End Date" value={contact.vat_first_period_end_date?.slice(0, 10)} />
                        <Field label="Return Due (days)" value={contact.vat_return_due_days} />
                        <div style={{ gridColumn: "1 / -1", padding: "10px 0", borderBottom: "1px solid var(--border-secondary)" }}>
                          <div className="meta-label" style={{ marginBottom: 4 }}>VAT Notes</div>
                          <div style={{ fontSize: 14, color: contact.vat_notes ? "var(--text-primary)" : "var(--text-quaternary)" }}>{contact.vat_notes || "—"}</div>
                        </div>
                        <Field label="CT Registered" value={contact.ct_registered ? "Yes" : "No"} />
                        <Field label="CT Registration No." value={contact.ct_registration_no} />
                        <Field label="CT Period Type" value={contact.ct_period_type} />
                        <Field label="Financial Year Start Month" value={contact.ct_financial_year_start_month} />
                        <Field label="Financial Year Start Day" value={contact.ct_financial_year_start_day} />
                        <Field label="Filing Due (months)" value={contact.ct_filing_due_months} />
                        <div style={{ gridColumn: "1 / -1", padding: "10px 0" }}>
                          <div className="meta-label" style={{ marginBottom: 4 }}>CT Notes</div>
                          <div style={{ fontSize: 14, color: contact.ct_notes ? "var(--text-primary)" : "var(--text-quaternary)" }}>{contact.ct_notes || "—"}</div>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Individual Details */}
                {!isCompany && (
                  <div className="card" style={{ marginBottom: 16 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      {renderSectionHeader("individual", "Individual Details")}
                      <SectionEditBtn section="individual" />
                    </div>
                    {!collapsedSections.individual && (
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 24px" }}>
                        <Field label="First Name" value={contact.first_name} />
                        <Field label="Last Name" value={contact.last_name} />
                        <Field label="Passport No." value={contact.passport_no} />
                        <Field label="Passport Expiry" value={toDateStr(contact.passport_expiry)} />
                        <Field label="Nationality" value={contact.nationality} />
                        <Field label="Date of Birth" value={toDateStr(contact.date_of_birth)} />
                        <Field label="Visa Type" value={contact.visa_type} />
                        <Field label="Visa Expiry" value={toDateStr(contact.visa_expiry_date)} />
                        <Field label="Emirates ID" value={contact.emirates_id} />
                        <Field label="Emirates ID Expiry" value={toDateStr(contact.emirates_id_expiry)} />
                        <Field label="Gender" value={contact.gender} />
                        <Field label="Designation" value={contact.designation_title} />
                      </div>
                    )}
                  </div>
                )}

                {/* Notes */}
                <div className="card" style={{ marginBottom: 16 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                    <h3 style={{ fontSize: 16, fontWeight: 600, color: "var(--text-primary)", margin: 0 }}>Notes</h3>
                    <SectionEditBtn section="notes" />
                  </div>
                  <div style={{ fontSize: 14, color: contact.notes ? "var(--text-secondary)" : "var(--text-quaternary)", whiteSpace: "pre-wrap", lineHeight: 1.6 }}>{contact.notes || "No notes yet."}</div>
                </div>
              </div>
            );
          })()}

          {/* ===== DOCUMENTS TAB ===== */}
          {activeTab === "documents" && (
            <div>
              {/* Stat summary cards */}
              {(() => {
                const cats: Record<string, number> = {};
                contact.documents.forEach((d) => { const c = d.category || "other"; cats[c] = (cats[c] || 0) + 1; });
                return (
                  <div style={{ display: "grid", gridTemplateColumns: `repeat(${Math.min(Object.keys(cats).length + 1, 5)}, 1fr)`, gap: 10, marginBottom: 16 }}>
                    <div style={{ background: "var(--bg-secondary)", border: "1px solid var(--border-primary)", borderRadius: "var(--radius-lg)", padding: "14px 12px", textAlign: "center" }}>
                      <div style={{ fontSize: 22, fontWeight: 700, color: "var(--text-primary)", lineHeight: 1 }}>{contact.documents.length}</div>
                      <div style={{ fontSize: 11, fontWeight: 600, color: "var(--text-tertiary)", textTransform: "uppercase", letterSpacing: "0.04em", marginTop: 4 }}>Total</div>
                    </div>
                    {Object.entries(cats).map(([cat, count]) => (
                      <div key={cat} style={{ background: "var(--bg-secondary)", border: "1px solid var(--border-primary)", borderRadius: "var(--radius-lg)", padding: "14px 12px", textAlign: "center" }}>
                        <div style={{ fontSize: 22, fontWeight: 700, color: "var(--text-primary)", lineHeight: 1 }}>{count}</div>
                        <div style={{ fontSize: 11, fontWeight: 600, color: "var(--text-tertiary)", textTransform: "capitalize", letterSpacing: "0.04em", marginTop: 4 }}>{cat.replace("_", " ")}</div>
                      </div>
                    ))}
                  </div>
                );
              })()}
            <div className="card">
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
                <h3 style={{ fontSize: 16, fontWeight: 600, color: "var(--text-primary)" }}>Documents</h3>
              </div>
              <div style={{ marginBottom: 20, display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center", padding: "16px", background: "var(--bg-tertiary)", borderRadius: "var(--radius-lg)", border: "1px solid var(--border-primary)" }}>
                <div style={{ flex: "0 0 auto" }}>
                  <label style={{ fontSize: 13, fontWeight: 500, marginBottom: 4, display: "block", color: "var(--text-secondary)" }}>Category</label>
                  <select value={uploadCategory} onChange={(e) => setUploadCategory(e.target.value)} style={{ width: 180 }}>
                    <option value="trade_license">Trade license</option>
                    <option value="moa">MOA</option>
                    <option value="passport">Passport</option>
                    <option value="visa">Visa</option>
                    <option value="other">Other</option>
                  </select>
                </div>
                <div style={{ flex: "0 0 auto" }}>
                  <label style={{ fontSize: 13, fontWeight: 500, marginBottom: 4, display: "block", color: "var(--text-secondary)" }}>File</label>
                  <label style={{ cursor: "pointer" }}>
                    <span className="btn-primary" style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
                      {uploading ? (<><div className="loading-spinner" style={{ width: 14, height: 14 }}></div> Uploading...</>) : (<><Icon path="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4 M17 8l-5-5-5 5 M12 3v12" size={16} /> Choose File</>)}
                    </span>
                    <input type="file" style={{ display: "none" }} onChange={handleUpload} disabled={uploading} />
                  </label>
                </div>
              </div>
              {uploadError && (
                <div className="alert alert-danger" style={{ marginBottom: 20 }}>
                  <Icon path="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z M12 9v4 M12 17h.01" size={18} />
                  {uploadError}
                </div>
              )}
              {contact.documents.length === 0 ? (
                <div className="empty-state" style={{ padding: 40 }}>
                  <div className="empty-state-icon"><Icon path="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z M14 2v6h6 M16 13H8 M16 17H8 M10 9H8" size={40} /></div>
                  <div className="empty-state-description">No documents uploaded yet</div>
                </div>
              ) : (
                <div>
                  {contact.documents.map((d, index) => (
                    <div key={d.id} style={{ padding: "14px 0", borderBottom: index < contact.documents.length - 1 ? "1px solid var(--border-secondary)" : "none", display: "flex", justifyContent: "space-between", alignItems: "center", transition: "background var(--transition-fast)", borderRadius: "var(--radius-md)", marginLeft: -12, marginRight: -12, paddingLeft: 12, paddingRight: 12 }} onMouseEnter={(e) => e.currentTarget.style.background = "var(--bg-tertiary)"} onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}>
                      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                        <div style={{ width: 36, height: 36, borderRadius: "var(--radius-md)", background: "var(--bg-tertiary)", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text-tertiary)" }}>
                          <Icon path="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z M14 2v6h6 M16 13H8 M16 17H8 M10 9H8" size={18} />
                        </div>
                        <div>
                          <div style={{ fontSize: 14, fontWeight: 500, color: "var(--text-primary)", marginBottom: 2 }}>{d.file_name}</div>
                          <div style={{ fontSize: 12, color: "var(--text-tertiary)" }}>
                            <span className="badge badge-neutral" style={{ textTransform: "capitalize", fontSize: 11 }}>{d.category.replace("_", " ")}</span>
                            {d.file_size && <span style={{ marginLeft: 8 }}>{d.file_size}</span>}
                          </div>
                        </div>
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <button type="button" className="btn-secondary btn-sm" onClick={() => viewDoc(d.id, d.file_name)} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                          <Icon path="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z M12 8a3 3 0 1 0 0 6 3 3 0 0 0 0-6z" size={14} /> View
                        </button>
                        <button type="button" className="btn-ghost btn-sm" onClick={() => downloadDoc(d.id, d.file_name)} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                          <Icon path="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4 M7 10l5 5 5-5 M12 15V3" size={14} /> Download
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
            </div>
          )}

          {/* ===== ADDRESSES TAB ===== */}
          {activeTab === "addresses" && (
            <div className="card">
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
                <h3 style={{ fontSize: 16, fontWeight: 600, color: "var(--text-primary)" }}>Addresses</h3>
                <button type="button" className="btn-secondary btn-sm" onClick={() => setNewAddrOpen(true)}>
                  <Icon path="M12 5v14 M5 12h14" size={16} /> Add Address
                </button>
              </div>
              {contact.addresses.length === 0 && (
                <div className="empty-state" style={{ padding: 40 }}>
                  <div className="empty-state-icon"><Icon path="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z M12 13a3 3 0 1 0 0-6 3 3 0 0 0 0 6z" size={40} /></div>
                  <div className="empty-state-description">No addresses yet</div>
                </div>
              )}
              {contact.addresses.map((addr, index) => (
                <div key={addr.id} style={{ padding: "16px 0", borderBottom: index < contact.addresses.length - 1 ? "1px solid var(--border-secondary)" : "none" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 12 }}>
                    <div style={{ fontSize: 14, flex: 1, minWidth: 200 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8, flexWrap: "wrap" }}>
                        <Icon path="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z M12 13a3 3 0 1 0 0-6 3 3 0 0 0 0 6z" size={16} />
                        <span style={{ fontWeight: 600, textTransform: "capitalize", color: "var(--text-primary)" }}>{addr.address_type.replace("_", " ")}</span>
                        {addr.is_primary && <span className="badge badge-success badge-dot" style={{ fontSize: 11 }}>Primary</span>}
                      </div>
                      <p style={{ color: "var(--text-secondary)", lineHeight: 1.6 }}>
                        {addr.address_line_1}{addr.address_line_2 && `, ${addr.address_line_2}`}
                        {(addr.city || addr.state_emirate) && (<><br/>{[addr.city, addr.state_emirate].filter(Boolean).join(", ")}</>)}
                        {addr.postal_code && ` ${addr.postal_code}`}{addr.country && `, ${addr.country}`}
                      </p>
                      {addr.notes && <p style={{ fontSize: 12, color: "var(--text-tertiary)", marginTop: 8, fontStyle: "italic" }}>{addr.notes}</p>}
                    </div>
                    <div style={{ display: "flex", gap: 8 }}>
                      <button type="button" className="btn-ghost btn-sm" onClick={() => {
                        setEditAddr({ address_type: addr.address_type, address_line_1: addr.address_line_1, address_line_2: addr.address_line_2 || "", city: addr.city || "", state_emirate: addr.state_emirate || "", postal_code: addr.postal_code || "", country: addr.country || "", is_primary: addr.is_primary ?? false, notes: addr.notes || "" });
                        setEditingAddrId(addr.id);
                      }}>
                        <Icon path="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7 M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" size={14} /> Edit
                      </button>
                      <button type="button" className="btn-ghost btn-sm" style={{ color: "var(--danger)" }} onClick={() => deleteAddress(addr.id)}>
                        <Icon path="M3 6h18 M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" size={14} /> Delete
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* ===== CONNECTIONS TAB ===== */}
          {activeTab === "connections" && (
            <div>
              {/* Stat summary cards */}
              {linkData && (() => {
                const allLinks = [...linkData.outgoing, ...linkData.incoming];
                const companyCount = new Set(allLinks.filter(l => l.other_contact_type === "company").map(l => l.other_contact_id)).size;
                const individualCount = new Set(allLinks.filter(l => l.other_contact_type === "individual").map(l => l.other_contact_id)).size;
                const ownershipCount = allLinks.filter(l => l.link_type === "ownership").length;
                return (
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, marginBottom: 16 }}>
                    <div style={{ background: "var(--bg-secondary)", border: "1px solid var(--border-primary)", borderRadius: "var(--radius-lg)", padding: "14px 12px", textAlign: "center" }}>
                      <div style={{ fontSize: 22, fontWeight: 700, color: "var(--text-primary)", lineHeight: 1 }}>{companyCount}</div>
                      <div style={{ fontSize: 11, fontWeight: 600, color: "var(--text-tertiary)", textTransform: "uppercase", letterSpacing: "0.04em", marginTop: 4 }}>Companies</div>
                    </div>
                    <div style={{ background: "var(--bg-secondary)", border: "1px solid var(--border-primary)", borderRadius: "var(--radius-lg)", padding: "14px 12px", textAlign: "center" }}>
                      <div style={{ fontSize: 22, fontWeight: 700, color: "var(--text-primary)", lineHeight: 1 }}>{individualCount}</div>
                      <div style={{ fontSize: 11, fontWeight: 600, color: "var(--text-tertiary)", textTransform: "uppercase", letterSpacing: "0.04em", marginTop: 4 }}>Individuals</div>
                    </div>
                    <div style={{ background: "var(--bg-secondary)", border: "1px solid var(--border-primary)", borderRadius: "var(--radius-lg)", padding: "14px 12px", textAlign: "center" }}>
                      <div style={{ fontSize: 22, fontWeight: 700, color: "var(--text-primary)", lineHeight: 1 }}>{ownershipCount}</div>
                      <div style={{ fontSize: 11, fontWeight: 600, color: "var(--text-tertiary)", textTransform: "uppercase", letterSpacing: "0.04em", marginTop: 4 }}>Ownership</div>
                    </div>
                  </div>
                );
              })()}
            <div className="card">
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
                <h3 style={{ fontSize: 16, fontWeight: 600, color: "var(--text-primary)" }}>Connections</h3>
                <button type="button" className="btn-secondary btn-sm" onClick={openAddLinkForm}>
                  <Icon path="M12 5v14 M5 12h14" size={16} /> Add connection
                </button>
              </div>
              {linkData === null ? (
                <div style={{ padding: 24, color: "var(--text-tertiary)", fontSize: 14 }}>Unable to load connections.</div>
              ) : (
                <>
                  {(() => {
                    const allLinks = [...linkData.outgoing, ...linkData.incoming];
                    const uniqueIds = new Set(allLinks.map(l => l.other_contact_id));
                    const companies = new Set(allLinks.filter(l => l.other_contact_type === "company").map(l => l.other_contact_id)).size;
                    const individuals = new Set(allLinks.filter(l => l.other_contact_type === "individual").map(l => l.other_contact_id)).size;
                    if (uniqueIds.size === 0) return null;
                    return (
                      <p style={{ fontSize: 14, color: "var(--text-secondary)", marginBottom: 20, padding: "10px 14px", background: "var(--bg-secondary)", borderRadius: 8 }}>
                        Linked to <strong>{companies}</strong> {companies === 1 ? "company" : "companies"} and <strong>{individuals}</strong> {individuals === 1 ? "individual" : "individuals"}
                      </p>
                    );
                  })()}
                  <div style={{ marginBottom: 24 }}>
                    <h4 style={{ fontSize: 14, fontWeight: 600, color: "var(--text-secondary)", marginBottom: 12, textTransform: "uppercase", letterSpacing: "0.04em" }}>
                      Where {contact.name} is connected
                    </h4>
                    {linkData.outgoing.length === 0 ? (
                      <p style={{ fontSize: 14, color: "var(--text-tertiary)", margin: 0 }}>No outgoing links.</p>
                    ) : (
                      <>
                        <p style={{ fontSize: 13, color: "var(--text-tertiary)", marginBottom: 12 }}>
                          Linked to {linkData.outgoing.filter((l) => l.other_contact_type === "company").length} companies and {linkData.outgoing.filter((l) => l.other_contact_type === "individual").length} individuals.
                        </p>
                        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 12 }}>
                          {linkData.outgoing.map((item) => (
                            <div key={item.link_id} style={{ background: "var(--bg-primary)", border: "1px solid var(--border-primary)", borderRadius: 12, padding: "16px", display: "flex", flexDirection: "column", gap: 12, transition: "box-shadow 0.15s ease, border-color 0.15s ease" }} onMouseEnter={(e) => { e.currentTarget.style.boxShadow = "0 2px 8px rgba(0,0,0,0.08)"; e.currentTarget.style.borderColor = "var(--accent-blue)"; }} onMouseLeave={(e) => { e.currentTarget.style.boxShadow = "none"; e.currentTarget.style.borderColor = "var(--border-primary)"; }}>
                              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                                  <div style={{ width: 36, height: 36, borderRadius: 8, background: item.other_contact_type === "company" ? "var(--accent-blue-light)" : "var(--accent-purple-light)", display: "flex", alignItems: "center", justifyContent: "center", color: item.other_contact_type === "company" ? "var(--accent-blue)" : "var(--accent-purple)" }}>
                                    {item.other_contact_type === "company" ? <Icon path="M3 21h18 M9 8h1 M9 12h1 M9 16h1 M14 8h1 M14 12h1 M14 16h1 M5 21V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16" size={16} /> : <Icon path="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2 M12 3a4 4 0 1 0 0 8 4 4 0 0 0 0-8z" size={16} />}
                                  </div>
                                  <div>
                                    <a href={`/dashboard/contacts/${item.other_contact_id}`} style={{ fontWeight: 600, fontSize: 14, color: "var(--text-primary)", textDecoration: "none", display: "block" }}>{item.other_contact_name}</a>
                                    <span style={{ fontSize: 12, color: "var(--text-tertiary)", textTransform: "capitalize" }}>{item.other_contact_type}</span>
                                  </div>
                                </div>
                                <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                                  <button type="button" className="btn-ghost btn-sm" onClick={() => openEditLinkForm(item.link_id, item.other_contact_name)} aria-label="Edit"><Icon path="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7 M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" size={14} /></button>
                                  <button type="button" className="btn-ghost btn-sm" style={{ color: "var(--danger)" }} onClick={() => deleteLink(item.link_id)} aria-label="Delete"><Icon path="M3 6h18 M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" size={14} /></button>
                                </div>
                              </div>
                              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                <span className="badge badge-neutral" style={{ textTransform: "capitalize" }}>{linkItemLabel(item)}</span>
                                {item.percentage != null && item.link_type === "ownership" && (
                                  <div style={{ flex: 1, height: 6, borderRadius: 3, background: "var(--bg-secondary)", overflow: "hidden" }}>
                                    <div style={{ width: `${Math.min(item.percentage, 100)}%`, height: "100%", borderRadius: 3, background: "var(--accent-blue)" }} />
                                  </div>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      </>
                    )}
                  </div>
                  <div>
                    <h4 style={{ fontSize: 14, fontWeight: 600, color: "var(--text-secondary)", marginBottom: 12, textTransform: "uppercase", letterSpacing: "0.04em" }}>
                      Who is connected to {contact.name}
                    </h4>
                    {linkData.incoming.length === 0 ? (
                      <p style={{ fontSize: 14, color: "var(--text-tertiary)", margin: 0 }}>No incoming links.</p>
                    ) : (
                      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 12 }}>
                        {linkData.incoming.map((item) => (
                          <div key={item.link_id} style={{ background: "var(--bg-primary)", border: "1px solid var(--border-primary)", borderRadius: 12, padding: "16px", display: "flex", flexDirection: "column", gap: 12, transition: "box-shadow 0.15s ease, border-color 0.15s ease" }} onMouseEnter={(e) => { e.currentTarget.style.boxShadow = "0 2px 8px rgba(0,0,0,0.08)"; e.currentTarget.style.borderColor = "var(--accent-blue)"; }} onMouseLeave={(e) => { e.currentTarget.style.boxShadow = "none"; e.currentTarget.style.borderColor = "var(--border-primary)"; }}>
                            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                                <div style={{ width: 36, height: 36, borderRadius: 8, background: item.other_contact_type === "company" ? "var(--accent-blue-light)" : "var(--accent-purple-light)", display: "flex", alignItems: "center", justifyContent: "center", color: item.other_contact_type === "company" ? "var(--accent-blue)" : "var(--accent-purple)" }}>
                                  {item.other_contact_type === "company" ? <Icon path="M3 21h18 M9 8h1 M9 12h1 M9 16h1 M14 8h1 M14 12h1 M14 16h1 M5 21V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16" size={16} /> : <Icon path="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2 M12 3a4 4 0 1 0 0 8 4 4 0 0 0 0-8z" size={16} />}
                                </div>
                                <div>
                                  <a href={`/dashboard/contacts/${item.other_contact_id}`} style={{ fontWeight: 600, fontSize: 14, color: "var(--text-primary)", textDecoration: "none", display: "block" }}>{item.other_contact_name}</a>
                                  <span style={{ fontSize: 12, color: "var(--text-tertiary)", textTransform: "capitalize" }}>{item.other_contact_type}</span>
                                </div>
                              </div>
                              <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                                <button type="button" className="btn-ghost btn-sm" onClick={() => openEditLinkForm(item.link_id, item.other_contact_name)} aria-label="Edit"><Icon path="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7 M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" size={14} /></button>
                                <button type="button" className="btn-ghost btn-sm" style={{ color: "var(--danger)" }} onClick={() => deleteLink(item.link_id)} aria-label="Delete"><Icon path="M3 6h18 M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" size={14} /></button>
                              </div>
                            </div>
                            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                              <span className="badge badge-neutral" style={{ textTransform: "capitalize" }}>{linkItemLabel(item)}</span>
                              {item.percentage != null && item.link_type === "ownership" && (
                                <div style={{ flex: 1, height: 6, borderRadius: 3, background: "var(--bg-secondary)", overflow: "hidden" }}>
                                  <div style={{ width: `${Math.min(item.percentage, 100)}%`, height: "100%", borderRadius: 3, background: "var(--accent-blue)" }} />
                                </div>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
            </div>
          )}

        </div>{/* end right main area */}
      </div>{/* end two-column layout */}

      {/* ═══════ Connection Form SlideOverPanel ═══════ */}
      <SlideOverPanel open={linkFormOpen} onClose={closeLinkForm} title={linkFormMode === "add" ? "Add Connection" : "Edit Connection"} subtitle={linkFormMode === "edit" ? `Editing link to: ${linkFormOtherName}` : "Create a new ownership or relationship link"}>
        <form onSubmit={submitLinkForm} style={{ display: "flex", flexDirection: "column", height: "100%" }}>
          <div style={{ flex: 1, padding: "16px 0", display: "flex", flexDirection: "column", gap: 14 }}>
            {linkFormError && <div className="alert alert-danger">{linkFormError}</div>}
            {linkFormMode === "add" && (
              <>
                <FormField label="Direction">
                  <select value={linkForm.thisContactIsOwner ? "owner" : "owned"} onChange={(e) => setLinkForm((f) => ({ ...f, thisContactIsOwner: e.target.value === "owner" }))} style={{ margin: 0 }}>
                    <option value="owner">This contact is the owner (subject)</option>
                    <option value="owned">This contact is the owned (object)</option>
                  </select>
                </FormField>
                <FormField label="Other Contact" required>
                  <select value={linkForm.other_contact_id} onChange={(e) => setLinkForm((f) => ({ ...f, other_contact_id: e.target.value }))} required style={{ margin: 0 }}>
                    <option value="">Select contact</option>
                    {linkFormFilteredContacts().map((c) => (<option key={c.id} value={c.id}>{c.name} ({c.contact_type})</option>))}
                  </select>
                </FormField>
              </>
            )}
            {linkFormMode === "edit" && linkForm.other_contact_id && (
              <p style={{ fontSize: 14, color: "var(--text-secondary)" }}>Link to: <strong>{linkFormOtherName || linkForm.other_contact_id}</strong></p>
            )}
            <FormField label="Link Type">
              <select value={linkForm.link_type} onChange={(e) => setLinkForm((f) => ({ ...f, link_type: e.target.value }))} style={{ margin: 0 }}>
                {LINK_TYPES.map((t) => (<option key={t} value={t}>{t}</option>))}
              </select>
            </FormField>
            {(linkForm.link_type === "ownership" || linkForm.link_type === "control") && (
              <>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                  <FormField label="Percentage (%)"><input type="number" min={0} max={100} step={0.01} value={linkForm.percentage ?? ""} onChange={(e) => setLinkForm((f) => ({ ...f, percentage: e.target.value === "" ? null : parseFloat(e.target.value) }))} placeholder="e.g. 50" style={{ margin: 0 }} /></FormField>
                  <FormField label="Voting %"><input type="number" min={0} max={100} step={0.01} value={linkForm.voting_pct ?? ""} onChange={(e) => setLinkForm((f) => ({ ...f, voting_pct: e.target.value === "" ? null : parseFloat(e.target.value) }))} placeholder="Optional" style={{ margin: 0 }} /></FormField>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                  <FormField label="Number of Shares"><input type="number" min={0} value={linkForm.number_of_shares ?? ""} onChange={(e) => setLinkForm((f) => ({ ...f, number_of_shares: e.target.value === "" ? null : parseFloat(e.target.value) }))} placeholder="Optional" style={{ margin: 0 }} /></FormField>
                  <FormField label="Share Class"><input value={linkForm.share_class} onChange={(e) => setLinkForm((f) => ({ ...f, share_class: e.target.value }))} placeholder="e.g. ordinary" style={{ margin: 0 }} /></FormField>
                  <FormField label="Nominal Value/Share"><input type="number" min={0} step={0.01} value={linkForm.nominal_value_per_share ?? ""} onChange={(e) => setLinkForm((f) => ({ ...f, nominal_value_per_share: e.target.value === "" ? null : parseFloat(e.target.value) }))} placeholder="Optional" style={{ margin: 0 }} /></FormField>
                  <FormField label="Share Currency"><input value={linkForm.share_currency} onChange={(e) => setLinkForm((f) => ({ ...f, share_currency: e.target.value }))} placeholder="e.g. AED" style={{ margin: 0 }} /></FormField>
                </div>
              </>
            )}
            {(linkForm.link_type === "director" || linkForm.link_type === "manages" || linkForm.link_type === "employee") && (
              <FormField label="Role / Title"><input value={linkForm.role_label} onChange={(e) => setLinkForm((f) => ({ ...f, role_label: e.target.value }))} placeholder="e.g. Managing Director" style={{ margin: 0 }} /></FormField>
            )}
            {linkForm.link_type === "director" && (
              <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
                <input type="checkbox" checked={linkForm.is_nominee} onChange={(e) => setLinkForm((f) => ({ ...f, is_nominee: e.target.checked }))} />
                <span style={{ fontSize: 13 }}>Nominee director</span>
              </label>
            )}
            {linkForm.link_type === "family" && (
              <FormField label="Relationship" required>
                <select value={linkForm.relationship_kind} onChange={(e) => setLinkForm((f) => ({ ...f, relationship_kind: e.target.value }))} required style={{ margin: 0 }}>
                  <option value="">Select</option>
                  {FAMILY_KINDS.map((k) => (<option key={k} value={k}>{k}</option>))}
                </select>
              </FormField>
            )}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <FormField label="Start Date"><input type="date" value={linkForm.start_date} onChange={(e) => setLinkForm((f) => ({ ...f, start_date: e.target.value }))} style={{ margin: 0 }} /></FormField>
              <FormField label="End Date"><input type="date" value={linkForm.end_date} onChange={(e) => setLinkForm((f) => ({ ...f, end_date: e.target.value }))} style={{ margin: 0 }} /></FormField>
            </div>
          </div>
          <div style={{ display: "flex", gap: 12, paddingTop: 16, borderTop: "1px solid var(--border-primary)" }}>
            <button type="submit" className="btn-primary" style={{ flex: 1 }} disabled={linkFormSaving}>
              {linkFormSaving ? "Saving..." : (linkFormMode === "add" ? "Add Connection" : "Save Changes")}
            </button>
            <button type="button" className="btn-ghost" onClick={closeLinkForm}>Cancel</button>
          </div>
        </form>
      </SlideOverPanel>

      {/* ═══════ Section Edit SlideOverPanel ═══════ */}
      <SlideOverPanel open={!!editSection} onClose={() => { setEditSection(null); load(); }} title={editSection === "basic" ? "Edit Basic Info" : editSection === "company" ? "Edit Company Details" : editSection === "tax" ? "Edit Tax Info" : editSection === "individual" ? "Edit Individual Details" : editSection === "notes" ? "Edit Notes" : "Edit"} subtitle={contact.name}>
        <form onSubmit={handleSaveContact} style={{ display: "flex", flexDirection: "column", height: "100%" }}>
          <div style={{ flex: 1, padding: "16px 0", overflowY: "auto", display: "flex", flexDirection: "column", gap: 14 }}>

            {editSection === "basic" && (<>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <FormField label="Name" required><input type="text" value={contact.name} onChange={(e) => setContact((c) => c ? { ...c, name: e.target.value } : null)} required style={{ margin: 0 }} /></FormField>
                <FormField label="Email"><input type="email" value={contact.email || ""} onChange={(e) => setContact((c) => c ? { ...c, email: e.target.value || null } : null)} style={{ margin: 0 }} /></FormField>
                <FormField label="Phone (primary)"><input value={contact.phone_primary || ""} onChange={(e) => setContact((c) => c ? { ...c, phone_primary: e.target.value || null } : null)} style={{ margin: 0 }} /></FormField>
                <FormField label="Phone (mobile)"><input value={contact.phone_mobile || ""} onChange={(e) => setContact((c) => c ? { ...c, phone_mobile: e.target.value || null } : null)} style={{ margin: 0 }} /></FormField>
                <FormField label="Phone (office)"><input value={contact.phone_office || ""} onChange={(e) => setContact((c) => c ? { ...c, phone_office: e.target.value || null } : null)} style={{ margin: 0 }} /></FormField>
                <FormField label="Status">
                  <select value={contact.status} onChange={(e) => setContact((c) => c ? { ...c, status: e.target.value } : null)} style={{ margin: 0 }}>
                    <option value="active">Active</option><option value="expired">Expired</option><option value="under_renewal">Under Renewal</option><option value="cancelled">Cancelled</option>
                  </select>
                </FormField>
                <FormField label="Country"><input value={contact.country || ""} onChange={(e) => setContact((c) => c ? { ...c, country: e.target.value || null } : null)} style={{ margin: 0 }} /></FormField>
              </div>
            </>)}

            {editSection === "company" && (<>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <FormField label="Trade License No."><input value={contact.trade_license_no || ""} onChange={(e) => setContact((c) => c ? { ...c, trade_license_no: e.target.value || null } : null)} style={{ margin: 0 }} /></FormField>
                <FormField label="Jurisdiction">
                  <select value={contact.jurisdiction || ""} onChange={(e) => setContact((c) => c ? { ...c, jurisdiction: e.target.value || null } : null)} style={{ margin: 0 }}>
                    {JURISDICTIONS.map((j) => <option key={j || "x"} value={j}>{j || "Select"}</option>)}
                  </select>
                </FormField>
                <FormField label="Legal Form"><input value={contact.legal_form || ""} onChange={(e) => setContact((c) => c ? { ...c, legal_form: e.target.value || null } : null)} style={{ margin: 0 }} /></FormField>
                <FormField label="Tax Registration"><input value={contact.tax_registration_no || ""} onChange={(e) => setContact((c) => c ? { ...c, tax_registration_no: e.target.value || null } : null)} style={{ margin: 0 }} /></FormField>
                <FormField label="License Issue"><input type="date" value={toDateStr(contact.license_issue_date)} onChange={(e) => setContact((c) => c ? { ...c, license_issue_date: e.target.value || null } : null)} style={{ margin: 0 }} /></FormField>
                <FormField label="License Expiry"><input type="date" value={toDateStr(contact.license_expiry_date)} onChange={(e) => setContact((c) => c ? { ...c, license_expiry_date: e.target.value || null } : null)} style={{ margin: 0 }} /></FormField>
                <FormField label="Establishment Card Expiry"><input type="date" value={toDateStr(contact.establishment_card_expiry)} onChange={(e) => setContact((c) => c ? { ...c, establishment_card_expiry: e.target.value || null } : null)} style={{ margin: 0 }} /></FormField>
                <FormField label="Visa Expiry"><input type="date" value={toDateStr(contact.visa_expiry_date)} onChange={(e) => setContact((c) => c ? { ...c, visa_expiry_date: e.target.value || null } : null)} style={{ margin: 0 }} /></FormField>
              </div>
              <FormField label="Website"><input value={contact.website || ""} onChange={(e) => setContact((c) => c ? { ...c, website: e.target.value || null } : null)} style={{ margin: 0 }} /></FormField>
              <FormField label="Licensed Activities"><textarea value={contact.activity_license_activities || ""} onChange={(e) => setContact((c) => c ? { ...c, activity_license_activities: e.target.value || null } : null)} rows={2} style={{ margin: 0 }} /></FormField>
            </>)}

            {editSection === "tax" && (<>
              <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", padding: "10px 14px", background: "var(--bg-tertiary)", borderRadius: "var(--radius-md)" }}>
                <input type="checkbox" checked={contact.vat_registered ?? false} onChange={(e) => setContact((c) => c ? { ...c, vat_registered: e.target.checked } : null)} />
                <span style={{ fontWeight: 600, fontSize: 13 }}>VAT Registered</span>
              </label>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <FormField label="VAT Period Type">
                  <select value={contact.vat_period_type || ""} onChange={(e) => setContact((c) => c ? { ...c, vat_period_type: e.target.value || null } : null)} style={{ margin: 0 }}>
                    <option value="">—</option><option value="monthly">Monthly</option><option value="quarterly">Quarterly</option>
                  </select>
                </FormField>
                <FormField label="VAT Period End Day"><input type="number" min={1} max={31} value={contact.vat_period_end_day ?? ""} onChange={(e) => setContact((c) => c ? { ...c, vat_period_end_day: e.target.value ? parseInt(e.target.value, 10) : null } : null)} style={{ margin: 0 }} /></FormField>
                <FormField label="First Period End"><input type="date" value={contact.vat_first_period_end_date ? contact.vat_first_period_end_date.slice(0, 10) : ""} onChange={(e) => setContact((c) => c ? { ...c, vat_first_period_end_date: e.target.value || null } : null)} style={{ margin: 0 }} /></FormField>
                <FormField label="Return Due (days)"><input type="number" min={1} value={contact.vat_return_due_days ?? ""} onChange={(e) => setContact((c) => c ? { ...c, vat_return_due_days: e.target.value ? parseInt(e.target.value, 10) : null } : null)} style={{ margin: 0 }} /></FormField>
              </div>
              <FormField label="VAT Notes"><textarea value={contact.vat_notes || ""} onChange={(e) => setContact((c) => c ? { ...c, vat_notes: e.target.value || null } : null)} rows={2} style={{ margin: 0 }} /></FormField>
              <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", padding: "10px 14px", background: "var(--bg-tertiary)", borderRadius: "var(--radius-md)" }}>
                <input type="checkbox" checked={contact.ct_registered ?? false} onChange={(e) => setContact((c) => c ? { ...c, ct_registered: e.target.checked } : null)} />
                <span style={{ fontWeight: 600, fontSize: 13 }}>CT Registered (Corporate Tax)</span>
              </label>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <FormField label="CT Registration No."><input value={contact.ct_registration_no || ""} onChange={(e) => setContact((c) => c ? { ...c, ct_registration_no: e.target.value || null } : null)} style={{ margin: 0 }} /></FormField>
                <FormField label="CT Period Type">
                  <select value={contact.ct_period_type || ""} onChange={(e) => setContact((c) => c ? { ...c, ct_period_type: e.target.value || null } : null)} style={{ margin: 0 }}>
                    <option value="">—</option><option value="calendar_year">Calendar year</option><option value="fiscal_year">Fiscal year</option>
                  </select>
                </FormField>
                <FormField label="FY Start Month"><input type="number" min={1} max={12} value={contact.ct_financial_year_start_month ?? ""} onChange={(e) => setContact((c) => c ? { ...c, ct_financial_year_start_month: e.target.value ? parseInt(e.target.value, 10) : null } : null)} style={{ margin: 0 }} /></FormField>
                <FormField label="FY Start Day"><input type="number" min={1} max={31} value={contact.ct_financial_year_start_day ?? ""} onChange={(e) => setContact((c) => c ? { ...c, ct_financial_year_start_day: e.target.value ? parseInt(e.target.value, 10) : null } : null)} style={{ margin: 0 }} /></FormField>
                <FormField label="Filing Due (months)"><input type="number" min={1} value={contact.ct_filing_due_months ?? ""} onChange={(e) => setContact((c) => c ? { ...c, ct_filing_due_months: e.target.value ? parseInt(e.target.value, 10) : null } : null)} style={{ margin: 0 }} /></FormField>
              </div>
              <FormField label="CT Notes"><textarea value={contact.ct_notes || ""} onChange={(e) => setContact((c) => c ? { ...c, ct_notes: e.target.value || null } : null)} rows={2} style={{ margin: 0 }} /></FormField>
            </>)}

            {editSection === "individual" && (<>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <FormField label="First Name"><input value={contact.first_name || ""} onChange={(e) => setContact((c) => c ? { ...c, first_name: e.target.value || null } : null)} style={{ margin: 0 }} /></FormField>
                <FormField label="Last Name"><input value={contact.last_name || ""} onChange={(e) => setContact((c) => c ? { ...c, last_name: e.target.value || null } : null)} style={{ margin: 0 }} /></FormField>
                <FormField label="Passport No."><input value={contact.passport_no || ""} onChange={(e) => setContact((c) => c ? { ...c, passport_no: e.target.value || null } : null)} style={{ margin: 0 }} /></FormField>
                <FormField label="Passport Expiry"><input type="date" value={toDateStr(contact.passport_expiry)} onChange={(e) => setContact((c) => c ? { ...c, passport_expiry: e.target.value || null } : null)} style={{ margin: 0 }} /></FormField>
                <FormField label="Nationality"><input value={contact.nationality || ""} onChange={(e) => setContact((c) => c ? { ...c, nationality: e.target.value || null } : null)} style={{ margin: 0 }} /></FormField>
                <FormField label="Date of Birth"><input type="date" value={toDateStr(contact.date_of_birth)} onChange={(e) => setContact((c) => c ? { ...c, date_of_birth: e.target.value || null } : null)} style={{ margin: 0 }} /></FormField>
                <FormField label="Visa Type"><input value={contact.visa_type || ""} onChange={(e) => setContact((c) => c ? { ...c, visa_type: e.target.value || null } : null)} style={{ margin: 0 }} /></FormField>
                <FormField label="Visa Expiry"><input type="date" value={toDateStr(contact.visa_expiry_date)} onChange={(e) => setContact((c) => c ? { ...c, visa_expiry_date: e.target.value || null } : null)} style={{ margin: 0 }} /></FormField>
                <FormField label="Emirates ID"><input value={contact.emirates_id || ""} onChange={(e) => setContact((c) => c ? { ...c, emirates_id: e.target.value || null } : null)} style={{ margin: 0 }} /></FormField>
                <FormField label="Emirates ID Expiry"><input type="date" value={toDateStr(contact.emirates_id_expiry)} onChange={(e) => setContact((c) => c ? { ...c, emirates_id_expiry: e.target.value || null } : null)} style={{ margin: 0 }} /></FormField>
                <FormField label="Gender">
                  <select value={contact.gender || ""} onChange={(e) => setContact((c) => c ? { ...c, gender: e.target.value || null } : null)} style={{ margin: 0 }}>
                    <option value="">—</option><option value="male">Male</option><option value="female">Female</option><option value="other">Other</option>
                  </select>
                </FormField>
                <FormField label="Designation"><input value={contact.designation_title || ""} onChange={(e) => setContact((c) => c ? { ...c, designation_title: e.target.value || null } : null)} style={{ margin: 0 }} /></FormField>
              </div>
            </>)}

            {editSection === "notes" && (
              <FormField label="Notes"><textarea value={contact.notes || ""} onChange={(e) => setContact((c) => c ? { ...c, notes: e.target.value || null } : null)} rows={6} style={{ margin: 0 }} /></FormField>
            )}

          </div>
          <div style={{ display: "flex", gap: 12, paddingTop: 16, borderTop: "1px solid var(--border-primary)" }}>
            <button type="submit" className="btn-primary" style={{ flex: 1 }} disabled={saving}>
              {saving ? "Saving..." : "Save Changes"}
            </button>
            <button type="button" className="btn-ghost" onClick={() => { setEditSection(null); load(); }}>Cancel</button>
          </div>
        </form>
      </SlideOverPanel>

      {/* ═══════ Add Address SlideOverPanel ═══════ */}
      <SlideOverPanel open={newAddrOpen} onClose={() => setNewAddrOpen(false)} title="Add Address" subtitle="Add a new address for this contact">
        <form onSubmit={addAddress} style={{ display: "flex", flexDirection: "column", height: "100%" }}>
          <div style={{ flex: 1, padding: "16px 0", display: "flex", flexDirection: "column", gap: 14 }}>
            <FormField label="Address Type">
              <select value={newAddr.address_type} onChange={(e) => setNewAddr({ ...newAddr, address_type: e.target.value })} style={{ margin: 0 }}>
                {ADDRESS_TYPES.map((t) => <option key={t} value={t}>{t.replace("_", " ")}</option>)}
              </select>
            </FormField>
            <FormField label="Address Line 1" required>
              <input type="text" value={newAddr.address_line_1} onChange={(e) => setNewAddr({ ...newAddr, address_line_1: e.target.value })} required placeholder="Street address" style={{ margin: 0 }} />
            </FormField>
            <FormField label="Address Line 2">
              <input type="text" value={newAddr.address_line_2} onChange={(e) => setNewAddr({ ...newAddr, address_line_2: e.target.value })} placeholder="Suite, floor, etc." style={{ margin: 0 }} />
            </FormField>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <FormField label="City"><input type="text" value={newAddr.city} onChange={(e) => setNewAddr({ ...newAddr, city: e.target.value })} style={{ margin: 0 }} /></FormField>
              <FormField label="Emirate / State"><input type="text" value={newAddr.state_emirate} onChange={(e) => setNewAddr({ ...newAddr, state_emirate: e.target.value })} style={{ margin: 0 }} /></FormField>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <FormField label="Postal Code"><input type="text" value={newAddr.postal_code} onChange={(e) => setNewAddr({ ...newAddr, postal_code: e.target.value })} style={{ margin: 0 }} /></FormField>
              <FormField label="Country"><input type="text" value={newAddr.country} onChange={(e) => setNewAddr({ ...newAddr, country: e.target.value })} style={{ margin: 0 }} /></FormField>
            </div>
            <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
              <input type="checkbox" checked={newAddr.is_primary} onChange={(e) => setNewAddr({ ...newAddr, is_primary: e.target.checked })} />
              <span style={{ fontSize: 13, fontWeight: 600 }}>Primary address</span>
            </label>
            <FormField label="Notes">
              <textarea rows={2} value={newAddr.notes} onChange={(e) => setNewAddr({ ...newAddr, notes: e.target.value })} placeholder="Optional notes" style={{ margin: 0 }} />
            </FormField>
          </div>
          <div style={{ display: "flex", gap: 12, paddingTop: 16, borderTop: "1px solid var(--border-primary)" }}>
            <button type="submit" className="btn-primary" style={{ flex: 1 }} disabled={addingAddr}>
              {addingAddr ? "Adding..." : "Add Address"}
            </button>
            <button type="button" className="btn-ghost" onClick={() => setNewAddrOpen(false)}>Cancel</button>
          </div>
        </form>
      </SlideOverPanel>

      {/* ═══════ Edit Address SlideOverPanel ═══════ */}
      <SlideOverPanel open={!!editingAddrId} onClose={() => setEditingAddrId(null)} title="Edit Address" subtitle={editAddr.address_type.replace("_", " ")}>
        <form onSubmit={(e) => { e.preventDefault(); if (editingAddrId) updateAddress(editingAddrId, { address_type: editAddr.address_type, address_line_1: editAddr.address_line_1, address_line_2: editAddr.address_line_2 || null, city: editAddr.city || null, state_emirate: editAddr.state_emirate || null, postal_code: editAddr.postal_code || null, country: editAddr.country || null, is_primary: editAddr.is_primary, notes: editAddr.notes || null }); }} style={{ display: "flex", flexDirection: "column", height: "100%" }}>
          <div style={{ flex: 1, padding: "16px 0", overflowY: "auto", display: "flex", flexDirection: "column", gap: 14 }}>
            <FormField label="Address Type">
              <select value={editAddr.address_type} onChange={(e) => setEditAddr({ ...editAddr, address_type: e.target.value })} style={{ margin: 0 }}>
                {ADDRESS_TYPES.map((t) => <option key={t} value={t}>{t.replace("_", " ")}</option>)}
              </select>
            </FormField>
            <FormField label="Address Line 1" required>
              <input type="text" value={editAddr.address_line_1} onChange={(e) => setEditAddr({ ...editAddr, address_line_1: e.target.value })} required style={{ margin: 0 }} />
            </FormField>
            <FormField label="Address Line 2">
              <input type="text" value={editAddr.address_line_2} onChange={(e) => setEditAddr({ ...editAddr, address_line_2: e.target.value })} placeholder="Suite, floor, etc." style={{ margin: 0 }} />
            </FormField>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <FormField label="City"><input type="text" value={editAddr.city} onChange={(e) => setEditAddr({ ...editAddr, city: e.target.value })} style={{ margin: 0 }} /></FormField>
              <FormField label="Emirate / State"><input type="text" value={editAddr.state_emirate} onChange={(e) => setEditAddr({ ...editAddr, state_emirate: e.target.value })} style={{ margin: 0 }} /></FormField>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <FormField label="Postal Code"><input type="text" value={editAddr.postal_code} onChange={(e) => setEditAddr({ ...editAddr, postal_code: e.target.value })} style={{ margin: 0 }} /></FormField>
              <FormField label="Country"><input type="text" value={editAddr.country} onChange={(e) => setEditAddr({ ...editAddr, country: e.target.value })} style={{ margin: 0 }} /></FormField>
            </div>
            <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
              <input type="checkbox" checked={editAddr.is_primary} onChange={(e) => setEditAddr({ ...editAddr, is_primary: e.target.checked })} />
              <span style={{ fontSize: 13, fontWeight: 600 }}>Primary address</span>
            </label>
            <FormField label="Notes">
              <textarea rows={2} value={editAddr.notes} onChange={(e) => setEditAddr({ ...editAddr, notes: e.target.value })} placeholder="Optional notes" style={{ margin: 0 }} />
            </FormField>
          </div>
          <div style={{ display: "flex", gap: 12, paddingTop: 16, borderTop: "1px solid var(--border-primary)" }}>
            <button type="submit" className="btn-primary" style={{ flex: 1 }}>Save Address</button>
            <button type="button" className="btn-ghost" onClick={() => setEditingAddrId(null)}>Cancel</button>
          </div>
        </form>
      </SlideOverPanel>
    </div>
  );
}
