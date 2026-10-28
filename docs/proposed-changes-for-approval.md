# Proposed changes for approval

Nothing below is implemented. Each change alters visible UI, a workflow or permissions, so each needs an explicit yes. Approve by ID, for example "approve CH-03, CH-04". Partial approvals are fine.

Every item follows the same shape: **Now** (what exists) · **Requirement** · **Change** · **Why** · **Affects**.

## Priority 1 · Conflicts with the core approval and budget model

### CH-03 · Head Office as the single approver, no value thresholds
- **Now:** Every PO waits for a CEO-only "final authorisation" (`procurement.authorise`). Seed and configuration hold value thresholds (₹25,000, ₹60,000 "critical"). Emergency requests also go to that final stage.
- **Requirement:** Q03, Q06, Q07.
- **Change:** Move PO authorisation to the Head Office role and remove the CEO's `procurement.authorise`. Remove the value thresholds and the "Critical approval above ₹60,000" setting on `/admin/configuration`. "Critical" then means emergency only. Emergency requests go to the Head Office stage. The CEO keeps read-only visibility.
- **Why:** The answers make Head Office the single, centralised approver with no fixed limits.
- **Affects:** CEO and Head Office permissions, `/procurement/orders` actions, the pipeline's "Awaiting authorisation" column, the `/approvals` queue, `/admin/configuration`, the purchasing dashboard. Maker–checker stays: whoever raises a PO still can't authorise it.

### CH-05 · Replace centre monthly budgets with category spending limits
- **Now:** Every centre has a monthly allocation, shown on the Budgets page and four dashboards, and checked against every request.
- **Requirement:** Q21, Q23, Q28 (and Q24 via CH-06).
- **Change, option A (recommended):** Replace centre allocations with spending limits on the categories Head Office selects. Rename "Budgets & allocations" to "Spending limits". Show limits only for controlled categories. Remove "Monthly budget" from centre records. Run the request budget check only on controlled lines.
- **Change, option B (lighter):** Keep the screens, but relabel allocations as "Indicative spend guide (simulated)" and show the request check only for flagged categories.
- **Why:** The app currently presents a budget policy that doesn't exist.
- **Affects:** `/approvals/budgets`, the centre, executive and head-office dashboards, `/approvals/exceptions`, `/admin/users`, the request wizard, approval review, seed data and tests. Needs answers to open questions 2 and 3 before building.

