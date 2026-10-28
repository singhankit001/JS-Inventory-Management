# Requirements traceability matrix · Q01–Q58

Checked against branch `claude/nifty-volta-kx7h8w` at commit `683ee15`, by reading code and behaviour, not page names. Rules are stated in [business-requirements-q01-q58.md](business-requirements-q01-q58.md). `CH-xx` refers to an item in [proposed-changes-for-approval.md](proposed-changes-for-approval.md).

**Status key:** ✅ Compliant · 🟡 Partially compliant · ❌ Missing · ⚠️ Conflicting · ❓ Pending business clarification · ⏸ Not applicable to the current frontend phase

**Totals (58):** ✅ 10 · 🟡 14 · ❌ 12 · ⚠️ 10 · ❓ 6 · ⏸ 6

## Section 1 · Organisation & workflow

| ID | Rule | Existing implementation | Status | Gap | Proposed fix | UI impact | Approval |
|---|---|---|---|---|---|---|---|
| Q01 | 15 operating centres | `src/lib/data/seed.ts` `centreSpec` holds the 11 centres published on jumpstartpreschool.in. The 4 unpublished ones were removed on request | ⚠️ | 4 centres missing; names unknown | CH-01 | Centre lists, counts, charts | Yes + names needed |
| Q02 | Centre Leader submits | `requests.create` only on `centre_leader` (`src/lib/auth/permissions.ts`); `submitRequest` in `src/app/actions/requests.ts` | ✅ | — | — | — | — |
| Q03 | Head Office is final approver, no value limits | Requests: Head Office approves (`REQUEST` machine, `src/domain/workflows.ts`). POs: every raised PO opens a `stage: "final"` approval that only `ceo` can authorise (`procurement.authorise`); value thresholds `AUTH_THRESHOLD` ₹25,000 (seed) and `criticalApprovalThreshold` ₹60,000 (`src/features/admin/config-store.ts`, `/admin/configuration`) | ⚠️ | A second, CEO-held authorisation stage and fixed value thresholds | CH-03 | Orders page actions, approval queue, configuration page | Yes |
| Q04 | Due by the 25th | `requestWindow { opensOnDay: 1, closesOnDay: 25 }`; centre dashboard countdown and overdue state (`src/features/dashboards/centre.ts`) | ✅ | — | — | — | — |
| Q05 | Revise until procurement begins | `submit` allowed from `draft` and `revision_requested` only; `/requests/[id]` edit button only in those states | 🟡 | A centre cannot revise a submitted or approved request unless Head Office returns it | CH-08 | New "Revise" action on request detail | Yes |
| Q06 | Single, centralised approval | Head Office stage for requests; extra CEO `final` stage for POs and emergencies | ⚠️ | Two-stage (hierarchical) for POs and emergencies | CH-03 | As Q03 | Yes |
| Q07 | No routine mid-month requests; exceptional ones considered by Head Office | `/requests/emergency` lets a Centre Leader raise an out-of-cycle request at any time (`raiseEmergency`); it lands at `stage: "final"`, flagged critical | 🟡 | Framed as an always-available channel; lands at the CEO-held final stage, not Head Office | CH-09 | Emergency page copy and routing | Yes |
| Q08 | After the 25th, Head Office accepts or rejects | `submitRequest` has no deadline check; late routine requests go straight to normal review | ❌ | No accept/reject gate for late submissions | CH-07 | New request state and badge | Yes |
| Q09 | Centre Head confirms deliveries | Separate **Receiving Staff** role records receipts (`receiving.record`); `centre_leader` lacks `receiving.record` | ⚠️ | Wrong role confirms deliveries | CH-10 | Role permissions, receiving dashboard, demo accounts | Yes |
| Q10 | One person, one centre | Demo user Suresh Pillai (`u-rcv`) is assigned Baner **and** Wakad; `inviteUser`/`assignRoles` (`src/app/actions/admin.ts`) accept several `centreIds` for centre-scoped roles; `CentreSelect` exists for multi-centre sessions | ⚠️ | Multi-centre assignment allowed and seeded | CH-10 | Admin user form, demo data | Yes |

## Section 2 · Inventory & catalogue

