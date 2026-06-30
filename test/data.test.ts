import { describe, it, expect } from "vitest";
import { parseData, serializeData } from "../src/server/conversion/converters/data.js";

describe("data converter", () => {
  it("round-trips JSON -> YAML -> JSON", () => {
    const value = { name: "Ada", langs: ["js", "ts"], nested: { ok: true, n: 3 } };
    const yaml = serializeData("yaml", value);
    expect(parseData("yaml", yaml)).toEqual(value);
  });

  it("converts an array of objects to CSV with a header row", () => {
    const rows = [
      { id: 1, name: "Ada" },
      { id: 2, name: "Linus, the" },
    ];
    const csv = serializeData("csv", rows);
    expect(csv).toContain("id,name");
    // value with a comma must be quoted
    expect(csv).toContain('"Linus, the"');
  });

  it("parses CSV back into objects, honouring quotes and newlines", () => {
    const csv = 'id,note\n1,"hello, world"\n2,"line1\nline2"\n';
    const parsed = parseData("csv", csv) as Record<string, string>[];
    expect(parsed).toHaveLength(2);
    expect(parsed[0]).toEqual({ id: "1", note: "hello, world" });
    expect(parsed[1].note).toBe("line1\nline2");
  });

  it("round-trips TSV", () => {
    const rows = [{ a: "1", b: "2" }];
    const tsv = serializeData("tsv", rows);
    expect(tsv).toContain("a\tb");
    expect(parseData("tsv", tsv)).toEqual(rows);
  });

  it("serialises JSON to XML and parses it back", () => {
    const value = { catalog: { book: [{ "@id": "1", title: "A" }, { "@id": "2", title: "B" }] } };
    const xml = serializeData("xml", value);
    expect(xml).toContain("<?xml");
    expect(xml).toContain("<catalog>");
    const back = parseData("xml", xml) as any;
    expect(back.catalog.book).toHaveLength(2);
    expect(back.catalog.book[0]["@id"]).toBe("1");
    expect(back.catalog.book[0].title).toBe("A");
  });

  it("rejects CSV output for non-array data with a friendly message", () => {
    expect(() => serializeData("csv", { a: 1 })).toThrow(/array/i);
  });
});
