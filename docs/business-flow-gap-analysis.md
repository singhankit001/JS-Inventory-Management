# Business flow gap analysis

Compares the prototype's workflows with Q01–Q58 ([rules](business-requirements-q01-q58.md), [matrix](requirements-traceability-matrix.md)). Nothing listed here has been changed in code. Each fix waits for approval in [proposed-changes-for-approval.md](proposed-changes-for-approval.md).

## 1. Conflicts with confirmed requirements

Ordered by how much of the product each one touches.

### 1.1 Centre monthly budgets presented as policy (Q21, Q23, Q24, Q28)
The prototype assumes every centre has a monthly allocation and checks every request against it. Q21 says no formal centre budget exists; Q23 limits checks to selected categories.

| Where | What it does |
|---|---|
| `src/domain/types.ts` `Centre.monthlyBudget`, `Budget` | Per-centre monthly allocation, commitment and spend |
| `src/lib/data/seed.ts` (budgets block) | 12 months of allocations for every centre |
| `/approvals/budgets` (`src/app/(app)/approvals/budgets/page.tsx`, `src/features/approvals/budgets.ts`) | Allocation page with `setBudget` |
| `/dashboards/centre` | "Budget used versus allocated" card |
| `/dashboards/executive` | "Budget utilisation" KPI, "Budget headroom" chart, over-budget insight |
| `/approvals/exceptions` | "Centres over budget" |
| `/admin/users` | "Monthly budget" tile per centre |
| `src/features/requests/logic.ts` `budgetImpact`, request wizard, approval review (`src/components/requests/budget-impact.tsx`) | Budget impact for every request, all categories |

### 1.2 Second, CEO-held approval stage with value thresholds (Q03, Q06, Q07)
Every PO opens a `stage: "final"` approval (`src/app/actions/procurement.ts`). Only the `ceo` role holds `procurement.authorise`. Emergency requests also land at `stage: "final"` (`src/app/actions/requests.ts` `raiseEmergency`). Value thresholds live in `AUTH_THRESHOLD` (₹25,000, seed) and `criticalApprovalThreshold` (₹60,000, `/admin/configuration`). Q03 and Q06 make Head Office the single approver with no fixed limits.

Affected states: `PurchaseOrder.status = "awaiting_authorisation"`, `Approval.stage = "final"`, `Approval.critical` (value-based). Affected screens: `/procurement/orders`, `/procurement` pipeline "Awaiting authorisation" column, `/approvals` queue, `/approvals/[id]`, `/admin/configuration`, `/dashboards/purchasing`.

### 1.3 Separate Receiving Staff, and one person across two centres (Q09, Q10)
Receipts are recorded by the **Receiving Staff** role, not the Centre Head. Demo user Suresh Pillai (`u-rcv`) covers Baner and Wakad. The admin forms accept several centres for a centre-scoped user, and the shell has a centre switcher for multi-centre sessions.

Affected: `src/lib/auth/permissions.ts` (`receiving` role, `centre_leader` lacks `receiving.record`), `src/lib/data/seed.ts` (`u-rcv`, `receiverOf`), `/dashboards/receiving`, `/receiving/receipts`, `src/app/actions/admin.ts` (`inviteUser`, `assignRoles`), `/admin/users`, sign-in account list.

### 1.4 Inter-centre transfers in the model (Q15)
`StockMovement.type` includes `transfer_in` and `transfer_out`. The movements page groups and labels them, and the reconciliation table counts them. The seed never creates one, so removing them changes no figures.

Affected: `src/domain/types.ts`, `src/features/inventory/stock.ts`, `src/features/inventory/movements.ts`, `/inventory/movements`, `src/features/inventory/counts.ts`.

### 1.5 Consumption recorded instead of derived (Q39, Q41)
The seed writes a `consumption` movement for daily usage, so the ledger behaves as if staff log every use. Q41 defines consumption as opening + purchases − closing from manual counts, with wastage, returns and adjustments recorded separately. Wastage and return movement types don't exist.

Affected: `src/lib/data/seed.ts` (consumption simulation), `StockMovement.type`, `/inventory/movements`, `/inventory/counts` reconciliation, `/analytics/consumption`, consumption charts on the executive and inventory dashboards.

### 1.6 Emergency channel framed as routine (Q07, Q08, Q12)
`/requests/emergency` offers "Raise emergency request" at any time, routed to the CEO-held final stage. Q07 rules out routine mid-month requests; exceptions need a Head Office decision. Q08 adds a Head Office accept/reject gate for anything after the 25th, which doesn't exist for routine late submissions either. Q12's local emergency purchases have no record type.

