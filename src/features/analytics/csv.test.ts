import { describe, expect, it } from "vitest";
import { buildCsv } from "./csv";

describe("buildCsv", () => {
  const cols = [{ key: "name", header: "Name" }, { key: "amount", header: "Amount (₹)", kind: "money" as const }, { key: "qty", header: "Qty", kind: "count" as const }];
  it("writes a header, rupees with two decimals and CRLF rows", () => {
    expect(buildCsv(cols, [{ name: "Andheri", amount: 123456, qty: 3 }, { name: "Powai", amount: 0, qty: null }])).toBe("Name,Amount (₹),Qty\r\nAndheri,1234.56,3\r\nPowai,0.00,");
  });
  it("quotes commas, quotes and newlines", () => {
    expect(buildCsv([cols[0]!], [{ name: 'Glue, "big"\npack' }])).toBe('Name\r\n"Glue, ""big""\npack"');
  });
  it("neutralises formula injection but keeps negative numbers", () => {
    expect(buildCsv([cols[0]!, cols[1]!], [{ name: "=HYPERLINK(1)", amount: -500 }])).toBe("Name,Amount (₹)\r\n'=HYPERLINK(1),-5.00");
  });
});
