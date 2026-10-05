import { nameOf } from "../paxy/cast";
import type { Note, Timed } from "../paxy/notes";
import type { Proposer } from "../paxy/proposer";
import type { Sim } from "../paxy/sim";
import { ms, shortTuple } from "./words";

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;

function doing(p: Proposer): string {
  const got = 3 - p.left;
  switch (p.phase) {
    case "sleeping":
      return "not started";
    case "collect":
      return `waiting for promises, ${got} of 3`;
    case "vote":
      return `waiting for votes, ${got} of 3`;
    case "backoff":
      return "backing off";
    case "decided":
      return `decided ${p.decided!.value}`;
  }
}

function cell(text: string, className?: string): HTMLTableCellElement {
  const td = document.createElement("td");
  td.textContent = text;
  if (className) td.className = className;
  return td;
}

interface RoundEntry {
  proposer: string;
  n: number;
  start: number;
  outcome: string;
}

export class Panel {
  private proposersBody = $<HTMLTableSectionElement>("proposers");
  private acceptorsBody = $<HTMLTableSectionElement>("acceptors");
  private roundsList = $<HTMLUListElement>("rounds");
  private decided = $<HTMLDivElement>("decided");
  private rounds: RoundEntry[] = [];
  private seen = 0;

  constructor(private onToggle: (atom: string) => void) {}

  reset(): void {
    this.rounds = [];
    this.seen = 0;
    this.roundsList.replaceChildren();
  }

  update(sim: Sim): void {
    this.collectRounds(sim.log);
    this.proposersBody.replaceChildren(
      ...sim.proposers.map((p) => {
        const tr = document.createElement("tr");
        const th = document.createElement("th");
        th.scope = "row";
        const status = document.createElement("span");
        status.className = p.decided ? "doing strong" : "doing";
        status.textContent = doing(p);
        th.append(nameOf(p.atom), status);
        const round = p.phase === "sleeping" ? "none" : String(p.round.n);
        tr.append(th, cell(round, "num"), cell(p.decided ? p.decided.value : p.value));
        return tr;
      }),
    );
    this.syncAcceptors(sim);
    this.renderRounds();
    const values = sim.decidedValues;
    if (sim.allDecided) {
      this.decided.hidden = false;
      const rounds = sim.proposers.reduce((sum, p) => sum + p.rounds, 0);
      this.decided.textContent = `All three proposers decided ${values[0]}, after ${rounds} rounds in total and ${ms(sim.now)} of simulated time.`;
    } else {
      this.decided.hidden = true;
    }
  }

  // The rows are rebuilt in place so a focused crash button keeps its focus.
  private syncAcceptors(sim: Sim): void {
    sim.acceptors.forEach((a, i) => {
      let tr = this.acceptorsBody.rows[i];
      if (!tr) {
        tr = this.acceptorsBody.insertRow();
        const th = document.createElement("th");
        th.scope = "row";
        const sub = document.createElement("span");
        sub.className = "doing";
        th.append(nameOf(a.atom), sub);
        const button = document.createElement("button");
        button.type = "button";
        button.className = "small";
        button.addEventListener("click", () => this.onToggle(a.atom));
        const td = document.createElement("td");
        td.append(button);
        tr.append(th, cell("", "num"), cell(""), td);
      }
      const state = a.down ? a.stored : a;
      const promised = shortTuple(state.promised);
      const voted = state.value === null ? "nothing" : `${state.value} ${shortTuple(state.voted)}`;
      tr.cells[1].textContent = promised;
      tr.cells[0].querySelector(".doing")!.textContent = a.down ? "crashed, state on disk" : "";
      tr.cells[2].textContent = voted;
      tr.classList.toggle("down", a.down);
      const button = tr.cells[3].querySelector("button")!;
      const label = a.down ? "Restart" : "Crash";
      if (button.textContent !== label) {
        button.textContent = label;
        button.setAttribute("aria-label", `${label} ${nameOf(a.atom)}`);
      }
    });
  }

  private collectRounds(log: Timed<Note>[]): void {
    for (; this.seen < log.length; this.seen++) {
      const n = log[this.seen];
      if (n.type === "round") {
        this.rounds.push({ proposer: n.proposer, n: n.round.n, start: n.time, outcome: "preparing" });
        continue;
      }
      if (n.type !== "accepting" && n.type !== "abort" && n.type !== "decided") continue;
      const entry = [...this.rounds].reverse().find((r) => r.proposer === n.proposer);
      if (!entry) continue;
      if (n.type === "accepting") entry.outcome = n.value === n.was ? `asked for ${n.value}` : `asked for ${n.value}, not his ${n.was}`;
      if (n.type === "abort") {
        const why = n.reason === "sorry" ? "three sorry" : "timed out";
        entry.outcome = `gave up in ${n.phase === "prepare" ? "prepare" : "accept"}: ${why}`;
      }
      if (n.type === "decided") {
        entry.outcome = `decided ${n.value}`;
      }
    }
  }

  private renderRounds(): void {
    const items = this.rounds
      .slice(-40)
      .reverse()
      .map((r) => {
        const li = document.createElement("li");
        if (r.outcome.startsWith("decided")) li.className = "win";
        const name = document.createElement("strong");
        name.textContent = `${nameOf(r.proposer)}, round ${r.n}`;
        const what = document.createElement("span");
        what.textContent = r.outcome;
        const when = document.createElement("span");
        when.className = "when";
        when.textContent = ms(r.start);
        li.append(name, what, when);
        return li;
      });
    this.roundsList.replaceChildren(...items);
  }
}
