# Business requirements Q01–Q58

Source: "Jumpstart Procurement & Inventory Management System — Complete Questions and Answers (Q01–Q58)", supplied by the client on 28 Oct 2026. These answers are the authoritative business specification. Where an earlier prototype assumption disagrees with an answer, the answer wins.

Each answer is restated as a testable rule. "Open" marks a point the answer leaves undecided.

## Section 1 · Organisation & workflow

| ID | Question | Confirmed answer | Rule |
|---|---|---|---|
| Q01 | Centres today and in 24 months | 15 centres today; expansion depends on Head Office plans | The system holds 15 operating centres. Open: names of the 4 centres not published on jumpstartpreschool.in |
| Q02 | Who submits the monthly request | Centre Leaders | Only a Centre Leader submits a centre's monthly request |
| Q03 | Final approval authority and value limit | Head Office; no fixed spending limits; decisions consider the available CAPEX budget | Head Office is the only final approver. No value threshold routes approval elsewhere |
| Q04 | Submission deadline | 25th of each month | Monthly requests are due by the 25th |
| Q05 | Revision after submission | Yes, until procurement begins | A centre can revise a submitted request until the first purchase order or quotation for it starts |
| Q06 | Centralised or hierarchical approval | Centralised at Head Office | One approval stage, at Head Office |
| Q07 | Urgent mid-month requests | Regular urgent requests not allowed; special or emergency requests may be considered by Head Office | No routine mid-month channel. An exceptional request needs a Head Office accept or reject decision |
| Q08 | Missed deadline | Head Office decides whether to accept or reject a special or emergency request made after the 25th | A post-deadline submission is held for a Head Office accept/reject decision before normal review |
| Q09 | Who receives and confirms deliveries | The Centre Head | The Centre Head records and confirms goods receipt at their centre |
| Q10 | One person, several centres | Not allowed | A centre-scoped user is assigned exactly one centre |

## Section 2 · Inventory & catalogue

| ID | Question | Confirmed answer | Rule |
|---|---|---|---|
| Q11 | Standard catalogue | A complete central catalogue exists | The catalogue is migrated, not designed from scratch |
| Q12 | Central or local buying | Both: bulk centrally, emergency purchases locally by centres | Support central POs and recorded local emergency purchases |
| Q13 | Standard units | Yes | Every item has one standard unit (kg, L, pcs, …) |
| Q14 | Brand interchangeability | Equivalent brands are interchangeable | Items are generic; brand is not part of item identity |
| Q15 | Inter-centre transfers | No; centres are independent | No transfer movements between centres |
| Q16 | Expiry and batch | Required for applicable items | Batch number and expiry date captured for flagged items |
| Q17 | Central store | None; each centre keeps its own stock | No warehouse location or central stock |
| Q18 | Pack sizes and MOQs | Still to be collected | Open: supplier pack size and minimum order quantity |
| Q19 | Daily perishables in monthly request | No; ordered separately | Daily perishables (milk, vegetables) are excluded from monthly requests. Open: whether the system manages the daily flow at all |
| Q20 | Who adds or renames catalogue items | Head Office | Catalogue create and rename belong to Head Office |

## Section 3 · Financial management

| ID | Question | Confirmed answer | Rule |
|---|---|---|---|
| Q21 | Centre monthly budget | No formal centre-level monthly budget today | Do not present centre monthly budgets as existing policy |
| Q22 | Estimate source | Standard rate card | Request estimates use the rate card price |
| Q23 | Budget check before procurement | Required for selected categories only | A budget check runs only for categories flagged as budget-controlled. Open: which categories and which limits |
| Q24 | Override authority and record | Head Office approves beyond the limit; the reason must be recorded | An over-limit approval requires a written justification stored with the decision |
| Q25 | Who records actual costs, from what | Head Office, from supplier bills, invoices, receipts or other purchase records | Head Office enters actual cost with a supporting document reference |
| Q26 | GST in budgets and estimates | Depends on the vendor | GST treatment is a vendor attribute (inclusive, exclusive or not registered) |
| Q27 | Financial year | Indian FY, April–March | Periods roll up to FY Apr–Mar |
| Q28 | Budget rollover | No | Unused monthly amounts do not carry forward |

