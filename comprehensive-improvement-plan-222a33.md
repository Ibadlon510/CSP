# Comprehensive Improvement Plan

Incremental UX/UI improvement plan based on user-reported findings. Updated as new findings are shared.

---

## Finding 1: Simplify Contact Creation Flow

**Problem:** Clicking "New Contact" navigates to a full-page form (`/dashboard/contacts/new/page.tsx`) with 50+ fields. After save, user is redirected to the contacts list — not the newly created profile.

**Desired behavior:**
1. "New Contact" opens a **SlideOverPanel** (already exists as a reusable component) with only the minimal required fields
2. On save, **navigate to the newly created contact's profile page** (`/dashboard/contacts/[id]`)

### Minimal fields for the slide panel
Based on `ContactCreate` schema, only `contact_type` + `name` are required. Proposed minimal set:

| Field | Required | Notes |
|-------|----------|-------|
| `contact_type` | Yes | Company / Individual radio toggle |
| `name` | Yes | Legal name or full name |
| `email` | No | Common enough to include |
| `phone_primary` | No | Common enough to include |

### Implementation steps

1. **`contacts/page.tsx`** — Replace the `<a href="/dashboard/contacts/new">` button with a state-driven `SlideOverPanel`
   - Add `newContactOpen` state
   - Import and render `SlideOverPanel` with a compact `NewContactForm` inside
   - The form has: contact_type toggle, name (required), email, phone_primary
   - On successful POST to `/api/contacts/`, extract the returned `id` and `router.push(`/dashboard/contacts/${id}`)`

2. **`contacts/new/page.tsx`** — Keep the full-page form as-is (it remains useful for bulk data entry or direct URL access), but update its post-save redirect to navigate to the new contact's profile instead of the list:
   - Change `window.location.href = "/dashboard/contacts"` → `window.location.href = "/dashboard/contacts/${newId}"`

3. **No backend changes needed** — the existing `POST /api/contacts/` already accepts minimal payloads and returns the created contact with its `id`.

---

---

## Finding 2: Connection Add/Edit Should Use SlideOverPanel

**Problem:** On the contact detail page (`contacts/[id]/page.tsx`), clicking "Add connection" renders an **inline form** (lines ~1286–1362) embedded inside the Connections tab card. Editing a connection also renders inline. This is visually cramped and inconsistent with the slide-panel pattern used elsewhere.

**Desired behavior:** Add/edit connection form opens in a `SlideOverPanel` (right-side slide panel), keeping the connections list visible underneath.

### Implementation steps

1. **Import `SlideOverPanel`** in `contacts/[id]/page.tsx`
2. **Replace the inline `<form>` block** (lines ~1286–1362) with a `<SlideOverPanel>` wrapper:
   - `open={linkFormOpen}`, `onClose={closeLinkForm}`
   - `title` = "New Connection" or "Edit Connection" based on `linkFormMode`
   - Body = the existing form fields (direction, other contact, link type, percentage, shares, dates, etc.)
   - Footer = Submit + Cancel buttons
3. **Remove the conditional `{!linkFormOpen && ...}` guard** on the "Add connection" button — the button should always be visible since the form now appears in a side panel, not inline
4. **No state or logic changes** — `linkFormOpen`, `linkForm`, `submitLinkForm`, `closeLinkForm`, `openAddLinkForm`, `openEditLinkForm` all stay as-is; only the rendering container changes

### Files changed
- `frontend/app/(dashboard)/dashboard/contacts/[id]/page.tsx` — swap inline form → `SlideOverPanel`

---

## Finding 3 + 5: Overview & Details Tabs — No Duplication, Edit via SlidePanel

**Problem:** The Overview and Details tabs show overlapping data (jurisdiction, legal form, tax reg, nationality, passport, etc. appear in both). The Details tab is always in edit mode with live inputs, which is overwhelming and error-prone.

**Desired behavior:**
1. **Overview** = high-level summary (snapshot, key dates, recent docs, connections, notes) — **no field-level detail**
2. **Details** = comprehensive read-only field view for all contact data — **no overlap with Overview**
3. **Edit via SlidePanel** — clicking "Edit" on any section opens a SlideOverPanel with editable form fields
4. Overview snapshot card is kept but **simplified** to only show aggregated/status info, not the same fields that Details shows

