import { PROPOSERS, type Value } from "../src/paxy/cast";
import { Sim } from "../src/paxy/sim";
import { canonical, key } from "./trace";

const atomOf = (v: Value) => PROPOSERS.find((p) => p.value === v)!.atom;

export function simLines(sim: Sim): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  for (const n of sim.log) {
    const push = (p: string, s: string) => (out[p] ??= []).push(s);
    if (n.type === "round") push(n.proposer, `Phase 1: round ${n.round.n}:${n.round.id} proposal ${atomOf(n.value)}`);
    if (n.type === "accepting")
      push(n.proposer, `Phase 2: round ${n.round.n}:${n.round.id} proposal ${atomOf(n.value)} (was ${atomOf(n.was)})`);
    if (n.type === "decided") push(n.proposer, `DECIDED ${atomOf(n.value)} in round ${n.round.n}:${n.round.id}`);
  }
  return out;
}

export const simKeys = (sim: Sim) => sim.sent.map((e) => key({ from: e.from, to: e.to, body: canonical(e) }));
