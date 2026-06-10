import { describe, it, expect } from "vitest";
import { degreesFromGraph, buildHops } from "../src/lib/network";

describe("degreesFromGraph", () => {
  const ids = new Set(["a", "b", "c", "d", "e"]);

  it("assigns degree 1 to seeds and BFS distances beyond", () => {
    // a-b, b-c, c-d ; e isolated
    const degrees = degreesFromGraph(
      [
        ["a", "b"],
        ["b", "c"],
        ["c", "d"],
      ],
      ["a"],
      ids
    );
    expect(degrees.get("a")).toBe(1);
    expect(degrees.get("b")).toBe(2);
    expect(degrees.get("c")).toBe(3);
    expect(degrees.get("d")).toBe(4);
    expect(degrees.get("e")).toBeUndefined();
  });

  it("takes the shortest path when multiple seeds exist", () => {
    const degrees = degreesFromGraph(
      [
        ["a", "b"],
        ["b", "c"],
        ["d", "c"],
      ],
      ["a", "d"],
      ids
    );
    expect(degrees.get("c")).toBe(2); // via d, not the longer a-b-c path
  });

  it("ignores seeds that are not valid people", () => {
    const degrees = degreesFromGraph([["a", "b"]], ["ghost"], ids);
    expect(degrees.size).toBe(0);
  });

  it("respects the max degree cap", () => {
    const hops: [string, string][] = [];
    const big = new Set<string>();
    for (let i = 0; i < 10; i++) {
      hops.push([`n${i}`, `n${i + 1}`]);
      big.add(`n${i}`);
    }
    big.add("n10");
    const degrees = degreesFromGraph(hops, ["n0"], big, 3);
    expect(degrees.get("n2")).toBe(3);
    expect(degrees.get("n3")).toBeUndefined();
  });
});

describe("buildHops", () => {
  it("links coworkers via shared companies and includes explicit edges", () => {
    const hops = buildHops(
      [
        { id: "p1", positions: [{ companyId: "acme" }] },
        { id: "p2", positions: [{ companyId: "acme" }, { companyId: "globex" }] },
        { id: "p3", positions: [{ companyId: "globex" }] },
      ],
      [{ fromId: "p1", toId: "p3" }]
    );
    expect(hops).toContainEqual(["p1", "p3"]); // explicit edge
    expect(hops).toContainEqual(["p1", "p2"]); // coworkers at acme
    expect(hops).toContainEqual(["p2", "p3"]); // coworkers at globex
  });
});
