# Gap Analysis: Implementation vs Improvement Plan

Systematic audit of what was implemented versus what the comprehensive improvement plan specified, identifying remaining gaps.

---

## Finding 1: Simplify Contact Creation Flow

| Spec Item | Status | Notes |
|-----------|--------|-------|
| SlideOverPanel with minimal fields on listing page | ✅ Done | `quickCreateOpen` + SlideOverPanel with type, name, email, phone, status |
| On save, navigate to new contact's profile | ❌ **GAP** | Currently calls `load()` to refresh the list but does **not** `router.push` to the new contact. Plan says to extract returned `id` and navigate. |
| `contacts/new/page.tsx` — redirect to new contact profile after save | ❌ **GAP** | Still redirects to `/dashboard/contacts` (line 141), not to `/dashboard/contacts/${newId}` |

---

## Finding 2: Connection Add/Edit via SlideOverPanel

| Spec Item | Status | Notes |
|-----------|--------|-------|
| Add connection form in SlideOverPanel | ✅ Done | |
| "Add connection" button always visible | ✅ Done | |
| Edit connection via SlideOverPanel | ⚠️ **Partial** | Add mode uses SlideOverPanel; edit mode reuses the same panel via `linkFormMode`, but should verify `openEditLinkForm` pre-fills and opens the panel correctly |

---

## Finding 3+5: Overview & Details — No Duplication, Edit via SlidePanel

| Spec Item | Status | Notes |
|-----------|--------|-------|
| Details tab is read-only | ✅ Done | Uses `Field` component for read-only display |
| Edit Details button opens SlideOverPanel | ✅ Done | Single panel with all fields |
| **Per-section edit** (Basic, Company, Tax, Individual, Notes) | ❌ **GAP** | Plan specifies `editSection` state and **section-scoped** panels. Current impl uses a single monolithic "Edit Details" panel for everything. |
| Remove "Company/Individual Snapshot" from Overview | ❌ **GAP** | Snapshot card still exists on Overview tab (lines 933-959) with jurisdiction, legal form, tax reg, nationality, passport, DOB, etc. — duplicating Details |
| Add "Quick Info" card on Overview | ❌ **GAP** | Plan says replace snapshot with compact Quick Info (status + type + 1-2 identifiers). Not implemented. |
| Remove sticky save bar from Details | ✅ Done | No sticky save bar exists; save is in the SlidePanel |
| Notes tab / Notes edit via SlidePanel | ❌ **GAP** | No dedicated Notes section edit. Notes are shown on Overview but not editable via SlidePanel. |

---

## Finding 6: Address Add/Edit via SlideOverPanel

| Spec Item | Status | Notes |
|-----------|--------|-------|
| Add address via SlideOverPanel | ✅ Done | |
| **Edit address** via SlideOverPanel | ❌ **GAP** | Edit still uses inline `AddressEditForm` component (line 1226-1227), not a SlideOverPanel. Plan specifically says to wrap edit in SlideOverPanel too. |

---

## Finding 7: Contact Details Page — Layout Refactor (CRM Reference)

| Spec Item | Status | Notes |
|-----------|--------|-------|
| Two-panel layout (sidebar + main) | ✅ Done | Left sidebar 300px + main content area |
| Sidebar sub-tabs ("Contact Info" / "Activities") | ❌ **GAP** | No sidebar sub-tabs. No activity feed in sidebar. |
| Last Activity timestamp below quick actions | ❌ **GAP** | Not implemented |
| Sidebar "Activities" tab with activity feed/timeline | ❌ **GAP** | No activity timeline in sidebar |
| "More" dropdown for Edit Details / Ownership Map | ❌ **GAP** | Both are separate buttons, not in a dropdown |
| Switch tab bar from pill/segment to **underline-style** | ❌ **GAP** | Tab bar still uses pill/segment style (background toggle), not underline `.tab-bar` / `.tab-bar-btn` pattern |
| Remove Overview tab (content split into sidebar + Details) | ❌ **GAP** | Overview tab still exists as the default tab |
| Stat summary cards on Documents tab | ❌ **GAP** | No stat cards before documents list |
| Stat summary cards on Connections tab | ❌ **GAP** | No stat cards before connections grid |

---

## Finding 8: Product Detail Page — Layout Refactor

| Spec Item | Status | Notes |
|-----------|--------|-------|
| Two-panel layout (main + sidebar) | ✅ Done | |
| Read-only Overview tab | ✅ Done | |
| Edit Service via SlideOverPanel | ✅ Done | |
| Sidebar with Service Organization card | ✅ Done | |
| Stat summary cards | ✅ Done | |
| Required/Deliverable document split | ✅ Done | |

