import { describe, expect, it } from "vitest";
import { Sim } from "../src/paxy/sim";
import { key, loadTrace, multiset, proposerLines } from "./trace";
import { simKeys, simLines } from "./helpers";

function finish(sim: Sim) {
  sim.run(60_000);
  sim.runUntil(sim.now + 100);
}

describe("one proposer after another (sleeps 0, 1000, 2000)", () => {
  const trace = multiset(loadTrace("run_seq.tsv").map(key));
  const lines = proposerLines("run_seq.log");

  it("sends exactly the 100 messages of the Erlang run, for any seed", () => {
    for (let seed = 1; seed <= 50; seed++) {
      const sim = new Sim({ seed, delay: 0, drop: 0, sleeps: [0, 1000, 2000] });
      finish(sim);
      expect(multiset(simKeys(sim))).toEqual(trace);
    }
  });

  it("prints the same Phase 1, Phase 2 and DECIDED lines for each proposer", () => {
    const sim = new Sim({ seed: 1, delay: 0, drop: 0, sleeps: [0, 1000, 2000] });
    finish(sim);
    const mine = simLines(sim);
    for (const p of Object.keys(lines)) expect(mine[p]).toEqual(lines[p]);
    // Jean-Eude needs four rounds, as in the trace: two of them end on sorry messages left over from earlier rounds.
    expect(lines.jeaneude).toHaveLength(6);
  });
});

describe("all three at once (the traced start times)", () => {
  // In the Erlang run every acceptor answered the prepares in the order they were sent.
  // A fixed 2 ms latency gives the same order here.
  const opts = { delay: 0, drop: 0, sleeps: [0.027, 0.016, 0], latency: () => 2 };
  const trace = loadTrace("run_cont.tsv");
  const lines = proposerLines("run_cont.log");

  it("plays round 0 exactly like the trace, for any seed", () => {
    const roundZero = (keys: string[]) => multiset(keys.filter((k) => / \{\w+,(\{\w+,)?0:/.test(k)));
    const expected = roundZero(trace.map(key));
    expect(expected.length).toBe(60);
    for (let seed = 1; seed <= 50; seed++) {
      const sim = new Sim({ seed, ...opts });
      finish(sim);
      expect(roundZero(simKeys(sim))).toEqual(expected);
      expect(sim.decidedValues).toEqual(["red"]);
    }
  });

  it("reproduces the whole run when the backoff draws fall the same way (seed 1)", () => {
    const sim = new Sim({ seed: 1, ...opts });
    finish(sim);
    expect(multiset(simKeys(sim))).toEqual(multiset(trace.map(key)));
    const mine = simLines(sim);
    for (const p of Object.keys(lines)) expect(mine[p]).toEqual(lines[p]);
  });
});
