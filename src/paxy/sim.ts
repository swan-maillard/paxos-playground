import { ACCEPTORS, PROPOSERS, type Value } from "./cast";
import { Acceptor } from "./acceptor";
import { Proposer, type ProposerContext } from "./proposer";
import type { Envelope, Msg } from "./messages";
import type { Note, Timed } from "./notes";
import { makeRng } from "./rng";

export interface Network {
  // Upper bound of the random extra wait added to each message, in ms.
  delay: number;
  // Probability that a message never arrives, 0 to 1.
  drop: number;
}

export interface SimOptions extends Network {
  seed: number;
  // Initial sleep of each proposer, the argument of paxy:start/1.
  sleeps: number[];
  // Time a message takes with no extra delay. Defaults to 1 to 5 ms.
  latency?: (rng: () => number) => number;
}

type Event =
  | { kind: "arrive"; env: Envelope }
  | { kind: "wake"; proposer: string }
  | { kind: "timeout"; proposer: string; token: number };

interface Queued {
  time: number;
  seq: number;
  event: Event;
}

const baseLatency = (rng: () => number) => 1 + rng() * 4;

export class Sim {
  now = 0;
  readonly proposers: Proposer[];
  readonly acceptors: Acceptor[];
  readonly network: Network;
  readonly inFlight = new Set<Envelope>();
  readonly sent: Envelope[] = [];
  readonly log: Timed<Note>[] = [];
  private readonly rng: () => number;
  private readonly latency: (rng: () => number) => number;
  private queue: Queued[] = [];
  private seq = 0;
  private envId = 0;
  private lastArrival = new Map<string, number>();
  private readonly ctx: ProposerContext;

  constructor(opts: SimOptions) {
    this.rng = makeRng(opts.seed);
    this.latency = opts.latency ?? baseLatency;
    this.network = { delay: opts.delay, drop: opts.drop };
    this.proposers = PROPOSERS.map((p) => new Proposer(p.atom, p.value));
    this.acceptors = ACCEPTORS.map((a) => new Acceptor(a.atom));
    this.ctx = {
      now: () => this.now,
      rng: this.rng,
      quorum: () => Math.floor(this.acceptors.length / 2) + 1,
      broadcast: (from, msg) => this.acceptors.forEach((a) => this.send(from, a.atom, msg)),
      wakeAt: (proposer, time) => this.push(time, { kind: "wake", proposer }),
      timeoutAt: (proposer, token, time) => this.push(time, { kind: "timeout", proposer, token }),
      note: (n) => this.note(n),
    };
    this.proposers.forEach((p, i) => this.push(opts.sleeps[i] ?? 0, { kind: "wake", proposer: p.atom }));
  }

  proposer(atom: string): Proposer {
    return this.proposers.find((p) => p.atom === atom)!;
  }

  acceptor(atom: string): Acceptor {
    return this.acceptors.find((a) => a.atom === atom)!;
  }

  get allDecided(): boolean {
    return this.proposers.every((p) => p.decided);
  }

  get decidedValues(): Value[] {
    return [...new Set(this.proposers.flatMap((p) => (p.decided ? [p.decided.value] : [])))];
  }

  // Time of the next event that will change something, skipping timers that were cancelled.
  peekTime(): number | null {
    this.dropStaleTimers();
    return this.queue.length ? this.queue[0].time : null;
  }

  // Runs one event. Returns false when nothing is left to run.
  step(): boolean {
    this.dropStaleTimers();
    const next = this.queue.shift();
    if (!next) return false;
    this.now = Math.max(this.now, next.time);
    const ev = next.event;
    if (ev.kind === "arrive") this.arrive(ev.env);
    else if (ev.kind === "wake") this.proposer(ev.proposer).wake(this.ctx);
    else this.proposer(ev.proposer).timeout(ev.token, this.ctx);
    return true;
  }

  // Runs events until one message has reached its destination (or was lost on the way).
  stepMessage(): boolean {
    for (;;) {
      if (this.peekTime() === null) return false;
      const isArrival = this.queue[0].event.kind === "arrive";
      this.step();
      if (isArrival) return true;
    }
  }

  runUntil(time: number): void {
    for (let t = this.peekTime(); t !== null && t <= time; t = this.peekTime()) this.step();
    this.now = Math.max(this.now, time);
  }

  run(maxTime = Infinity, maxEvents = 200_000): void {
    for (let i = 0; i < maxEvents && !this.allDecided; i++) {
      const t = this.peekTime();
      if (t === null || t > maxTime || !this.step()) return;
    }
  }

  crash(atom: string): void {
    const a = this.acceptor(atom);
    if (a.down) return;
    a.crash();
    this.note({ type: "crash", acceptor: atom });
  }

  restart(atom: string): void {
    const a = this.acceptor(atom);
    if (!a.down) return;
    a.restart();
    this.note({ type: "restart", acceptor: atom, promised: a.promised, voted: a.voted, value: a.value });
  }

  private note(n: Note): void {
    this.log.push({ ...n, time: this.now });
  }

  private push(time: number, event: Event): void {
    const item = { time, seq: this.seq++, event };
    let lo = 0;
    let hi = this.queue.length;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      const q = this.queue[mid];
      if (q.time < time || (q.time === time && q.seq < item.seq)) lo = mid + 1;
      else hi = mid;
    }
    this.queue.splice(lo, 0, item);
  }

  private dropStaleTimers(): void {
    while (this.queue.length) {
      const ev = this.queue[0].event;
      if (ev.kind !== "timeout") return;
      const p = this.proposer(ev.proposer);
      if (p.token === ev.token && p.receiving) return;
      this.queue.shift();
    }
  }

  // Erlang keeps messages between two processes in order, so a later message never overtakes an earlier one.
  private send(from: string, to: string, msg: Msg): void {
    const extra = this.network.delay > 0 ? this.rng() * this.network.delay : 0;
    const lost = this.network.drop > 0 && this.rng() < this.network.drop;
    const pair = `${from}>${to}`;
    const arriveAt = Math.max(this.now + this.latency(this.rng) + extra, this.lastArrival.get(pair) ?? 0);
    this.lastArrival.set(pair, arriveAt);
    const env: Envelope = { id: this.envId++, from, to, msg, sentAt: this.now, arriveAt, lost };
    this.sent.push(env);
    this.inFlight.add(env);
    this.push(arriveAt, { kind: "arrive", env });
  }

  private arrive(env: Envelope): void {
    this.inFlight.delete(env);
    if (env.lost) {
      env.fate = "lost";
      this.note({ type: "lost", env });
      return;
    }
    const acceptor = this.acceptors.find((a) => a.atom === env.to);
    if (acceptor) {
      if (acceptor.down) {
        env.fate = "down";
        this.note({ type: "down", env });
        return;
      }
      env.fate = "delivered";
      acceptor.handle(env, { reply: (f, t, m) => this.send(f, t, m), note: (n) => this.note(n) });
      return;
    }
    const proposer = this.proposer(env.to);
    if (proposer.decided) {
      env.fate = "dead";
      this.note({ type: "dead", env });
      return;
    }
    env.fate = "delivered";
    proposer.deliver(env, this.ctx);
  }
}
