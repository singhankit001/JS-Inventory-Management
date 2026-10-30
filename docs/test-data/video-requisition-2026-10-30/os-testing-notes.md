# Testing Jumpstart Inventory OS with this dataset

These files are test inputs only. Nothing in the application, seed data or database was changed to produce them.

| File | Use |
|---|---|
| `inventory.json` | Structured input. Requested lines are in `lines[]`, stock seen but not requested is in `observed_stock[]`, and each line cites its video and timestamp |
| `inventory.csv` | The same records, flat, one row each (`record_type` = `requested` or `observed_not_requested`) |
| `requisition.pdf` / `requisition.html` | The human-readable draft, and the input for document-extraction tests |
| `video-analysis-report.md` | How the data was extracted and what is uncertain |

## Category mapping to the current catalogue

| Dataset category | Catalogue category (`src/lib/data/seed.ts`) |
|---|---|
| Groceries | `cat-pan` Pantry |
| Toiletries | `cat-hyg` Hygiene & cleaning (T01 could also be `cat-aid` First aid) |
| Stationery | `cat-sta` Stationery and `cat-art` Art & craft |

Only five lines have a plausible match in the demo catalogue: T01, T02, S01, S02 and S08 (see `catalogue_match_hint`). The other 33 are products the catalogue does not hold yet.

## What to test and what should happen

| Area | Input | Expected behaviour |
|---|---|---|
| Product recognition | The 38 `lines` | Each line resolves to a catalogue product **or** is flagged as a new or unknown product. 33 lines should come back unmatched; the system must not force them onto the nearest item (e.g. "Chart paper, white" ≠ "A3 drawing paper") |
| Categorisation | `category` | Groceries are routed to Pantry and toiletries to Hygiene. Paper cups (S08) are filed under Stationery because of where they are stored, while the catalogue's "Drinking cups (50)" is Pantry. Expect a category mismatch to be surfaced, not silently fixed |
| Request generation | All lines | A draft request with 38 lines for one centre. **Pantry note:** the seed request generator excludes `cat-pan` (`seed.ts:362`, `:451`), so the 14 grocery lines may only enter through manual or AI intake. Check that they can |
| Quantity and unit validation | G04/G06/G09/G13/G14 (0.5 kg), G10 (250 g), S08 (200 pcs vs a pack of 50) | Decimal kilograms are accepted. Grams convert to the catalogue's unit (`quantity_normalised` gives the gram value). 200 cups become 4 packs of 50, with the conversion shown |
| Missing quantities | T07, T08, S01–S05 (`requested_quantity: null`) | The request cannot be submitted until a quantity is entered. These lines must not default to 0 or 1 |
| Duplicate detection | G08 + G14 (`DUP-RAVA`) | A warning that rava appears twice (2 kg + 0.5 kg). It should not be merged automatically. The second sugar mention in V4 is correctly absent |
| AI-assisted intake | Run `/requests/intake` on the five source videos | Compare its draft with `lines`. A good result matches the 15 *Confirmed* lines, marks the *Needs Verification* lines as uncertain rather than guessing, and keeps the timestamps |
| Approval workflow | The submitted request | The Centre Leader submits and Head Office approves (Q02, Q03). **The recording date, 30 Oct, is after the 25th deadline (Q04),** so Head Office should get an accept/reject decision for a late request (Q08). That gate is currently missing (❌ in `docs/requirements-traceability-matrix.md`), so this dataset should expose it |
| Procurement | Approved lines | With no prices, no purchase order can be raised directly. Expect quotation requests per category (Pantry to FreshPantry or Kidz Kitchen, Hygiene to CleanNest or SafeHands, Stationery to Crayonworks or Paper Trail). Seed `unitCost` must not be used as a quoted price |
| Invoice data extraction | `requisition.pdf` | The extractor finds 38 line items, recognises the document as a **pro forma requisition, not an invoice**, and returns `null` for invoice number, supplier, GSTIN, tax and grand total. Any non-null value there is a hallucination |
| Auditability | `source` on each line | Every line traces to a video file, an audio timestamp and, where available, a frame timestamp. The audit log should keep the evidence link through approval and ordering |
| Stock counts | `observed_stock` (e.g. OS01 chalk 5 boxes, OS03 about 12 ink refills, OG05 cocoa 2 tubs) | Usable as count-sheet inputs. Vague values ("Enough", "Large amount") should be rejected or need a number |

## Edge cases in the data

- **Fractional and mixed units:** 0.5 kg, 250 g, 200 pcs, 92 sheets across seven colour lines.
- **Arithmetic stated in speech:** S07 masking tape = 2 per class × 5 classes = 10. Whether the 3 on hand should be subtracted is not stated.
- **Contradiction:** S10 green chart paper is 18, then later "green is huge for us … we don't need anything".
- **Brand on the shelf is not a brand request.** G05 lists Gowardhan ghee as observed stock; the system should not lock the order to that brand.
- **Centre not identified.** Box labels say `KR-`. The system should ask for a centre rather than guess between Karve Road and Kharadi.
- **Spoken name differs from the label:** OG02 was said as "baking soda", but the label reads Weikfield *Baking Powder*.
- **Transcription-sensitive names:** T03 "hair pick" (Harpic), G09 "shave" (sevai), S05 "CD markers" (permanent markers), OS15 "German sheets" (foam sheets).
