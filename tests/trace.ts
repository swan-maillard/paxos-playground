import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { PROPOSERS } from "../src/paxy/cast";
import type { Envelope } from "../src/paxy/messages";
import type { Round } from "../src/paxy/order";

// The fixtures are dbg traces of the unmodified Erlang modules, run headless with a stub GUI.
// Proposers were given their own name as value, so jeanphillibert stands for red and so on.
export interface TraceMessage {
  from: string;
  to: string;
  body: string;
  time: number;
}

const fixture = (name: string) =>
  readFileSync(fileURLToPath(new URL(`./fixtures/${name}`, import.meta.url)), "utf-8");

export function loadTrace(name: string): TraceMessage[] {
  const lines = fixture(name).trim().split("\n");
  const t0 = Number(lines[0].split("\t")[0]);
  return lines.map((line) => {
    const [t, from, to, raw] = line.replace(/\r$/, "").split("\t");
    let body = raw.replaceAll(",nonode@nohost", "").replace(/<\d+\.\d+\.\d+>,/, "");
    body = body.replace(/^\{dead,(.*)\}$/, "$1");
    body = body.replace(/\{(\d+),\{(\w+)\}\}/g, "$1:$2").replaceAll("{0,0}", "0:0");
    return { from, to, body, time: (Number(t) - t0) / 1000 };
  });
}

const atomOf = (value: string | null) =>
  value === null ? "na" : PROPOSERS.find((p) => p.value === value)!.atom;

const round = (r: Round) => `${r.n}:${r.id}`;

export function canonical(env: Envelope): string {
  const m = env.msg;
  switch (m.kind) {
    case "prepare":
      return `{prepare,${round(m.round)}}`;
    case "promise":
      return `{promise,${round(m.round)},${round(m.voted)},${atomOf(m.value)}}`;
    case "sorry":
      return `{sorry,{${m.about},${round(m.round)}}}`;
    case "accept":
      return `{accept,${round(m.round)},${atomOf(m.value)}}`;
    case "vote":
      return `{vote,${round(m.round)}}`;
  }
}

export const key = (m: { from: string; to: string; body: string }) => `${m.from} > ${m.to} ${m.body}`;

export const multiset = (keys: string[]) => [...keys].sort();

// The "[Proposer ...] Phase 1/Phase 2/DECIDED" lines of the Erlang run, per proposer.
export function proposerLines(name: string): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  for (const line of fixture(name).split("\n")) {
    const clean = line.replaceAll(",nonode@nohost", "").replace(/\{(\d+),\{(\w+)\}\}/g, "$1:$2");
    const m = clean.match(/^\[Proposer \{(\w+)\}\] (.*?)( after \d+ ms)?\r?$/);
    if (m) (out[m[1]] ??= []).push(m[2]);
  }
  return out;
}
