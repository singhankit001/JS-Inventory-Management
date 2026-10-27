import { describe, expect, it } from "vitest";
import {
  AI_JOB, allowedCommands, APPROVAL, GOODS_RECEIPT, INVOICE, MONTHLY_REQUEST, PURCHASE_ORDER, SUPPLIER_QUOTATION, transition,
} from "./workflows";

describe("monthly request", () => {
  it("runs the routine path draft → submitted → approved → ordered → fulfilled", () => {
    expect(transition(MONTHLY_REQUEST, "draft", "submit")).toEqual({ ok: true, to: "submitted", permission: "requests.create" });
    expect(transition(MONTHLY_REQUEST, "submitted", "approve")).toMatchObject({ ok: true, to: "approved", permission: "requests.approve" });
    expect(transition(MONTHLY_REQUEST, "approved", "markOrdered")).toMatchObject({ ok: true, to: "ordered" });
    expect(transition(MONTHLY_REQUEST, "ordered", "fulfil")).toMatchObject({ ok: true, to: "fulfilled" });
  });
  it("lets a returned request be resubmitted, and the emergency path submit straight from draft", () => {
    expect(transition(MONTHLY_REQUEST, "revision_requested", "submit")).toMatchObject({ ok: true, to: "submitted" });
    expect(transition(MONTHLY_REQUEST, "draft", "raiseEmergency")).toMatchObject({ ok: true, to: "submitted" });
    expect(transition(MONTHLY_REQUEST, "revision_requested", "raiseEmergency").ok).toBe(false);
  });
  it("refuses skipping review and anything after a terminal status", () => {
    expect(transition(MONTHLY_REQUEST, "draft", "approve")).toEqual({ ok: false, reason: "Cannot approve a request that is draft." });
    expect(allowedCommands(MONTHLY_REQUEST, "rejected")).toEqual([]);
    expect(allowedCommands(MONTHLY_REQUEST, "fulfilled")).toEqual([]);
    expect(allowedCommands(MONTHLY_REQUEST, "submitted")).toEqual(["requestRevision", "approve", "reject"]);
  });
});

describe("approval", () => {
  it("decides only pending approvals, with the permission of the subject's approver", () => {
    expect(transition(APPROVAL, "pending", "approve", { subjectType: "purchase_order" })).toMatchObject({ ok: true, permission: "procurement.authorise" });
    expect(transition(APPROVAL, "pending", "reject", { subjectType: "invoice" })).toMatchObject({ ok: true, to: "rejected", permission: "finance.manage" });
    expect(transition(APPROVAL, "approved", "reject", { subjectType: "monthly_request" }).ok).toBe(false);
  });
});

describe("supplier quotation", () => {
  it("accepts only received quotes and can decline before or after receipt", () => {
    expect(transition(SUPPLIER_QUOTATION, "requested", "accept").ok).toBe(false);
    expect(transition(SUPPLIER_QUOTATION, "received", "accept")).toMatchObject({ ok: true, to: "accepted" });
    expect(transition(SUPPLIER_QUOTATION, "requested", "decline")).toMatchObject({ ok: true, to: "declined" });
    expect(allowedCommands(SUPPLIER_QUOTATION, "accepted")).toEqual([]);
  });
});

describe("purchase order", () => {
  it("needs authorisation before it can be received", () => {
    expect(transition(PURCHASE_ORDER, "draft", "authorise").ok).toBe(false);
    expect(transition(PURCHASE_ORDER, "awaiting_authorisation", "authorise")).toEqual({ ok: true, to: "issued", permission: "procurement.authorise" });
    expect(transition(PURCHASE_ORDER, "awaiting_authorisation", "receivePart").ok).toBe(false);
    expect(transition(PURCHASE_ORDER, "partially_received", "receiveAll")).toMatchObject({ ok: true, to: "received" });
  });
  it("cannot be cancelled once goods have arrived; received and cancelled are terminal", () => {
    expect(transition(PURCHASE_ORDER, "issued", "cancel")).toMatchObject({ ok: true, to: "cancelled" });
    expect(transition(PURCHASE_ORDER, "partially_received", "cancel").ok).toBe(false);
    expect(allowedCommands(PURCHASE_ORDER, "received")).toEqual([]);
    expect(allowedCommands(PURCHASE_ORDER, "cancelled")).toEqual([]);
  });
});

describe("goods receipt", () => {
  it("is confirmed or flagged once, then final", () => {
    expect(allowedCommands(GOODS_RECEIPT, "pending_confirmation")).toEqual(["confirm", "flagDiscrepancy"]);
    expect(transition(GOODS_RECEIPT, "confirmed", "flagDiscrepancy").ok).toBe(false);
    expect(allowedCommands(GOODS_RECEIPT, "discrepancy")).toEqual([]);
  });
});

describe("invoice", () => {
  it("gates approval on the three-way match", () => {
    expect(transition(INVOICE, "received", "approve", { match: "price_mismatch" })).toEqual({
      ok: false, reason: "Three-way match failed (price mismatch); query the invoice instead.",
    });
    expect(allowedCommands(INVOICE, "received", { match: "unmatched" })).toEqual(["query"]);
    expect(transition(INVOICE, "query", "approve", { match: "matched" })).toMatchObject({ ok: true, to: "approved" });
  });
  it("pays only approved invoices and stops at paid", () => {
    expect(transition(INVOICE, "received", "pay", { match: "matched" }).ok).toBe(false);
    expect(transition(INVOICE, "approved", "pay", { match: "matched" })).toMatchObject({ ok: true, to: "paid" });
    expect(allowedCommands(INVOICE, "paid", { match: "matched" })).toEqual([]);
  });
});

describe("AI processing job", () => {
  it("routes request drafts through human review, confirmed by the matching role", () => {
    expect(transition(AI_JOB, "queued", "start", { kind: "audio_request" })).toMatchObject({ ok: true, to: "processing" });
    expect(transition(AI_JOB, "processing", "finish", { kind: "audio_request" }).ok).toBe(false);
    expect(transition(AI_JOB, "processing", "finish", { kind: "insight" })).toMatchObject({ ok: true, to: "completed" });
    expect(transition(AI_JOB, "needs_review", "confirm", { kind: "invoice_ocr" })).toMatchObject({ ok: true, permission: "finance.manage" });
    expect(allowedCommands(AI_JOB, "failed", { kind: "video_request" })).toEqual([]);
  });
});

it("ignores inherited object keys passed as commands", () => {
  expect(transition(PURCHASE_ORDER, "draft", "toString" as never).ok).toBe(false);
});
