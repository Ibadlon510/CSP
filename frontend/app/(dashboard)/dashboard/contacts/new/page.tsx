"use client";

import { useState } from "react";
import { api } from "@/lib/api";
import { useToast } from "@/components/Toast";
import { Icon } from "@/components/ui/Icon";

const JURISDICTIONS = ["", "DED Mainland", "DMCC", "ADGM", "DIFC", "RAK ICC", "JAFZA", "Other"];
const ADDRESS_TYPES = ["registered_office", "mailing", "branch", "billing", "residential", "other"];

export default function NewContactPage() {
  const [contactType, setContactType] = useState<"company" | "individual">("company");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phonePrimary, setPhonePrimary] = useState("");
  const [phoneMobile, setPhoneMobile] = useState("");
  const [phoneOffice, setPhoneOffice] = useState("");
  const [status, setStatus] = useState("active");
  const [notes, setNotes] = useState("");
  const [country, setCountry] = useState("UAE");
  // Company
  const [tradeLicenseNo, setTradeLicenseNo] = useState("");
  const [jurisdiction, setJurisdiction] = useState("");
  const [legalForm, setLegalForm] = useState("");
  const [licenseIssueDate, setLicenseIssueDate] = useState("");
  const [licenseExpiryDate, setLicenseExpiryDate] = useState("");
  const [establishmentCardExpiry, setEstablishmentCardExpiry] = useState("");
  const [visaExpiryDate, setVisaExpiryDate] = useState("");
  const [taxRegNo, setTaxRegNo] = useState("");
  const [website, setWebsite] = useState("");
  const [activityLicense, setActivityLicense] = useState("");
  // Tax (VAT / CT – company)
  const [vatRegistered, setVatRegistered] = useState(false);
  const [vatPeriodType, setVatPeriodType] = useState("");
  const [vatPeriodEndDay, setVatPeriodEndDay] = useState("");
  const [vatFirstPeriodEndDate, setVatFirstPeriodEndDate] = useState("");
  const [vatReturnDueDays, setVatReturnDueDays] = useState("");
  const [vatNotes, setVatNotes] = useState("");
  const [ctRegistered, setCtRegistered] = useState(false);
  const [ctRegistrationNo, setCtRegistrationNo] = useState("");
  const [ctPeriodType, setCtPeriodType] = useState("");
  const [ctFinancialYearStartMonth, setCtFinancialYearStartMonth] = useState("");
  const [ctFinancialYearStartDay, setCtFinancialYearStartDay] = useState("");
  const [ctFilingDueMonths, setCtFilingDueMonths] = useState("");
  const [ctNotes, setCtNotes] = useState("");
  // Individual
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [passportNo, setPassportNo] = useState("");
  const [passportExpiry, setPassportExpiry] = useState("");
  const [nationality, setNationality] = useState("");
  const [dateOfBirth, setDateOfBirth] = useState("");
  const [visaType, setVisaType] = useState("");
  const [emiratesId, setEmiratesId] = useState("");
  const [emiratesIdExpiry, setEmiratesIdExpiry] = useState("");
  const [gender, setGender] = useState("");
  const [designationTitle, setDesignationTitle] = useState("");
  // Addresses
  const [addresses, setAddresses] = useState<{ address_type: string; address_line_1: string; address_line_2: string; city: string; state_emirate: string; postal_code: string; country: string; is_primary: boolean; notes: string }[]>([
    { address_type: "registered_office", address_line_1: "", address_line_2: "", city: "", state_emirate: "", postal_code: "", country: "UAE", is_primary: false, notes: "" },
  ]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const toast = useToast();

  function addAddress() {
    setAddresses((a) => [...a, { address_type: "other", address_line_1: "", address_line_2: "", city: "", state_emirate: "", postal_code: "", country: "UAE", is_primary: false, notes: "" }]);
  }

  function removeAddress(i: number) {
    setAddresses((a) => a.filter((_, idx) => idx !== i));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const body: Record<string, unknown> = {
        contact_type: contactType,
        name,
        email: email || null,
        phone_primary: phonePrimary || null,
        phone_mobile: phoneMobile || null,
        phone_office: phoneOffice || null,
        status,
        notes: notes || null,
        country: country || null,
        addresses: addresses.filter((a) => a.address_line_1.trim()).map((a) => ({
          address_type: a.address_type,
          address_line_1: a.address_line_1,
          address_line_2: a.address_line_2 || null,
          city: a.city || null,
          state_emirate: a.state_emirate || null,
          postal_code: a.postal_code || null,
          country: a.country || null,
          is_primary: a.is_primary,
          notes: a.notes || null,
        })),
      };
      if (contactType === "company") {
        (body as any).trade_license_no = tradeLicenseNo || null;
        (body as any).jurisdiction = jurisdiction || null;
        (body as any).legal_form = legalForm || null;
        (body as any).license_issue_date = licenseIssueDate || null;
        (body as any).license_expiry_date = licenseExpiryDate || null;
        (body as any).establishment_card_expiry = establishmentCardExpiry || null;
        (body as any).visa_expiry_date = visaExpiryDate || null;
        (body as any).tax_registration_no = taxRegNo || null;
        (body as any).website = website || null;
        (body as any).activity_license_activities = activityLicense || null;
        (body as any).vat_registered = vatRegistered;
        (body as any).vat_period_type = vatPeriodType || null;
        (body as any).vat_period_end_day = vatPeriodEndDay ? parseInt(vatPeriodEndDay, 10) : null;
        (body as any).vat_first_period_end_date = vatFirstPeriodEndDate || null;
        (body as any).vat_return_due_days = vatReturnDueDays ? parseInt(vatReturnDueDays, 10) : null;
        (body as any).vat_notes = vatNotes || null;
        (body as any).ct_registered = ctRegistered;
        (body as any).ct_registration_no = ctRegistrationNo || null;
        (body as any).ct_period_type = ctPeriodType || null;
        (body as any).ct_financial_year_start_month = ctFinancialYearStartMonth ? parseInt(ctFinancialYearStartMonth, 10) : null;
        (body as any).ct_financial_year_start_day = ctFinancialYearStartDay ? parseInt(ctFinancialYearStartDay, 10) : null;
        (body as any).ct_filing_due_months = ctFilingDueMonths ? parseInt(ctFilingDueMonths, 10) : null;
        (body as any).ct_notes = ctNotes || null;
      } else {
        (body as any).first_name = firstName || null;
        (body as any).last_name = lastName || null;
        (body as any).passport_no = passportNo || null;
        (body as any).passport_expiry = passportExpiry || null;
        (body as any).nationality = nationality || null;
        (body as any).date_of_birth = dateOfBirth || null;
        (body as any).visa_type = visaType || null;
        (body as any).emirates_id = emiratesId || null;
        (body as any).emirates_id_expiry = emiratesIdExpiry || null;
        (body as any).gender = gender || null;
        (body as any).designation_title = designationTitle || null;
        (body as any).visa_expiry_date = visaExpiryDate || null;
      }
      await api.post("/api/contacts/", body);
      toast.success("Contact created successfully");
      window.location.href = "/dashboard/contacts";
    } catch (err: any) {
      const msg = err.message || "Failed to create contact";
      setError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <div className="page-header">
        <div className="page-header-content">
          <a
            href="/dashboard/contacts"
            style={{
              fontSize: 14,
              color: "var(--text-tertiary)",
              textDecoration: "none",
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              marginBottom: 12,
              fontWeight: 500,
              transition: "color var(--transition-fast)",
            }}
          >
            <Icon path="M19 12H5 M12 19l-7-7 7-7" size={16} />
            Back to Contacts
          </a>
          <h1 className="page-title">New Contact</h1>
          <p className="page-subtitle">Add a company or individual</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="card" style={{ maxWidth: 720 }}>
        <h3 style={{ fontSize: 18, fontWeight: 600, color: "var(--text-primary)", marginBottom: 16 }}>Contact type</h3>
        <div style={{ display: "flex", gap: 24, marginBottom: 24, flexWrap: "wrap" }}>
          <label
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              cursor: "pointer",
              padding: "12px 16px",
              background: contactType === "company" ? "var(--bg-tertiary)" : "transparent",
              border: "1px solid var(--border-primary)",
              borderRadius: "var(--radius-md)",
              transition: "all var(--transition-fast)",
              flex: "1 1 140px",
            }}
          >
            <input type="radio" name="contactType" checked={contactType === "company"} onChange={() => setContactType("company")} style={{ width: 18, height: 18 }} />
            <span style={{ fontWeight: 500 }}>Company</span>
          </label>
          <label
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              cursor: "pointer",
              padding: "12px 16px",
              background: contactType === "individual" ? "var(--bg-tertiary)" : "transparent",
              border: "1px solid var(--border-primary)",
              borderRadius: "var(--radius-md)",
              transition: "all var(--transition-fast)",
              flex: "1 1 140px",
            }}
          >
            <input type="radio" name="contactType" checked={contactType === "individual"} onChange={() => setContactType("individual")} style={{ width: 18, height: 18 }} />
            <span style={{ fontWeight: 500 }}>Individual</span>
          </label>
        </div>

        <div className="divider" />
        <h3 style={{ fontSize: 18, fontWeight: 600, color: "var(--text-primary)", marginBottom: 16 }}>Common</h3>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 24 }}>
          <div>
            <label>Name *</label>
            <input value={name} onChange={(e) => setName(e.target.value)} required placeholder={contactType === "company" ? "Company legal name" : "Full name"} />
          </div>
          <div>
            <label>Email</label>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Primary email" />
          </div>
          <div>
            <label style={{ display: "block", marginBottom: 4, fontSize: 13, fontWeight: 500 }}>Phone (primary)</label>
            <input value={phonePrimary} onChange={(e) => setPhonePrimary(e.target.value)} placeholder="+971 ..." />
          </div>
          <div>
            <label style={{ display: "block", marginBottom: 4, fontSize: 13, fontWeight: 500 }}>Phone (mobile)</label>
            <input value={phoneMobile} onChange={(e) => setPhoneMobile(e.target.value)} />
          </div>
          <div>
            <label style={{ display: "block", marginBottom: 4, fontSize: 13, fontWeight: 500 }}>Phone (office)</label>
            <input value={phoneOffice} onChange={(e) => setPhoneOffice(e.target.value)} />
          </div>
          <div>
            <label style={{ display: "block", marginBottom: 4, fontSize: 13, fontWeight: 500 }}>Country</label>
            <input value={country} onChange={(e) => setCountry(e.target.value)} />
          </div>
        </div>
        <div style={{ marginBottom: 24 }}>
          <label style={{ display: "block", marginBottom: 4, fontSize: 13, fontWeight: 500 }}>Notes</label>
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} placeholder="Optional" />
        </div>

        {contactType === "company" && (
          <>
            <div className="divider" />
        <h3 style={{ fontSize: 18, fontWeight: 600, color: "var(--text-primary)", marginBottom: 16 }}>Company</h3>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 24 }}>
              <div><label style={{ display: "block", marginBottom: 4, fontSize: 13, fontWeight: 500 }}>Trade license no.</label><input value={tradeLicenseNo} onChange={(e) => setTradeLicenseNo(e.target.value)} /></div>
              <div><label style={{ display: "block", marginBottom: 4, fontSize: 13, fontWeight: 500 }}>Jurisdiction</label><select value={jurisdiction} onChange={(e) => setJurisdiction(e.target.value)}>{JURISDICTIONS.map((j) => <option key={j || "x"} value={j}>{j || "Select"}</option>)}</select></div>
              <div><label style={{ display: "block", marginBottom: 4, fontSize: 13, fontWeight: 500 }}>Legal form</label><input value={legalForm} onChange={(e) => setLegalForm(e.target.value)} placeholder="LLC, FZCO, etc." /></div>
              <div><label style={{ display: "block", marginBottom: 4, fontSize: 13, fontWeight: 500 }}>Tax registration (VAT TRN)</label><input value={taxRegNo} onChange={(e) => setTaxRegNo(e.target.value)} /></div>
              <div><label style={{ display: "block", marginBottom: 4, fontSize: 13, fontWeight: 500 }}>License issue date</label><input type="date" value={licenseIssueDate} onChange={(e) => setLicenseIssueDate(e.target.value)} /></div>
              <div><label style={{ display: "block", marginBottom: 4, fontSize: 13, fontWeight: 500 }}>License expiry date</label><input type="date" value={licenseExpiryDate} onChange={(e) => setLicenseExpiryDate(e.target.value)} /></div>
              <div><label style={{ display: "block", marginBottom: 4, fontSize: 13, fontWeight: 500 }}>Establishment card expiry</label><input type="date" value={establishmentCardExpiry} onChange={(e) => setEstablishmentCardExpiry(e.target.value)} /></div>
              <div><label style={{ display: "block", marginBottom: 4, fontSize: 13, fontWeight: 500 }}>Visa expiry date</label><input type="date" value={visaExpiryDate} onChange={(e) => setVisaExpiryDate(e.target.value)} /></div>
              <div style={{ gridColumn: "1 / -1" }}><label style={{ display: "block", marginBottom: 4, fontSize: 13, fontWeight: 500 }}>Website</label><input value={website} onChange={(e) => setWebsite(e.target.value)} placeholder="https://" /></div>
              <div style={{ gridColumn: "1 / -1" }}><label style={{ display: "block", marginBottom: 4, fontSize: 13, fontWeight: 500 }}>Licensed activities</label><textarea value={activityLicense} onChange={(e) => setActivityLicense(e.target.value)} rows={2} /></div>
            </div>

            <div className="divider" />
            <h3 style={{ fontSize: 18, fontWeight: 600, color: "var(--text-primary)", marginBottom: 16 }}>Tax information</h3>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 24 }}>
              <div style={{ gridColumn: "1 / -1" }}>
                <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
                  <input type="checkbox" checked={vatRegistered} onChange={(e) => setVatRegistered(e.target.checked)} />
                  <span>VAT registered</span>
                </label>
              </div>
              <div><label style={{ display: "block", marginBottom: 4, fontSize: 13, fontWeight: 500 }}>VAT period type</label><select value={vatPeriodType} onChange={(e) => setVatPeriodType(e.target.value)}><option value="">—</option><option value="monthly">Monthly</option><option value="quarterly">Quarterly</option></select></div>
              <div><label style={{ display: "block", marginBottom: 4, fontSize: 13, fontWeight: 500 }}>VAT period end day (1–31)</label><input type="number" min={1} max={31} value={vatPeriodEndDay} onChange={(e) => setVatPeriodEndDay(e.target.value)} placeholder="e.g. 31" /></div>
              <div><label style={{ display: "block", marginBottom: 4, fontSize: 13, fontWeight: 500 }}>First period end date</label><input type="date" value={vatFirstPeriodEndDate} onChange={(e) => setVatFirstPeriodEndDate(e.target.value)} /></div>
              <div><label style={{ display: "block", marginBottom: 4, fontSize: 13, fontWeight: 500 }}>Return due (days after period end)</label><input type="number" min={1} value={vatReturnDueDays} onChange={(e) => setVatReturnDueDays(e.target.value)} placeholder="e.g. 28" /></div>
              <div style={{ gridColumn: "1 / -1" }}><label style={{ display: "block", marginBottom: 4, fontSize: 13, fontWeight: 500 }}>VAT notes</label><textarea value={vatNotes} onChange={(e) => setVatNotes(e.target.value)} rows={2} placeholder="Optional" /></div>
              <div style={{ gridColumn: "1 / -1" }}>
                <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
                  <input type="checkbox" checked={ctRegistered} onChange={(e) => setCtRegistered(e.target.checked)} />
                  <span>CT registered (Corporate Tax)</span>
                </label>
              </div>
              <div><label style={{ display: "block", marginBottom: 4, fontSize: 13, fontWeight: 500 }}>CT registration no.</label><input value={ctRegistrationNo} onChange={(e) => setCtRegistrationNo(e.target.value)} /></div>
              <div><label style={{ display: "block", marginBottom: 4, fontSize: 13, fontWeight: 500 }}>CT period type</label><select value={ctPeriodType} onChange={(e) => setCtPeriodType(e.target.value)}><option value="">—</option><option value="calendar_year">Calendar year</option><option value="fiscal_year">Fiscal year</option></select></div>
              <div><label style={{ display: "block", marginBottom: 4, fontSize: 13, fontWeight: 500 }}>Financial year start month (1–12)</label><input type="number" min={1} max={12} value={ctFinancialYearStartMonth} onChange={(e) => setCtFinancialYearStartMonth(e.target.value)} placeholder="e.g. 4" /></div>
              <div><label style={{ display: "block", marginBottom: 4, fontSize: 13, fontWeight: 500 }}>Financial year start day (1–31)</label><input type="number" min={1} max={31} value={ctFinancialYearStartDay} onChange={(e) => setCtFinancialYearStartDay(e.target.value)} placeholder="e.g. 1" /></div>
              <div><label style={{ display: "block", marginBottom: 4, fontSize: 13, fontWeight: 500 }}>Filing due (months after period end)</label><input type="number" min={1} value={ctFilingDueMonths} onChange={(e) => setCtFilingDueMonths(e.target.value)} placeholder="e.g. 9" /></div>
              <div style={{ gridColumn: "1 / -1" }}><label style={{ display: "block", marginBottom: 4, fontSize: 13, fontWeight: 500 }}>CT notes</label><textarea value={ctNotes} onChange={(e) => setCtNotes(e.target.value)} rows={2} placeholder="Optional" /></div>
            </div>
          </>
        )}

        {contactType === "individual" && (
          <>
            <div className="divider" />
            <h3 style={{ fontSize: 18, fontWeight: 600, color: "var(--text-primary)", marginBottom: 16 }}>Individual</h3>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 24 }}>
              <div><label style={{ display: "block", marginBottom: 4, fontSize: 13, fontWeight: 500 }}>First name</label><input value={firstName} onChange={(e) => setFirstName(e.target.value)} /></div>
              <div><label style={{ display: "block", marginBottom: 4, fontSize: 13, fontWeight: 500 }}>Last name</label><input value={lastName} onChange={(e) => setLastName(e.target.value)} /></div>
              <div><label style={{ display: "block", marginBottom: 4, fontSize: 13, fontWeight: 500 }}>Passport no.</label><input value={passportNo} onChange={(e) => setPassportNo(e.target.value)} /></div>
              <div><label style={{ display: "block", marginBottom: 4, fontSize: 13, fontWeight: 500 }}>Passport expiry</label><input type="date" value={passportExpiry} onChange={(e) => setPassportExpiry(e.target.value)} /></div>
              <div><label style={{ display: "block", marginBottom: 4, fontSize: 13, fontWeight: 500 }}>Nationality</label><input value={nationality} onChange={(e) => setNationality(e.target.value)} /></div>
              <div><label style={{ display: "block", marginBottom: 4, fontSize: 13, fontWeight: 500 }}>Date of birth</label><input type="date" value={dateOfBirth} onChange={(e) => setDateOfBirth(e.target.value)} /></div>
              <div><label style={{ display: "block", marginBottom: 4, fontSize: 13, fontWeight: 500 }}>Visa type</label><input value={visaType} onChange={(e) => setVisaType(e.target.value)} placeholder="Employment, Golden, etc." /></div>
              <div><label style={{ display: "block", marginBottom: 4, fontSize: 13, fontWeight: 500 }}>Visa expiry date</label><input type="date" value={visaExpiryDate} onChange={(e) => setVisaExpiryDate(e.target.value)} /></div>
              <div><label style={{ display: "block", marginBottom: 4, fontSize: 13, fontWeight: 500 }}>Emirates ID</label><input value={emiratesId} onChange={(e) => setEmiratesId(e.target.value)} /></div>
              <div><label style={{ display: "block", marginBottom: 4, fontSize: 13, fontWeight: 500 }}>Emirates ID expiry</label><input type="date" value={emiratesIdExpiry} onChange={(e) => setEmiratesIdExpiry(e.target.value)} /></div>
              <div><label style={{ display: "block", marginBottom: 4, fontSize: 13, fontWeight: 500 }}>Gender</label><select value={gender} onChange={(e) => setGender(e.target.value)}><option value="">—</option><option value="male">Male</option><option value="female">Female</option><option value="other">Other</option></select></div>
              <div><label style={{ display: "block", marginBottom: 4, fontSize: 13, fontWeight: 500 }}>Designation</label><input value={designationTitle} onChange={(e) => setDesignationTitle(e.target.value)} placeholder="Director, Partner, etc." /></div>
            </div>
          </>
        )}

        <div className="divider" />
        <h3 style={{ fontSize: 18, fontWeight: 600, color: "var(--text-primary)", marginBottom: 16 }}>Addresses</h3>
        {addresses.map((addr, i) => (
          <div key={i} className="card" style={{ background: "var(--bg-tertiary)", marginBottom: 16, padding: 16, border: "1px solid var(--border-primary)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <select value={addr.address_type} onChange={(e) => setAddresses((a) => a.map((x, j) => (j === i ? { ...x, address_type: e.target.value } : x)))} style={{ width: 180 }}>
                {ADDRESS_TYPES.map((t) => <option key={t} value={t}>{t.replace("_", " ")}</option>)}
              </select>
              {addresses.length > 1 && <button type="button" className="btn-ghost btn-sm" onClick={() => removeAddress(i)}>Remove</button>}
            </div>
            <input placeholder="Address line 1 *" value={addr.address_line_1} onChange={(e) => setAddresses((a) => a.map((x, j) => (j === i ? { ...x, address_line_1: e.target.value } : x)))} style={{ marginBottom: 8 }} />
            <input placeholder="Address line 2" value={addr.address_line_2} onChange={(e) => setAddresses((a) => a.map((x, j) => (j === i ? { ...x, address_line_2: e.target.value } : x)))} style={{ marginBottom: 8 }} />
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginBottom: 8 }}>
              <input placeholder="City" value={addr.city} onChange={(e) => setAddresses((a) => a.map((x, j) => (j === i ? { ...x, city: e.target.value } : x)))} />
              <input placeholder="Emirate" value={addr.state_emirate} onChange={(e) => setAddresses((a) => a.map((x, j) => (j === i ? { ...x, state_emirate: e.target.value } : x)))} />
              <input placeholder="Postal code" value={addr.postal_code} onChange={(e) => setAddresses((a) => a.map((x, j) => (j === i ? { ...x, postal_code: e.target.value } : x)))} />
            </div>
            <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", marginBottom: 8 }}>
              <input type="checkbox" checked={addr.is_primary} onChange={(e) => setAddresses((a) => a.map((x, j) => (j === i ? { ...x, is_primary: e.target.checked } : x)))} />
              <span>Primary address</span>
            </label>
            <textarea placeholder="Address notes (optional)" value={addr.notes} onChange={(e) => setAddresses((a) => a.map((x, j) => (j === i ? { ...x, notes: e.target.value } : x)))} rows={2} />
          </div>
        ))}
        <button type="button" className="btn-secondary btn-sm" onClick={addAddress} style={{ marginBottom: 24 }}>
          <Icon path="M12 5v14 M5 12h14" size={14} />
          Add another address
        </button>

        {error && (
          <div className="alert alert-danger" style={{ marginBottom: 20 }}>
            <Icon path="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z M12 9v4 M12 17h.01" size={18} />
            {error}
          </div>
        )}
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
          <button type="submit" className="btn-primary" disabled={loading}>
            {loading ? (
              <>
                <div className="loading-spinner" style={{ width: 16, height: 16 }}></div>
                Creating...
              </>
            ) : (
              <>
                <Icon path="M22 11.08V12a10 10 0 1 1-5.93-9.14 M22 4L12 14.01l-3-3" size={16} />
                Create contact
              </>
            )}
          </button>
          <a href="/dashboard/contacts" className="btn-ghost">Cancel</a>
        </div>
      </form>
    </div>
  );
}
