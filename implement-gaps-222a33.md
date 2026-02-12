# Implement Gap Analysis Fixes

Close all gaps identified in the gap analysis, working through high → medium → low priority items across contacts, calendar, and ownership map pages.

---

## Phase 1: High Priority (4 items)

### 1. F1 — Quick-create navigates to new contact + contacts/new redirect
- **`contacts/page.tsx`**: In `handleQuickCreate`, capture the returned contact `id` from `api.post`, then `router.push(`/dashboard/contacts/${id}`)` instead of just calling `load()`
- **`contacts/new/page.tsx`**: Change `window.location.href = "/dashboard/contacts"` → redirect to `/dashboard/contacts/${newId}`

### 2. F3+5 — Remove Overview Snapshot duplication
- **`contacts/[id]/page.tsx`**: Replace the "Company Snapshot" / "Individual Snapshot" card on Overview tab with a compact "Quick Info" card showing only: status badge, contact type, jurisdiction (company) or nationality (individual) — no field-level duplication with Details tab

### 3. F7 — Switch tab bar from pill to underline style
- **`contacts/[id]/page.tsx`**: Replace the current pill/segment tab bar (bg toggle with `var(--bg-tertiary)`) with the existing `.tab-bar` + `.tab-bar-btn` CSS classes from `globals.css`

### 4. F6 — Address edit via SlideOverPanel
- **`contacts/[id]/page.tsx`**: Add `editAddr` state (holds address data or null), wrap `AddressEditForm` content in a `SlideOverPanel` instead of rendering inline. Edit button sets `editAddr` to the address; SlidePanel `onClose` clears it.

## Phase 2: Medium Priority (4 items)

### 5. F3+5 — Per-section edit panels
- **`contacts/[id]/page.tsx`**: Replace single `editDetailsOpen` boolean with `editSection: string | null` (`"basic"`, `"company"`, `"tax"`, `"individual"`, `"notes"`, or `null`). Each read-only section gets an Edit button. The SlideOverPanel renders the appropriate subset of fields based on `editSection`. Reuse existing `handleSaveContact`.

### 6. F7 — Remove Overview tab, make Details default
- **`contacts/[id]/page.tsx`**: Remove "overview" from tab list. Move Quick Info card + Recent Docs + Connections summary + Notes into the sidebar or above the tabs. Default `activeTab` to `"details"`.

### 7. F7 — Sidebar sub-tabs + activity feed + stat cards
- Add `sidebarTab: "info" | "activities"` state
- "Contact Info" sub-tab: existing sidebar content (Contact Info card, Key Dates, Linked Records)
- "Activities" sub-tab: fetch `GET /api/activities/?contact_id=` and render a compact activity timeline
- Add stat summary cards above Documents tab (doc count by category) and Connections tab (companies/individuals count)

### 8. F1 — contacts/new redirect (already covered in Phase 1 item 1)

## Phase 3: Low Priority (3 items)

### 9. F12 — Activity detail overlay → SlideOverPanel
- **`calendar/page.tsx`**: Replace the hand-rolled fixed-position activity detail overlay with a `SlideOverPanel`

### 10. F7 — "More" dropdown for sidebar quick actions
- **`contacts/[id]/page.tsx`**: Wrap "Edit Details" and "View on Ownership Map" in a dropdown menu triggered by a "More" icon button

### 11. F4 — Right-click context menus on Ownership Map
- **`compliance/map/page.tsx`**: Add `onNodeContextMenu` / `onEdgeContextMenu` handlers that show a floating context menu with actions (Add connection, Edit contact, Delete connection, etc.)
- Wire up SlidePanel for Add/Edit connection from canvas
- Refresh graph after mutations

---

## Files Modified
- `frontend/app/(dashboard)/dashboard/contacts/page.tsx` — quick-create redirect
- `frontend/app/(dashboard)/dashboard/contacts/new/page.tsx` — post-save redirect
- `frontend/app/(dashboard)/dashboard/contacts/[id]/page.tsx` — most changes (tabs, overview, sections, address edit, sidebar)
- `frontend/app/(dashboard)/dashboard/calendar/page.tsx` — activity detail SlidePanel
- `frontend/app/(dashboard)/dashboard/compliance/map/page.tsx` — context menus