### 1.7 Request revision stops at submission (Q05)
The `REQUEST` machine lets a centre edit only `draft` and `revision_requested` requests. Q05 allows revision until procurement begins, meaning before `markOrdered` or a quotation request.

### 1.8 AI intake limits (Q29–Q35)
`/requests/intake` caps recordings at 5 minutes (Q31: 10–20), accepts no images (Q30), has no language choice (Q29), no "repeat this item" path (Q34) and no staff-only notice (Q35). It is correctly labelled as simulated.

### 1.9 Centre list and pilot (Q01, Q58)
The app has 11 centres (the published ones); Q01 says 15. Demo accounts and the request-journey story centre on Baner; Q58 names Karve Road as the pilot.

## 2. Previously suspected conflicts that are not present

| Suspected | Finding |
|---|---|
| Central warehouse | None. Stock is held per centre only (Q17 ✅) |
| Automatic approval by spending limit | No auto-approval. Thresholds route to the CEO stage instead (see 1.2) |
| Routine mid-month requests | Only the emergency channel (see 1.6) |
| Daily perishables in monthly requests | None seeded. "Pantry" items are shelf-stable; needs confirmation (Q19) |
| Fictional centres presented as verified | Removed. Centre names come from jumpstartpreschool.in; operational figures are labelled simulated |
| AI presented as active | All ten capabilities show "Demo preview — AI not connected"; intake says "simulated pipeline"; the request-journey page labels its AI step as under development |

## 3. Missing functionality

| Requirement | Missing |
|---|---|
| Q12 | Record of a local emergency purchase |
| Q16 | Batch number and expiry date at goods receipt; real expiry alerts |
| Q20, Q53 | Catalogue management: create and rename (Head Office), edit details (Central Procurement) |
| Q25 | Actual-cost entry by Head Office with a supporting-document reference |
| Q26 | Vendor GST treatment |
| Q27 | Indian financial-year periods and roll-ups |
| Q40, Q43 | Centre profile: enrolment, attendance, meal programme, age groups, operating hours |
| Q42 | Wastage KPI |
| Q50 | Google Workspace and Sheets integration (listed on the integrations page as planned) |

## 4. Backend dependencies (no frontend change needed)

- Production database and repository implementation behind `src/lib/data/provider.ts` (`DATA_PROVIDER` other than `seed`).
- Real authentication; sign-in is demo-only today. Q50 makes Google Workspace the obvious identity provider.
- Imports: central catalogue (Q11), historical requests in several formats (Q38), enrolment and attendance (Q40), supplier price history (Q45), pack sizes and MOQs once collected (Q18).
- Live data for dashboards (Q44) and MVP measurement (Q57).
- Platform targets: 99.9% uptime and 24/7 support (Q48), backups every 6–12 h with recovery within 8 h (Q49), platform and region (Q47).

## 5. AI integration dependencies (Q29–Q37)

All ten capabilities stay "Under development". When integration starts:

1. **Provider (Q37):** choose on availability, suitability and security. Implement behind the existing contracts in `src/features/ai/contracts.ts`.
2. **Speech (Q29):** Hindi, Marathi and English recognition, including mixed-language speech.
3. **Media (Q30, Q31):** audio, video and images; recordings of 10–20 minutes; upload sizing for 20-minute video on 4G (Q51).
4. **Retention (Q32):** delete original video after one month or after review. The delayed-review case needs a rule.
5. **Verification (Q33, Q34):** human review of every extracted line; flag unidentified items and ask staff to repeat them. Track the error rate against the 3–5% target.
6. **Privacy (Q35, Q36):** staff-only capture, no children; decide whether consent is shown or stored in-app.
7. **Catalogue matching:** needs the real catalogue (Q11) and interchangeable-brand rules (Q14).

## 6. Remaining business questions

1. **Q01:** names, codes and cities of the 4 centres not on the public website.
2. **Q23, Q24:** which categories are budget-controlled, what their limits are, and whether limits are per centre, per category or network-wide.
3. **Q03, Q21:** should the CAPEX budget Head Office considers be shown in the app, and at what level?
4. **Q05:** does "procurement begins" mean the first quotation request or the first purchase order?
5. **Q08, Q07:** may a centre submit an exceptional request before the 25th, or only after?
6. **Q09:** should the Receiving Staff role be retired, or kept for centres that have one, limited to a single centre?
7. **Q19:** is milk powder a daily perishable? Does the system handle the daily perishable flow at all?
8. **Q32:** what happens to a recording when its review runs past one month?
9. **Q36:** must the app display or record staff consent?
10. **Q58:** what measurable criteria end the Karve Road pilot?
11. **Q46, Q47, Q54, Q56:** peak users, platform and region, support ownership, budget split.
