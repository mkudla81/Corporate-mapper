import { describe, it, expect } from "vitest";
import { parseCsv, parseConnectionsCsv } from "../src/lib/linkedin";

describe("parseCsv", () => {
  it("handles quoted fields with commas and escaped quotes", () => {
    const rows = parseCsv('a,"b, c","say ""hi"""\nx,y,z');
    expect(rows).toEqual([
      ["a", "b, c", 'say "hi"'],
      ["x", "y", "z"],
    ]);
  });

  it("handles CRLF and skips blank lines", () => {
    const rows = parseCsv("a,b\r\n\r\nc,d\r\n");
    expect(rows).toEqual([
      ["a", "b"],
      ["c", "d"],
    ]);
  });

  it("handles newlines inside quoted fields", () => {
    const rows = parseCsv('a,"line1\nline2",b');
    expect(rows).toEqual([["a", "line1\nline2", "b"]]);
  });
});

describe("parseConnectionsCsv", () => {
  it("skips the LinkedIn notes preamble and parses connections", () => {
    const csv = [
      "Notes:",
      '"When exporting your connection data, you may be missing information."',
      "",
      "First Name,Last Name,URL,Email Address,Company,Position,Connected On",
      "Ada,Lovelace,https://linkedin.com/in/ada,ada@ex.com,Analytical Engines,CTO,12 Jan 2025",
      "Grace,Hopper,,,Navy,,",
    ].join("\n");
    const out = parseConnectionsCsv(csv);
    expect(out).toHaveLength(2);
    expect(out[0]).toMatchObject({
      firstName: "Ada",
      lastName: "Lovelace",
      profileUrl: "https://linkedin.com/in/ada",
      email: "ada@ex.com",
      company: "Analytical Engines",
      position: "CTO",
    });
    expect(out[0].connectedOn).toBeInstanceOf(Date);
    expect(out[1]).toMatchObject({ firstName: "Grace", lastName: "Hopper", company: "Navy" });
    expect(out[1].profileUrl).toBeUndefined();
  });

  it("rejects files without the expected header", () => {
    expect(() => parseConnectionsCsv("foo,bar\n1,2")).toThrow(/First Name/);
  });
});