| ID | Rule | Existing implementation | Status | Gap | Proposed fix | UI impact | Approval |
|---|---|---|---|---|---|---|---|
| Q11 | Central catalogue exists | `/inventory/catalogue` with 24 seeded products, categories and units | 🟡 | Real catalogue not imported | Backend import (no UI change) | None | No (data) |
| Q12 | Central bulk + local emergency purchases | Central POs only (`/procurement/orders`) | ❌ | No record of local emergency purchases | CH-09 | New form on emergency page | Yes |
| Q13 | Standard units | `Product.uomId` → `UnitOfMeasure` (pcs, box, pack, L, kg) | ✅ | — | — | — | — |
| Q14 | Equivalent brands interchangeable | Products are generic, no brand field | ✅ | — | — | — | — |
| Q15 | No inter-centre transfers | `StockMovement.type` includes `transfer_in`/`transfer_out` (`src/domain/types.ts`); labels in `src/features/inventory/stock.ts`; "Transfers" group on `/inventory/movements`; counted in reconciliation (`src/features/inventory/counts.ts`). Seed creates none | ⚠️ | Model and UI imply transfers exist | CH-04 | Movements page group, legend | Yes |
| Q16 | Batch and expiry for applicable items | `/inventory/alerts` shows a "Phase 2" placeholder; no batch or expiry fields anywhere | ❌ | Not modelled | CH-12 | Receipt form fields, alerts panel | Yes |
| Q17 | No central store | No warehouse location; all stock is per centre | ✅ | — | — | — | — |
| Q18 | Pack sizes and MOQs pending | Not modelled | ❓ | Data not collected | Await data, then model on supplier-product | None now | — |
| Q19 | Daily perishables excluded | "Pantry" category holds shelf-stable items (milk powder, biscuits, cups); no daily-perishable items or flow | ❓ | Whether milk powder counts as perishable; whether daily flow is in scope | CH-21 | None until decided | Clarify |
| Q20 | Head Office adds and renames items | Catalogue is read-only; no create or rename action exists | ❌ | No catalogue management | CH-11 | New catalogue actions | Yes |

## Section 3 · Financial management

| ID | Rule | Existing implementation | Status | Gap | Proposed fix | UI impact | Approval |
|---|---|---|---|---|---|---|---|
| Q21 | No formal centre monthly budget | `Centre.monthlyBudget` and 12 months of `Budget` rows per centre (seed); `/approvals/budgets` page; centre dashboard "Budget used versus allocated"; executive "Budget utilisation" KPI and "Budget headroom" chart; "Monthly budget" tile on `/admin/users`; budget impact in request wizard and approval review; "Centres over budget" in exceptions | ⚠️ | The app presents centre monthly budgets as established policy | CH-05 | Budgets page, 4 dashboards, request and approval screens | Yes |
| Q22 | Estimates from a standard rate card | Request lines priced at `Product.unitCost` (`src/features/requests/new.ts`) | ✅ | Rate card not labelled as such | — | — | — |
| Q23 | Budget check for selected categories only | `budgetImpact` (`src/features/requests/logic.ts`) checks the whole request against the centre budget | ⚠️ | Applies to every category | CH-05 | As Q21 | Yes |
| Q24 | Over-limit approval needs a recorded reason | Approval decisions take an optional note (`decideApproval`); nothing requires a reason when over a limit | 🟡 | Justification not enforced | CH-06 | Required field in approval review | Yes |
| Q25 | Head Office records actual cost with documents | Finance role records invoices and payments (`/finance/invoices`, `/finance/payments`); demo Head Office user also holds the Finance role | 🟡 | No "actual cost" entry with document reference owned by Head Office | CH-18 | Invoice detail fields | Yes |
| Q26 | GST depends on vendor | Invoice detail shows "Tax: Not modelled (tax-free totals)" | ❌ | No GST attribute | CH-16 | Supplier form, invoice detail | Yes |
| Q27 | Indian FY Apr–Mar | Periods are calendar months; budgets cover the last 12 rolling months; no FY grouping | ❌ | No FY periods | CH-17 | Period selectors, reports | Yes |
| Q28 | No rollover | No rollover logic exists | ✅ | — | — | — | — |

## Section 4 · AI & recordings

| ID | Rule | Existing implementation | Status | Gap | Proposed fix | UI impact | Approval |
|---|---|---|---|---|---|---|---|
| Q29 | Hindi, Marathi, English | `/requests/intake` (`src/components/ai/intake-flow.tsx`) has no language choice | ❌ | No language selection | CH-19 | Intake form | Yes |
| Q30 | Audio, video, images | Upload accepts `audio/*,video/*` only | 🟡 | No images | CH-19 | Intake form | Yes |
| Q31 | 10–20 minute recordings | `MAX_RECORD_S = 300` (5 minutes) | ⚠️ | Limit too short | CH-19 | Recorder limit text | Yes |
| Q32 | Originals kept one month or until review | No retention handling; copy says the file "stays on this device" | ❓ | Delayed-review deletion rule open | CH-19 | Retention notice | Clarify |
| Q33 | 3–5% error, human review | Draft is editable before confirmation (`confirmAIDraft`); pipeline is simulated and labelled ("simulated pipeline", `DemoBanner`) | 🟡 | Verification step not made mandatory per line | CH-19 | Draft review step | Yes |
| Q34 | Ask to repeat unidentified items | Not handled | ❌ | No "repeat this item" state | CH-19 | Intake draft | Yes |
| Q35 | Staff only, no children | No guidance shown | 🟡 | Missing staff-only notice | CH-19 | Notice text | Yes |
| Q36 | Consent in place | Not shown or stored | ❓ | Whether the app must display or store consent | — | — | Clarify |
| Q37 | Provider chosen later | `int-ai` integration "not configured"; AI behind typed contracts (`src/features/ai/contracts.ts`) | ✅ | — | — | — | — |

