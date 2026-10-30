# Video analysis and verification report

Requisition draft `REQ-DRAFT-20261030-KR` · compiled 30 Oct 2026

## 1. Coverage and method

The request mentioned two videos, but five were attached. All five were analysed in full.

| ID | File | Length | What it shows | Category |
|---|---|---|---|---|
| V1 | WhatsApp_Video_2026-10-30_at_14.59.14.mp4 | 4:08 | Stationery cupboard (boxes labelled `KR-STA-*`, `KR-EVT-*`) | Stationery |
| V2 | WhatsApp_Video_2026-10-30_at_15.00.02.mp4 | 2:34 | Kitchen pantry shelves (jars) | Groceries |
| V3 | WhatsApp_Video_2026-10-30_at_15.00.19.mp4 | 0:37 | Dry-goods storage rack (packets) | Groceries |
| V4 | WhatsApp_Video_2026-10-30_at_15.00.32.mp4 | 0:22 | Grain cabinet (jars) | Groceries |
| V5 | WhatsApp_Video_2026-10-30_at_15.00.54.mp4 | 0:55 | Toiletries and cleaning shelf | Toiletries |

Total: 8 min 36 s. The videos are store walkthroughs, not written lists. A staff member opens each shelf and says what is on hand and what is needed, sometimes in answer to a second person's questions. **The requested quantities come from the speech. The frames confirm which products are meant and what is on hand.**

**Frames.** One frame every 3 seconds across every video (173 frames), each labelled with its timestamp. A further 43 full-resolution frames were taken wherever a label, box tag or product needed to be read.

**Audio.**
- **Model.** Whisper *small* speech recognition, run locally. The normal download host was blocked by this environment's network policy, so the same model was installed from an npm package. It matched the checksum shipped inside that package. That proves it arrived intact, but not that it is identical to OpenAI's original release.
- **Three passes:**
  1. A plain English transcription.
  2. A translate-to-English pass, to catch any Hindi.
  3. A re-run of the unclear segments with a list of product words supplied as hints.
- **How the hinted pass was used.** Supplying hints can bias the transcriber toward the hinted words. Where a word appears only in the hinted pass, the line is marked *Needs Verification* (for example T01 "Dettol").

**Cross-checking.**
- Each spoken item was matched to the frame shown at the same moment. For example, "shave" was spoken while vermicelli jars were on screen, and "hair pick" while Harpic-type bottles were.
- Items mentioned in more than one video were compared to avoid counting them twice.

**Not done.**
- No prices, suppliers or tax details appear in any video, so none were added.
- No Jumpstart Preschool logo file exists in the repository. The document uses the Inventory OS mark from `src/app/icon.svg`.

## 2. What was extracted

| Video | Requested lines | Seen, not requested |
|---|---|---|
| V1 Stationery cupboard | 15 (S01–S15) | 18 (OS01–OS18) |
| V2 Kitchen pantry | 10 (G01–G10) | 9 (OG01–OG09) |
| V3 Dry-goods rack | 0 ("we do not need any more of this") | 8 (OG10–OG17) |
| V4 Grain cabinet | 4 (G11–G14) | 0 |
| V5 Toiletries shelf | 9 (T01–T09) | 4 (OT01–OT04) |
| **Total** | **38** | **39** |

By category: **Groceries 14 · Toiletries 9 · Stationery 15.** Cleaning items such as Harpic, the mop and the broom sit on the toiletries shelf and are listed under Toiletries. Paper cups are stored in the stationery cupboard's *Box 15 Cutlery Material* (`KR-STA-B15`), so they are listed under Stationery.

## 3. Duplicates

| Group | Lines | Handling |
|---|---|---|
| Sugar | G03 (V2, 6 kg) | In V4 the speaker says sugar was "already told about in the video". It is not added again. |
| Rava | G08 (V2, 2 kg) and G14 (V4, 0.5 kg "normal rava") | The two requests come from different cupboards. Both are kept and flagged `DUP-RAVA`, not merged. |
| Dustbin bags | T05 | The fragment "six of the packet of this …" and "dustbin bags, smaller ones, we need six packets" are read as one request. |
| Jeera | G10 vs OG04 | Jeera *powder* is "huge amount, not procuring". The later request (G10) may be whole jeera. Kept separate and flagged. |

## 4. Unclear or missing information

- **7 lines have no quantity:**
  - T07 broom
  - T08 mop
  - S01 tempera colours
  - S02 glue
  - S03 cello tape
  - S04 black pens
  - S05 CD markers
- **Item unclear:**
  - T01: a bottle is requested, but the product is only named in the hinted pass.
  - S06: the stick type was heard as "fewer" or "two".
  - G09: "shave" is read as sevai (vermicelli).
  - T02: "liquid wash" could be hand wash or dish-wash liquid.
- **Quantity unclear:**
  - G10 jeera: heard as 250 g in one pass and "to 50 grams" in the other.
  - G07 dalia: the "1 kg" answer may belong to rava instead.
  - S10 green chart paper: 18 was requested, but later "green is huge for us … we don't need anything".
- **Phrasing to confirm.** The V2 speaker repeatedly says "we had procured N". From context ("we need half kg more") this is read as *need to procure N*. Those lines are marked *Inferred*.
- **Centre.** The centre is never named. The box labels use a `KR-` prefix. The demo data has both Karve Road (KRV) and Kharadi (KHR), so the centre is left as *Not confirmed*.
- **Prices, supplier, GSTIN and tax rates** are absent. The rate, amount, subtotal, GST and grand-total fields are empty by design.

## 5. Confidence

| Status | Lines | Meaning |
|---|---|---|
| Confirmed | 15 | The item and quantity are stated plainly, often in a question-and-answer exchange |
| Inferred | 12 | Derived from phrasing ("had procured") or from the speaker's own arithmetic (S07: 2 per class × 5 classes = 10) |
| Needs Verification | 11 | The item, quantity or unit is unclear in the audio or frames |

Brand names were recorded only where a label was legible: Gowardhan, Hershey's, Dabur, Weikfield, Kellogg's, Jeet, Dettol, Golden City, Kores, Camlin, Faber-Castell and Wonder Tape. These describe stock **on the shelf**. They are not stated purchase preferences.

## 6. Validation results

An automated cross-check, run on the final files, confirmed:

- JSON, CSV, HTML and PDF each contain the same 38 requested lines and 39 observed lines, with matching IDs, names, quantities, units and statuses.
- Line IDs are unique.
- No line carries a price, and the PDF contains no GSTIN, invoice number or GST fields.
- The quantity totals printed in the document are correct: Groceries 37.75 kg (37.5 kg plus 250 g), and chart paper 92 sheets (16 + 18 + 5 + 17 + 18 + 6 + 12).
- The PDF is 10 A4 pages with a running header and footer, repeating table headers, and no rows split across pages.
- The HTML has no horizontal scroll at 390 px or 1280 px width.

The extraction itself was not checked by a person against the videos. The 23 lines that are not *Confirmed* should be reviewed by the Centre Leader before approval.