### Content separation

| Tab | What it shows | What it does NOT show |
|-----|--------------|----------------------|
| **Overview** | Profile card (sidebar), Key Dates, Recent Documents (3), Connections summary (4), Notes, Quick Stats | Individual field values (those live in Details) |
| **Details** | All read-only fields organized by section — Basic Info, Company, Tax, Individual | Documents, connections, notes (those are in their own tabs or Overview) |

### Overview tab changes
- **Remove the "Company Snapshot" / "Individual Snapshot" card** (it duplicates Details)
- Keep: Recent Documents card, Connections summary card, Notes card
- **Add a "Quick Info" card** that shows only: status, contact type, jurisdiction (company) or nationality (individual), and key dates in a compact layout — just enough context without field-level duplication

### Details tab — read-only with per-section Edit buttons

Each section displays fields as **styled read-only text** (not inputs). Each section has an "Edit" button that opens a `SlideOverPanel` scoped to that section.

| Section | Read-only fields | Edit panel |
|---------|-----------------|------------|
| **Basic Info** | Name, email, phones, status, country | SlidePanel with these inputs |
| **Company** (if company) | Trade license, jurisdiction, legal form, tax reg, license dates, establishment card, visa expiry, website, activities | SlidePanel with these inputs |
| **Tax** (if company) | VAT registered + details, CT registered + details | SlidePanel with these inputs |
| **Individual** (if individual) | First/last name, passport, nationality, DOB, visa, emirates ID, gender, designation | SlidePanel with these inputs |
| **Notes** | Notes text | SlidePanel with textarea |

### Implementation steps

1. **Restructure Overview tab:**
   - Remove the Company/Individual Snapshot card
   - Add compact "Quick Info" card (status + type + 1-2 key identifiers)
   - Keep: Recent Docs, Connections summary, Notes

2. **Restructure Details tab:**
   - Replace `<form>` with read-only display sections (collapsible cards with `renderSectionHeader`)
   - Each section gets an "Edit" pencil button in its header
   - Field values rendered as styled text (`renderInfoRow` pattern or similar 2-column grid)

3. **Add section-scoped edit SlidePanels:**
   - New state: `editSection: string | null` (e.g. `"basic"`, `"company"`, `"tax"`, `"individual"`, `"notes"`, or `null`)
   - `SlideOverPanel` renders the appropriate form fields based on `editSection`
   - On save → existing `handleSaveContact` logic → close panel → view refreshes
   - Panel footer: "Save Changes" + "Cancel"

4. **Remove the sticky save bar** from the Details tab

### Files changed
- `frontend/app/(dashboard)/dashboard/contacts/[id]/page.tsx` — restructure Overview, read-only Details, section-scoped edit SlidePanels

---

## Finding 4: Ownership Map — Full Overhaul

**Problem:** The Ownership Map (`compliance/map/page.tsx`) is a basic React Flow canvas with minimal interactivity. The backend has UBO resolution, validation, and risk scoring capabilities that aren't surfaced. No on-canvas editing, no visual differentiation, no auto-layout.

**Desired behavior:** A fully interactive ownership visualization tool with on-canvas editing, UBO/validation display, and polished visuals.

### 4A. On-Canvas Editing

- **Right-click context menu** on nodes with actions:
  - "Add connection" → opens SlidePanel to pick target contact & link details
  - "Edit contact" → opens contact in new tab
  - "Remove from map" (removes the node visually, not the contact)
- **Right-click context menu** on edges:
  - "Edit connection" → opens SlidePanel with link details
  - "Delete connection" → confirm dialog → `DELETE /api/compliance/ownership-links/{id}`
- **Toolbar "Add Node" button** → search existing contacts or create a new one (reuses the minimal SlidePanel from Finding 1), then the node appears on the canvas
- After any connection create/edit/delete → **refresh the graph** from the API

### 4B. UBO + Validation Display