## Section 5 · Data & analytics

| ID | Rule | Existing implementation | Status | Gap | Proposed fix | UI impact | Approval |
|---|---|---|---|---|---|---|---|
| Q38 | Historical requests in several formats | Seeded history only | ⏸ | Import pipeline (backend) | Backend | None | — |
| Q39 | Manual opening and closing counts | `/inventory/counts` opening and closing count forms (`submitStockCount`) | ✅ | — | — | — | — |
| Q40 | Enrolment and attendance available | Enrolment drives seed maths but is not on `Centre`; `/analytics` notes "enrolment is not on the centre record yet" | ❌ | Not modelled | CH-14 | Centre profile, analytics | Yes |
| Q41 | Consumption = opening + purchases − closing; wastage, returns, adjustments separate | Seed logs daily `consumption` movements as if usage were recorded per use; no wastage or return types; reconciliation (`src/features/inventory/counts.ts`) reads ledger consumption | ⚠️ | Consumption is recorded, not derived; wastage and returns missing | CH-13 | Movements, reconciliation, analytics | Yes |
| Q42 | KPIs: centre usage, item consumption and wastage, spend per centre, optimisation | Consumption and spend per centre exist (`/analytics`, `/analytics/consumption`, executive); no wastage | 🟡 | Wastage KPI missing | CH-15 | New KPI on dashboards | Yes |
| Q43 | Centres differ (meals, ages, hours) | Not modelled | ❌ | No centre profile | CH-14 | Centre profile | Yes |
| Q44 | Live, filterable dashboards | Centre selector, period pills, table filters with URL state; data is seed, not live | 🟡 | Live data needs backend | Backend | None | — |
| Q45 | Supplier price history to be consolidated | `/procurement/history` builds price history from POs | 🟡 | Historical prices not imported | Backend import | None | — |

## Section 6 · Infrastructure

| ID | Rule | Existing implementation | Status | Gap | Proposed fix | UI impact | Approval |
|---|---|---|---|---|---|---|---|
| Q46 | Peak users TBD | — | ❓ | Open | — | — | Clarify |
| Q47 | Platform and region TBD | — | ⏸ | Open | — | — | — |
| Q48 | 99.9% uptime, 24/7 support | — | ⏸ | Platform concern | — | — | — |
| Q49 | Backups 6–12 h, recovery ≤ 8 h | — | ⏸ | Platform concern | — | — | — |
| Q50 | Google Workspace and Sheets | Integrations list (`seed.ts` `integrations`): database, email, AI transcription, accounting export. No Google entries. CSV export on tables | ❌ | Not listed or planned in the UI | CH-20 | Integrations page rows | Yes |
| Q51 | Android-first for Centre Heads | Responsive layouts; mobile bottom dock; not verified on Android devices | 🟡 | No Android device testing; Centre Head screens not designed mobile-first | CH-10 (part) | — | Test first |

## Section 7 · Deployment & ownership

| ID | Rule | Existing implementation | Status | Gap | Proposed fix | UI impact | Approval |
|---|---|---|---|---|---|---|---|
| Q52 | Central Operations Head owns the system | No such role; Admin and CEO roles exist | ⏸ | Business ownership, not a system role | — | — | — |
| Q53 | Central Procurement Team makes day-to-day catalogue changes | No catalogue editing | ❌ | As Q20 | CH-11 | As Q20 | Yes |
| Q54 | Support and training TBD | — | ❓ | Open | — | — | Clarify |
| Q55 | Built in-house | This codebase | ✅ | — | — | — | — |
| Q56 | ₹10,000 budget, scope TBD | — | ⏸ | Open | — | — | — |
| Q57 | Nine MVP success criteria | Digital submission ✅; faster approval and stock visibility shown; cost reduction, budget compliance, AI accuracy and pilot success need live data | 🟡 | Most criteria need production data to measure | Backend | — | — |
| Q58 | Karve Road pilot | Karve Road exists as a centre; demo accounts and the request-journey story use Baner | 🟡 | Pilot not reflected | CH-02 | Demo accounts, journey page | Yes |