### CH-10 · Centre Head confirms deliveries; one person, one centre
- **Now:** A Receiving Staff role records deliveries. Demo user Suresh Pillai covers Baner and Wakad. Admin forms allow several centres per centre-scoped user.
- **Requirement:** Q09, Q10, Q51.
- **Change:** Give Centre Leaders `receiving.record`, so the receive form appears on their dashboard. Either retire the Receiving Staff role or limit it to one centre (open question 6). Make the admin forms accept exactly one centre for centre-scoped roles. Fix the demo data so no one spans two centres.
- **Why:** Deliveries are confirmed by the Centre Head, and no person manages two centres.
- **Affects:** Permissions, the centre and receiving dashboards, `/receiving/receipts`, admin user forms, the demo sign-in list (Suresh Pillai's account changes or goes).

### CH-01 · Restore 15 centres
- **Now:** 11 centres, all published on jumpstartpreschool.in. The 4 unpublished centres were removed at your earlier request.
- **Requirement:** Q01.
- **Change:** Add the 4 remaining centres once you give their names, codes and cities. Until then, either keep 11 or show 4 records marked "awaiting configuration".
- **Why:** Counts, comparisons and network totals currently cover 11 of 15 centres.
- **Affects:** All centre lists, centre counts, charts and the sign-in page's network figures.

### CH-02 · Karve Road pilot
- **Now:** Karve Road is one of 11 centres. Demo Centre Leader Kavya Nair and the request journey use Baner.
- **Requirement:** Q58.
- **Change:** Move Kavya Nair (or a new demo Centre Leader) to Karve Road and retell the request journey there. Add a small "Pilot centre" badge on Karve Road wherever centres are listed.
- **Why:** Demos should show the pilot the business will actually run.
- **Affects:** The demo account, `/requests/journey`, centre lists, the sign-in hero card label ("Baner centre").

## Priority 2 · Workflow corrections

### CH-08 · Revise a request until procurement begins
- **Now:** After submission, a centre can only edit if Head Office returns the request.
- **Requirement:** Q05.
- **Change:** Add "Revise request" on `/requests/[id]` for submitted and approved requests until procurement starts. Revising withdraws the pending approval and reopens the draft, with an audit entry.
- **Affects:** The request workflow (new transition), request detail actions, the approval queue.

### CH-07 · Late submissions need Head Office acceptance
- **Now:** A request submitted after the 25th goes straight to normal review.
- **Requirement:** Q08.
- **Change:** Submissions after the 25th enter "Late · awaiting acceptance". Head Office accepts (it moves to normal review) or rejects (with a reason). A badge shows on the request and in the queue.
- **Affects:** The request workflow, `/approvals`, request detail, the centre dashboard deadline card.

### CH-09 · Exceptional requests and local emergency purchases
- **Now:** "Emergency requests" are always available and go to the CEO stage. Local purchases aren't recorded.
- **Requirement:** Q07, Q08, Q12.
- **Change:** Rename the page "Exceptional requests", add copy stating that routine mid-month requests are not accepted, and route them to Head Office (with CH-03). Add "Record local emergency purchase" (item, quantity, amount, bill reference) for Head Office review.
- **Affects:** `/requests/emergency` title, copy and form; the Requests menu label.

### CH-04 · Remove inter-centre transfers
- **Now:** Transfer movement types and a "Transfers" group on the movements page. No data uses them.
- **Requirement:** Q15.
- **Change:** Remove `transfer_in` and `transfer_out` from the model, labels, movements page and reconciliation.
- **Affects:** The `/inventory/movements` legend and group. No figures change.

### CH-13 · Derive consumption from counts; track wastage and returns
- **Now:** Consumption is logged as daily movements. No wastage or return types.
- **Requirement:** Q39, Q41.
- **Change:** Compute consumption per centre and month as opening + receipts − closing − wastage ± returns and adjustments. Add "Wastage" and "Return to supplier" movement types, recorded by the Centre Head. Show wastage as its own column in reconciliation.
- **Affects:** Seed generation, `/inventory/movements`, `/inventory/counts`, `/analytics/consumption`, consumption charts. Monthly figures replace daily curves.

### CH-06 · Recorded justification for over-limit approvals
- **Now:** The approval note is optional.
- **Requirement:** Q24.
- **Change:** When a request exceeds a category limit (from CH-05), approval requires a reason, stored in the audit trail and shown on the request.
- **Affects:** The approval review form. Depends on CH-05.

## Priority 3 · Missing capability (new fields or screens)

| ID | Requirement | Change | Affects |
|---|---|---|---|
| CH-11 | Q20, Q53 | Catalogue management. Head Office creates and renames items; Central Procurement edits unit, category, rate-card price and "budget-controlled" and "batch-tracked" flags. Every change is audited | `/inventory/catalogue` gains add and edit actions; new permissions |
| CH-12 | Q16 | Batch and expiry captured at goods receipt for batch-tracked items; real expiry alerts replace the placeholder | Receipt form fields, `/inventory/alerts` |
| CH-14 | Q40, Q43 | Centre profile: monthly enrolment and attendance, meal programme, age groups, operating hours. Analytics adds per-child figures | `/admin/users` centre drawer, `/analytics` |
| CH-15 | Q42 | Wastage KPI (value and top items) on the executive and analytics dashboards. Needs CH-13 | Executive dashboard, `/analytics` |
| CH-16 | Q26 | Vendor GST treatment (registered inclusive or exclusive, or unregistered), with GST shown on invoices | Supplier form, invoice detail |
| CH-17 | Q27 | Indian financial year (Apr–Mar) in period selectors and report roll-ups | Period pills, reports |
| CH-18 | Q25 | Head Office records actual purchase cost with a document reference (bill, invoice or receipt number and optional upload) | Invoice and receipt detail |
| CH-19 | Q29–Q35 | Intake: language selector (Hindi, Marathi, English), image upload, a 20-minute limit, per-line mandatory verification, a "Repeat this item" state for unmatched items, staff-only and retention notices. Stays labelled simulated | `/requests/intake` |
| CH-20 | Q50 | List Google Workspace (sign-in) and Google Sheets (export and import) as planned integrations | `/governance/integrations` rows |

## Decisions needed before building

- **CH-01:** names of the 4 centres.
- **CH-05:** option A or B; which categories are controlled; limit level.
- **CH-10:** retire or keep the Receiving Staff role.
- **CH-08:** what "procurement begins" means.
- **CH-21 (Q19):** is milk powder a daily perishable, and is the daily flow in scope? No change is proposed until you answer.

## Applied without approval

None. Every gap found changes visible behaviour, permissions or a workflow. The only additions in this task are the four documents in `docs/`.
