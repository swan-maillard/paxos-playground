import { describe, expect, it } from "vitest";
import { makeRng } from "../src/paxy/rng";
import { Sim } from "../src/paxy/sim";
import { ACCEPTORS } from "../src/paxy/cast";

describe("with a perfect network", () => {
  it("every proposer decides, and they all decide the same value", () => {
    for (let seed = 1; seed <= 300; seed++) {
      const r = makeRng(seed * 7919);
      const sleeps = [0, 0, 0].map(() => Math.floor(r() * 30));
      const sim = new Sim({ seed, delay: 0, drop: 0, sleeps });
      sim.run();
      expect(sim.allDecided).toBe(true);
      expect(sim.decidedValues).toHaveLength(1);
    }
  });
});

describe("with delays, drops and crashes", () => {
  it("never lets two proposers decide different values", () => {
    let decidedRuns = 0;
    for (let seed = 1; seed <= 400; seed++) {
      const r = makeRng(seed * 104729);
      const sim = new Sim({
        seed,
        delay: Math.floor(r() * 4000),
        drop: r() * 0.3,
        sleeps: [0, 0, 0].map(() => Math.floor(r() * 3000)),
      });
      for (let t = 0; t < 200_000 && !sim.allDecided; t += 500) {
        sim.runUntil(t);
        const a = ACCEPTORS[Math.floor(r() * ACCEPTORS.length)].atom;
        if (r() < 0.05) sim.crash(a);
        else if (r() < 0.5) sim.restart(a);
        expect(sim.decidedValues.length).toBeLessThanOrEqual(1);
      }
      if (sim.allDecided) decidedRuns++;
    }
    // Most runs still finish, so the check above is not passing on runs that never decide.
    expect(decidedRuns).toBeGreaterThan(200);
  });

  it("keeps an acceptor's promise and vote across a crash", () => {
    const sim = new Sim({ seed: 3, delay: 0, drop: 0, sleeps: [0, 1000, 2000] });
    sim.runUntil(500);
    const a = sim.acceptor("mariejeanne");
    const before = { promised: a.promised, voted: a.voted, value: a.value };
    sim.crash("mariejeanne");
    sim.restart("mariejeanne");
    expect({ promised: a.promised, voted: a.voted, value: a.value }).toEqual(before);
    expect(before.value).toBe("red");
  });

  it("is deterministic for a given seed", () => {
    const run = () => {
      const sim = new Sim({ seed: 42, delay: 1500, drop: 0.2, sleeps: [0, 0, 0] });
      sim.run();
      return sim.sent.map((e) => `${e.id} ${e.arriveAt} ${e.lost}`).join("\n");
    };
    expect(run()).toEqual(run());
  });
});