---

## Finding 9: document_type Backend + Frontend

| Spec Item | Status | Notes |
|-----------|--------|-------|
| `document_type` column on `ProductDocumentRequirement` | ✅ Done | |
| `document_type` column on `ProjectDocumentChecklist` | ✅ Done | |
| Migration | ✅ Done | |
| Frontend split Required/Deliverable sections | ✅ Done | |
| Document category as dropdown (not free-text) | ⚠️ **Unclear** | Plan says use `SYSTEM_DOCUMENT_CATEGORIES` dropdown. Need to verify if select is used vs free-text input. |

---

## Finding 10: Activity Defaults & Multi-Assignee

| Spec Item | Status | Notes |
|-----------|--------|-------|
| M2M `activity_assignees` table | ✅ Done | |
| `assigned_to_ids` in create/update schemas | ✅ Done | |
| Multi-select checkboxes on Calendar form | ✅ Done | |
| Default `start_datetime` to now | ✅ Done | |
| Default `assigned_to` to current user | ✅ Done | |
| Multi-select on TasksTab SlideOver | ⚠️ **Unclear** | Need to verify TasksTab also got multi-assignee |

---

## Finding 11: Sidebar Sticky Fix

| Spec Item | Status | Notes |
|-----------|--------|-------|
| `height: 100vh` + `overflow: hidden` on `.dashboard-shell` | ✅ Done | |

---

## Finding 12: Upcoming Meetings + Calendar List View

| Spec Item | Status | Notes |
|-----------|--------|-------|
| Fix "Upcoming Meetings" widget | ✅ Done | |
| "View All →" button on dashboard | ✅ Done | |
| Calendar list/table view | ✅ Done | |
| PageViewToggle for calendar vs list | ✅ Done | |
| Activity detail overlay is still a hand-rolled modal | ⚠️ **Minor** | Could be a SlideOverPanel for consistency (not in original plan) |
| Completion modal is still a hand-rolled centered dialog | ⚠️ **Minor** | Small modal, arguably fine as-is |

---

## Finding 4: Ownership Map Overhaul

| Spec Item | Status | Notes |
|-----------|--------|-------|
| Dagre auto-layout | ✅ Done | |
| Rich CustomNode (avatar, UBO badge, risk/KYC dots) | ✅ Done | |
| Smoothstep edges styled by link type | ✅ Done | |
| Legend panel | ✅ Done | |
| Validation banner | ✅ Done | |
| UBO resolution on load | ✅ Done | |
| Enhanced side panel (profile, risk, actions) | ✅ Done | |
| **Right-click context menu** on nodes | ❌ **GAP** | Not implemented. Plan specifies "Add connection", "Edit contact", "Remove from map" |
| **Right-click context menu** on edges | ❌ **GAP** | Not implemented. Plan specifies "Edit connection", "Delete connection" |
| **"Add Node" toolbar button** (search/create contact) | ❌ **GAP** | Toolbar has auto-layout, legend, validation toggle — but no "Add Node" |
| **SlidePanel for Add/Edit connection from canvas** | ❌ **GAP** | No on-canvas editing SlidePanels |
| **Graph refresh** after connection create/edit/delete | ❌ **GAP** | No mutation actions exist on the map yet |

---

## Summary: Priority Gaps

### High Impact (User-Facing UX Gaps)

1. **F1**: Quick-create doesn't navigate to new contact after save
2. **F3+5**: Overview Snapshot card duplicates Details tab fields; should be removed/simplified
3. **F7**: Tab bar is still pill-style, not underline-style per plan
4. **F7**: No sidebar sub-tabs, no activity feed, no stat summary cards on tabs
5. **F6**: Address edit is still inline, not SlideOverPanel

### Medium Impact

6. **F3+5**: Single monolithic edit panel vs per-section edit panels
7. **F4**: No right-click context menus or on-canvas editing on Ownership Map
8. **F7**: Overview tab still exists (plan says remove it)
9. **F1**: `contacts/new/page.tsx` still redirects to list, not new contact profile

### Low Impact / Cosmetic

10. **F12**: Activity detail and completion overlays are hand-rolled modals (not SlidePanels)
11. **F7**: No "More" dropdown for quick actions in sidebar
12. **F3+5**: No dedicated Notes section edit via SlidePanel
