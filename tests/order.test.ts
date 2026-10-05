import { describe, expect, it } from "vitest";
import { first, goe, gr, inc, nullRound } from "../src/paxy/order";

describe("order.erl", () => {
  it("puts {0,0} below every proposer's first round", () => {
    for (const id of ["jeaneude", "jeanmaxence", "jeanphillibert"]) {
      expect(gr(first(id), nullRound())).toBe(true);
      expect(gr(nullRound(), first(id))).toBe(false);
    }
  });

  it("breaks ties on the proposer's name, alphabetically like Erlang atoms", () => {
    expect(gr(first("jeanphillibert"), first("jeanmaxence"))).toBe(true);
    expect(gr(first("jeanmaxence"), first("jeaneude"))).toBe(true);
    expect(gr(first("jeaneude"), first("jeanphillibert"))).toBe(false);
  });

  it("lets the number win over the name", () => {
    expect(gr(inc(first("jeaneude")), first("jeanphillibert"))).toBe(true);
  });

  it("only goe accepts an equal round", () => {
    const r = first("jeanmaxence");
    expect(gr(r, { ...r })).toBe(false);
    expect(goe(r, { ...r })).toBe(true);
  });
});
