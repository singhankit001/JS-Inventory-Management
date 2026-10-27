import { describe, expect, it } from "vitest";
import { applyTable, filterOptions, paginate, type FilterDef, type Row } from "./table-logic";

const rows: Row[] = [
  { id: "1", name: "Asha", status: { label: "Active", tone: "green" }, roles: "Admin, Finance", centre: "Powai", amount: 300 },
  { id: "2", name: "Bina", status: { label: "Suspended", tone: "red" }, roles: "Finance", centre: "Andheri", amount: 1200 },
  { id: "3", name: "Chirag", status: { label: "Active", tone: "green" }, roles: "Centre manager", centre: "Andheri", amount: 50 },
  { id: "4", name: "Devi", status: { label: "Active", tone: "green" }, roles: "Admin", centre: null, amount: 900 },
];
const defs: FilterDef[] = [{ key: "status", label: "status" }, { key: "centre", label: "centre" }, { key: "roles", label: "role", split: "," }];
const base = { keys: ["name", "centre"], query: "", filters: {}, defs, sort: null };
const ids = (r: Row[]) => r.map((x) => x.id);

describe("filterOptions", () => {
  it("returns distinct, sorted, non-empty labels", () => {
    expect(filterOptions(rows, defs[0]!)).toEqual(["Active", "Suspended"]);
    expect(filterOptions(rows, defs[1]!)).toEqual(["Andheri", "Powai"]);
  });
  it("splits list cells", () => expect(filterOptions(rows, defs[2]!)).toEqual(["Admin", "Centre manager", "Finance"]));
});

describe("applyTable", () => {
  it("AND-combines filters", () => {
    expect(ids(applyTable(rows, { ...base, filters: { status: "Active" } }))).toEqual(["1", "3", "4"]);
    expect(ids(applyTable(rows, { ...base, filters: { status: "Active", centre: "Andheri" } }))).toEqual(["3"]);
    expect(applyTable(rows, { ...base, filters: { status: "Suspended", centre: "Powai" } })).toEqual([]);
  });
  it("matches any part of a split cell", () => expect(ids(applyTable(rows, { ...base, filters: { roles: "Finance" } }))).toEqual(["1", "2"]));
  it("ignores filters without a definition", () => expect(applyTable(rows, { ...base, filters: { nope: "x" } })).toHaveLength(4));
  it("composes search with filters, case-insensitively", () => expect(ids(applyTable(rows, { ...base, query: " andh ", filters: { status: "Active" } }))).toEqual(["3"]));
  it("sorts numbers numerically and labels alphabetically, both directions, without mutating input", () => {
    expect(ids(applyTable(rows, { ...base, sort: { key: "amount", dir: 1 } }))).toEqual(["3", "1", "4", "2"]);
    expect(ids(applyTable(rows, { ...base, filters: { status: "Active" }, sort: { key: "name", dir: -1 } }))).toEqual(["4", "3", "1"]);
    expect(ids(rows)).toEqual(["1", "2", "3", "4"]);
  });
});

describe("paginate", () => {
  const items = Array.from({ length: 10 }, (_, i) => i);
  it("slices pages", () => expect(paginate(items, 1, 4)).toEqual({ pages: 3, current: 1, slice: [4, 5, 6, 7] }));
  it("clamps an out-of-range page after the result set shrinks", () => expect(paginate(items.slice(0, 3), 5, 4)).toEqual({ pages: 1, current: 0, slice: [0, 1, 2] }));
  it("reports one page when empty", () => expect(paginate([], 0, 4)).toEqual({ pages: 1, current: 0, slice: [] }));
});