- **Call `/api/compliance/ubo`** when graph loads and show results:
  - UBO nodes get a **highlighted border or badge** (e.g. gold ring + "UBO" label)
  - Effective ownership % shown on UBO nodes
- **Call `/api/compliance/validation`** and show warnings:
  - **Ownership ≠ 100%** → amber banner on root node or top panel warning
  - **Dead ends** → affected nodes get a warning icon/border
  - **Cycles** → affected edges highlighted in red with warning
- **Validation summary panel** (collapsible) at top of canvas showing all issues

### 4C. Better Layout + Visuals (Org-Chart Style — per reference image)

The Ownership Map should look like a **clean org-chart tree**, with the root entity at the top and ownership/control chains flowing downward via elbow connectors.

#### Node design (card style per reference)
- **Avatar circle** on left: company → building icon on blue bg, individual → person icon on purple bg (or initials)
- **Name** (bold, 14px) next to avatar
- **Role/link label** below name (e.g. "51% Owner", "Director", "Managing Director")
- **Compact pill badges**: UBO badge (gold), risk band color dot, KYC status dot
- **Root node**: slightly larger card with accent border
- Rounded corners, subtle shadow, white/elevated bg — matches existing `.card` styling

#### Tree layout (top-down hierarchy)
- Use **`dagre`** for automatic top-down tree positioning
- Root company (selected entity) at **top center**
- Direct shareholders/directors arranged in **row below**, connected by **elbow/bracket connectors** (right-angle edges, not straight lines)
- Sub-levels cascade downward (indirect owners, corporate shareholders' own UBOs)
- "Auto-layout" toolbar button to re-apply; manual drag still works and persists

#### Edge/connector style (elbow connectors like reference)
- **Elbow/step edges** (right-angle connectors, not straight lines) — use React Flow's `smoothstep` or `step` edge type
- Edge styling by link type:
  - **Ownership** → solid line, dark gray, with **% label** on edge
  - **Control** → dashed line, purple, with "Control" label
  - **Director** → solid thin line, green, with role label
  - **Manages** → dotted line, orange
  - **Family** → thin gray line (only when "Show all" is on)
- Animated edge option for selected/highlighted paths

#### Legend panel (toggleable)
- Node types: Company vs Individual
- Edge types: Ownership, Control, Director, Manages, Family
- Risk colors: Green/Amber/Red
- KYC status: Complete (green dot), Incomplete (red dot), Warning (amber dot)
- UBO badge explanation

#### Enhanced side panel (on node click)
- **Profile card** (same pattern as contact detail sidebar): avatar, name, type badge, key info
- **Connections list** from/to this node with edit/delete inline actions
- **Risk score** breakdown (factors)
- **Quick actions**: "Open contact", "Add connection", "Recalculate risk", "View in Contact Details"

### Implementation steps

1. **Install `dagre`** (`npm install dagre @types/dagre`) for auto-layout
2. **Refactor `compliance/map/page.tsx`:**
   - Add `CustomContextMenu` component (appears on right-click node/edge)
   - Add `MapToolbar` component (Add Node button, Auto-layout button, Legend toggle)
   - Upgrade `CustomNode` component with richer styling, UBO badge, risk colors
   - Add `CustomEdge` or edge styling by link type
   - Add `ValidationBanner` component
   - Add `MapLegend` component
3. **Add SlidePanel integrations:**
   - "Add connection" SlidePanel (reuse link form pattern from Finding 2)
   - "Add node" SlidePanel (search/create contact)
   - "Edit connection" SlidePanel (pre-filled from edge data)
4. **Wire up additional API calls:**
   - `GET /api/compliance/ubo?entity_contact_id=` on graph load
   - `GET /api/compliance/validation?entity_contact_id=` on graph load
   - `POST/PATCH/DELETE /api/compliance/ownership-links` from canvas actions
5. **Auto-layout function** using dagre: compute positions → update nodes → auto-save layout

### Files changed
- `frontend/app/(dashboard)/dashboard/compliance/map/page.tsx` — major rewrite
- `frontend/package.json` — add `dagre` + `@types/dagre`
- No backend changes — all APIs already exist

---

## Finding 6: Add/Edit Address — Use SlideOverPanel

**Problem:** In the Addresses tab, clicking "Add Address" expands an inline form inside the card (lines ~1243–1271). Editing an address also renders inline via `AddressEditForm`. This is inconsistent with the SlidePanel pattern being adopted across the app.

**Desired behavior:** Add and edit address forms open in a `SlideOverPanel`, keeping the address list always visible.

### Implementation steps

1. **Add Address** — Replace the inline `{newAddrOpen && <form>...}` block with a `SlideOverPanel`:
   - `open={newAddrOpen}`, `onClose={() => setNewAddrOpen(false)}`
   - Title: "New Address"
   - Body: existing address form fields (type, line 1, line 2, city, emirate, postal code, is_primary, notes)
   - Footer: "Add Address" + "Cancel" buttons
   - On submit → existing `addAddress` logic → close panel

2. **Edit Address** — Replace the inline `AddressEditForm` component with a `SlideOverPanel`:
   - `open={editingAddrId !== null}`, `onClose={() => setEditingAddrId(null)}`
   - Title: "Edit Address"
   - Body: same fields pre-filled from the address being edited
   - Footer: "Save" + "Cancel"
   - On submit → existing `updateAddress` logic → close panel

3. **"Add Address" button stays always visible** — remove the `{!newAddrOpen && ...}` guard

### Files changed
- `frontend/app/(dashboard)/dashboard/contacts/[id]/page.tsx` — swap inline address forms → `SlideOverPanel`

---

## Finding 7: Contact Details Page — Layout Refactor (CRM Reference)

**Problem:** The current contact detail page layout doesn't match modern CRM UX patterns. The user provided a reference screenshot showing a cleaner two-panel layout with: left sidebar (profile + activity feed), underline-style tab bar, stat summary cards, and better content hierarchy.

**Desired behavior:** Refactor the layout to match the reference while keeping existing branding (CSS variables, design tokens, dark mode support).

### Layout Changes

#### Left Sidebar (~300px, sticky)
**Keep:**
- Avatar circle with initials (already exists)
- Contact name + type/status badges
- Quick action icon buttons (Mail, Call, More)

**Add:**
- **Last Activity timestamp** (e.g. "Last Activity: 2 Nov 2024 at 09:00AM")
- **Sidebar sub-tabs**: "Contact Info" / "Activities"
  - **Contact Info tab**: Contact Info card, Key Dates card, Linked Records card (already exist — just wrap in sub-tab)
  - **Activities tab**: Activity feed/timeline (uses existing `GET /api/activities/` filtered by contact)

**Change:**
- Quick action buttons → **icon-button row** (compact, labeled icons like reference: Mail, Call, More dropdown)
- Move "Edit Details" and "View on Ownership Map" into the "More" dropdown menu

#### Right Main Area
**Change tab bar style:**
- Switch from **pill/segment** tabs to **underline-style** tabs (use existing `.tab-bar` / `.tab-bar-btn` CSS classes)
- Tab labels match reference pattern: Details, Documents, Addresses, Connections, Notes

**Add stat summary cards** at top of each tab where relevant:
- **Documents tab**: "Docs Total", "By Category" counts in stat cards before the document list
- **Connections tab**: "Companies", "Individuals", "Ownership Links" stat cards before the connections grid
- **Overview tab → removed** (content split into sidebar + Details tab per Finding 3+5)

#### Tab restructure (combines with Finding 3+5)
| Tab | Content |
|-----|---------|
| **Details** | Read-only field sections (Basic, Company, Tax, Individual) with per-section Edit → SlidePanel |
| **Documents** | Stat summary cards + document list with actions (View, Download, Upload) |
| **Addresses** | Address list with Add/Edit → SlidePanel (Finding 6) |
| **Connections** | Stat summary cards + connection grid with Add/Edit → SlidePanel (Finding 2) |
| **Notes** | Notes display with Edit → SlidePanel |

### Implementation steps

1. **Refactor sidebar:**
   - Add sidebar sub-tab state (`sidebarTab: "info" | "activities"`)
   - "Contact Info" tab: wrap existing Contact Info, Key Dates, Linked Records cards
   - "Activities" tab: fetch and display recent activities for this contact
   - Add last-activity timestamp below quick actions
   - Compact quick action row (icon buttons) + "More" dropdown

2. **Switch tab bar to underline style:**
   - Replace pill/segment tab bar with `.tab-bar` + `.tab-bar-btn` pattern from `globals.css`
   - Remove Overview tab; Details becomes default

3. **Add stat summary cards:**
   - Documents tab: total docs, breakdown by category
   - Connections tab: companies count, individuals count

4. **Integrate with Findings 2, 3+5, 6:**
   - All inline forms → SlidePanel (already planned)
   - Details tab: read-only + per-section edit SlidePanels (already planned)

### Files changed
- `frontend/app/(dashboard)/dashboard/contacts/[id]/page.tsx` — full layout refactor

---

## Finding 8: Product (Service) Detail Page — Layout Refactor

**Problem:** The product detail page is always in edit mode (Overview tab is a live form), uses a single-column layout, and doesn't visually communicate that these are **services** (not inventory products). The user provided a reference showing a two-panel layout with a metadata sidebar.

**Desired behavior:** A two-panel layout inspired by the reference, tailored for CSP services — read-only by default, edit via SlidePanel, with a right sidebar for service organization metadata.

### Layout (two-panel: main content + right sidebar)

#### Header row (matches reference pattern)
- Breadcrumb: Products > {name}
- **Service name** (large), **status badge** (Active/Inactive), **code badge** (monospace)
- Metadata row: "Created {date} · Last Updated {date}" + "Service {n} of {total}" counter
- Action buttons: Duplicate (future), Delete, Prev/Next navigation

#### Right sidebar (~300px)
**"Service Organization" card** (matches reference's "Product Organization"):
- **Service Code** (read-only display, e.g. "CF")
- **Default Price** (formatted, e.g. "AED 5,000.00")
- **Status toggle** (Active/Inactive — inline toggle, not a form)
- **Creates Project** toggle (with teal accent when on)
- **Total Sales** stat (future — placeholder for now)
- **Edit Service** button → opens SlidePanel with name, code, description, price, toggles

#### Main content area (left)
**Tab bar** (underline style, matching app pattern): Overview, Task Templates, Documents

**Overview tab** (read-only):
- **Description card** — service description text (read-only)
- **Stat summary cards** row: Default Price, Task Templates count (+ subtasks), Required Documents count, Created date
- **Quick links**: "Go to Task Templates →", "Go to Documents →"

**Task Templates tab** (unchanged logic, improved layout):
- Table list of templates with subtask pills
- Add form at bottom (or → SlidePanel for consistency)

**Documents tab** (unchanged logic, improved layout):
- Table list of document requirements
- Add form at bottom (or → SlidePanel for consistency)

### Implementation steps

1. **Restructure to two-panel layout:**
   - Left main: tabs + tab content
   - Right sidebar: Service Organization card (sticky)

2. **Convert Overview tab from form → read-only:**
   - Description card (formatted text)
   - Stat summary cards
   - Quick navigation links to other tabs

3. **Add "Edit Service" SlidePanel:**
   - New state: `editServiceOpen`
   - SlidePanel with: name, code, description, price, is_active, creates_project
   - On save → existing `handleSave` logic → close panel, refresh
   - Sidebar toggles (Active, Creates Project) can also live-toggle via PATCH

4. **Update header:**
   - Add metadata row (created/updated dates)
   - Add prev/next navigation (if product list available)

### Files changed
- `frontend/app/(dashboard)/dashboard/products/[id]/page.tsx` — full layout refactor

---

## Finding 9: Required vs Deliverable Documents on Product & Project

**Problem:** `ProductDocumentRequirement` and `ProjectDocumentChecklist` only track "required" documents (collected from client). There is no distinction for **deliverable** documents (delivered to client, e.g. trade license, MOA, certificate of incorporation). Both types should prepopulate into the project on sales order confirmation.

**Desired behavior:** Each product document requirement has a `document_type` field: `required` or `deliverable`. The project document checklist inherits this type when auto-populated.

### Backend changes

1. **Add `document_type` column to `ProductDocumentRequirement`:**
   - `document_type = Column(String(20), nullable=False, default="required")` — values: `"required"` | `"deliverable"`

2. **Add `document_type` column to `ProjectDocumentChecklist`:**
   - Same field, inherited from product template during `_append_doc_checklist_for_product()`

3. **Migration:** Alembic migration to add `document_type` column to both tables (default `"required"` for existing rows)

4. **Update schemas:**
   - `ProductDocumentRequirementCreate` — add `document_type: str = "required"`
   - `ProductDocumentRequirementResponse` — add `document_type: str`
   - `ProjectDocumentChecklistResponse` (if exists) — add `document_type: str`

5. **Update `_append_doc_checklist_for_product()`** in both `approvals.py` and `project_details.py`:
   - Pass `document_type` from product requirement to project checklist item

### Frontend changes (Product detail page — Documents tab)

6. **Split Documents tab into two sections** (or sub-tabs):
   - **Required Documents** — documents to collect from client
   - **Deliverable Documents** — documents to deliver to client
   - Each section has its own list and add form
   - Add form includes a `document_type` selector (or section determines it implicitly)

7. **Document category must be a dropdown**, not free-text:
   - Populate from `SYSTEM_DOCUMENT_CATEGORIES` (trade_license, moa, passport, visa, contract, receipt, other)
   - Expose a new API endpoint `GET /api/documents/categories` (or hardcode the list on the frontend) that returns the list of `{slug, name}` pairs
   - The add-document form renders a `<select>` with these options instead of the current free-text `<input>`

8. **Update stat summary cards** to show counts for both types

### Files changed
- `backend/models/product.py` — add `document_type` to `ProductDocumentRequirement`
- `backend/models/project.py` — add `document_type` to `ProjectDocumentChecklist`
- `backend/schemas/product.py` — update create/response schemas
- `backend/api/products.py` — pass `document_type` in create endpoint
- `backend/api/approvals.py` — update `_append_doc_checklist_for_product()`
- `backend/api/project_details.py` — update `_append_doc_checklist_for_product()`
- `backend/migrations/` — new migration file
- `frontend/app/(dashboard)/dashboard/products/[id]/page.tsx` — split Documents tab into Required / Deliverable sections

---

## Finding 10: Activity Defaults & Multi-Assignee Support

**Problem:** When creating an activity, `start_datetime` is empty and `assigned_to` has no default. Also, activities can only be assigned to one user.

**Desired behavior:**
1. `start_datetime` defaults to **current date and time** when the form opens
2. `assigned_to` defaults to **current user**
3. Activities can be assigned to **multiple users**

### Backend changes (multi-assignee)

1. **New M2M table `activity_assignees`:**
   - `activity_id` FK → `activities.id`
   - `user_id` FK → `users.id`
   - Composite primary key `(activity_id, user_id)`

2. **Keep `assigned_to` column** on `Activity` for backward compat (primary assignee), but add relationship to `activity_assignees` for additional assignees.
   - Or: migrate fully to M2M and drop `assigned_to`. (Prefer M2M-only for simplicity.)

3. **Update schemas:**
   - `ActivityCreate.assigned_to` → `assigned_to_ids: List[str] = []` (list of user IDs)
   - `ActivityResponse` → add `assignees: List[{id, full_name}]`

4. **Update API endpoints** (`activities.py`):
   - Create: insert rows into `activity_assignees` for each user ID
   - Update: sync assignee list (add/remove)
   - Enrichment: populate `assignees` list in response
   - Notifications: notify each assignee (not just one)

5. **Migration:** New `activity_assignees` table + optional data migration from existing `assigned_to`

### Frontend changes

6. **Default `start_datetime`** to `new Date().toISOString().slice(0, 16)` when form opens (both Calendar and TasksTab)

7. **Default `assigned_to`** to current user ID (requires knowing current user; already available via auth context or `/api/users/me`)

8. **Multi-select for assignees:**
   - Replace single `<select>` with a **multi-select pill picker** (checkboxes dropdown or tag input)
   - Show selected users as removable pills/badges
   - Applies to: Calendar page `newAct` form + TasksTab SlideOver

### Files changed
- `backend/models/activity.py` — add `ActivityAssignee` M2M model
- `backend/schemas/activity.py` — `assigned_to_ids` list, `assignees` response field
- `backend/api/activities.py` — update create/update/enrich logic
- `backend/migrations/` — new migration for `activity_assignees` table
- `frontend/app/(dashboard)/dashboard/calendar/page.tsx` — defaults + multi-select
- `frontend/app/(dashboard)/dashboard/projects/[id]/components/TasksTab.tsx` — defaults + multi-select

---

## Finding 11: Sidebar Should Stick (Not Scroll with Page)

**Problem:** The sidebar has `position: sticky` but `.dashboard-shell` has `min-height: 100vh` without constraining `height` or `overflow`. When main content exceeds the viewport, the shell grows and the body scrolls — causing the sidebar to scroll away with the page.

**Fix (CSS-only, 2 lines):**

Change `.dashboard-shell` in `globals.css`:
```css
.dashboard-shell {
  display: flex;
  height: 100vh;          /* was min-height: 100vh */
  overflow: hidden;        /* add — prevent body scroll */
  background: var(--bg-primary);
  max-width: 100vw;
}
```

This forces only `.dashboard-main` (which has `overflow: auto`) to scroll, keeping the sidebar permanently fixed in place.

### Files changed
- `frontend/app/globals.css` — `.dashboard-shell` height + overflow fix

---

## Finding 12: Upcoming Meetings Widget Fix + Calendar List View

**Problem:** A meeting created for Feb 13 doesn't appear in "Upcoming Meetings" on the dashboard. Two root causes:

1. **`/api/activities/today` filters by `assigned_to == current_user.id`** — if the meeting isn't assigned to the logged-in user (or Finding 10's multi-assignee hasn't been applied yet), it won't appear.
2. **The dashboard defaults to `actMapPeriod === "daily"` and only calls `/api/activities/today`**, which returns activities whose `start_datetime` falls within today UTC. If the user's timezone (UTC+4) makes today Feb 13 but UTC is still Feb 12, the meeting won't match.
3. **"Upcoming Meetings" filters `todayActivities` for `activity_type === "meeting"`** — so it only ever shows today's meetings, not truly "upcoming" ones (next 7 days, etc.).

Additionally, there's no **"View All"** button and no **list/table view** on the Calendar page.

### Fixes

#### A. Fix "Upcoming Meetings" widget (dashboard)
1. **Fetch upcoming meetings separately** — don't rely on `todayActivities`. Add a dedicated API call:
   - `GET /api/activities/?start_date={now}&end_date={now+7d}&status=pending` (next 7 days, all users in org)
   - Filter client-side for `activity_type === "meeting"`
   - Or: add a backend endpoint `GET /api/activities/upcoming?days=7&type=meeting`
2. **Remove the `assigned_to == current_user.id` filter** for this widget (show all org meetings, or at minimum meetings where current user is an assignee)
3. **Add "View All →" button** that routes to `/dashboard/calendar?view=list`

#### B. Add list/table view to Calendar page
4. **Add a 4th view option** in the Calendar view switcher: `month | week | day | list`
5. **List view**: a table/spreadsheet layout with columns:
   - Title, Type, Start, End, Assignee(s), Project, Status, Actions
   - Sortable columns
   - Uses the same filtered activities data already fetched
   - Reuses existing `.table-container` / `<table>` styling

### Files changed
- `frontend/app/(dashboard)/dashboard/page.tsx` — fix upcoming meetings fetch + add "View All" button
- `frontend/app/(dashboard)/dashboard/calendar/page.tsx` — add `list` view option + table rendering
- `backend/api/activities.py` — (optional) add `/upcoming` convenience endpoint or fix timezone handling

---

*More findings will be appended below as the user shares them.*