## Section 4 · AI & recordings (future integration)

| ID | Question | Confirmed answer | Rule |
|---|---|---|---|
| Q29 | Languages | Hindi, Marathi, English | Voice intake supports hi, mr, en |
| Q30 | Audio, video, images | All three; video helps identify items | Intake accepts audio, video and images |
| Q31 | Max recording length | About 10–20 minutes | Recording limit configurable in the 10–20 minute range |
| Q32 | Retention of originals | One month or until the next review is received; rule for delayed reviews to be clarified | Original video deleted after one month or after review, whichever applies. Open: delayed-review case |
| Q33 | Acceptable error rate | About 3–5%, with manual review | Every extraction is human-verified before it becomes a request |
| Q34 | Unidentified items | Ask the staff member to repeat the item | Unrecognised items prompt a re-record or clarification, never a guess |
| Q35 | Children in recordings | Not involved; staff only | Intake is staff-only; guidance says not to record children |
| Q36 | Consent | Staff consent already in place | Consent exists outside the system. Open: whether the app must show or store it |
| Q37 | AI provider | Chosen later on availability, suitability and security | Open: provider. Integration stays behind a provider contract |

## Section 5 · Data & analytics

| ID | Question | Confirmed answer | Rule |
|---|---|---|---|
| Q38 | Historical requests | Available in multiple formats | A one-time import is needed. Open: formats and volume |
| Q39 | Current stock tracking | Opening and closing stock recorded manually; scanning may come later | Stock counts are manual entries; scanning is optional later |
| Q40 | Enrolment and attendance | Available digitally for every centre | Monthly enrolment and attendance can be imported per centre |
| Q41 | Actual consumption | Opening + purchases − closing; wastage, returns and adjustments tracked separately; recorded manually by responsible staff | Consumption is derived from counts and receipts, not logged per use. Wastage, returns and adjustments are separate movement types |
| Q42 | Leadership KPIs | Centre-level usage, item-wise consumption and wastage, spend per centre, optimisation opportunities | Dashboards show these four KPI families |
| Q43 | Centre differences | Meal programmes, age groups, operating hours differ | Centre profile holds these attributes; comparisons normalise for them |
| Q44 | Report frequency and format | Live dashboard with filters | Dashboards are live and filterable |
| Q45 | Supplier price history | Needs consolidating | Open: source data. Price history builds from POs going forward |

## Section 6 · Infrastructure

| ID | Question | Confirmed answer | Rule |
|---|---|---|---|
| Q46 | Peak users | To be decided | Open |
| Q47 | Cloud platform and region | To be decided | Open |
| Q48 | Uptime and support | 99.9% uptime, 24/7 support | Non-functional target for the production platform |
| Q49 | Backup and recovery | Backups every 6–12 hours; recovery within 8 hours | RPO ≤ 12 h, RTO ≤ 8 h |
| Q50 | Integrations | Google Workspace and Google Sheets | Sign-in and data exchange with Google Workspace and Sheets |
| Q51 | Centre Head devices | Android phones, reliable 4G/5G | Centre Head screens are Android-first and mobile-first |

## Section 7 · Deployment & ownership

| ID | Question | Confirmed answer | Rule |
|---|---|---|---|
| Q52 | Business owner | Central Operations Head | Product decisions route to the Central Operations Head |
| Q53 | Day-to-day catalogue changes | Central Procurement Team | Procurement maintains catalogue details day to day; Head Office governs create and rename (Q20) |
| Q54 | Support and training | To be decided | Open |
| Q55 | Build approach | Entirely in-house | No SaaS customisation or agency build |
| Q56 | Budget | ₹10,000 stated; split and scope to be decided | Open: whether ₹10,000 covers build, operation or both |
| Q57 | MVP success | Digital submission, faster approval, lower procurement cost, better budget compliance, accurate AI extraction, stock visibility, reliable dashboards, less manual entry, successful pilot | All nine criteria must be met |
| Q58 | Pilot | Karve Road (KR) centre, until the platform works well | Pilot scope is Karve Road. Open: measurable exit criteria |
