import { first, gr, inc, nullRound, sameRound, type Round } from "./order";
import type { Value } from "./cast";
import type { Envelope, Msg } from "./messages";
import type { Note } from "./notes";
import { uniform } from "./rng";

export const TIMEOUT = 2000;
export const BACKOFF = 10;

export interface ProposerContext {
  now(): number;
  rng(): number;
  quorum(): number;
  broadcast(from: string, msg: Msg): void;
  wakeAt(proposer: string, time: number): void;
  timeoutAt(proposer: string, token: number, time: number): void;
  note(n: Note): void;
}

export type Phase = "sleeping" | "collect" | "vote" | "backoff" | "decided";

// proposer.erl as a state machine. Erlang's selective receive is kept: a message that the
// current receive doesn't match stays in the mailbox for a later one.
export class Proposer {
  phase: Phase = "sleeping";
  round: Round;
  backoff = BACKOFF;
  value: Value;
  left = 0;
  refusals = 0;
  maxVoted: Round = nullRound();
  mailbox: Envelope[] = [];
  token = 0;
  decided: { value: Value; round: Round } | null = null;
  rounds = 0;

  constructor(
    readonly atom: string,
    readonly proposal: Value,
  ) {
    this.round = first(atom);
    this.value = proposal;
  }

  get receiving(): boolean {
    return this.phase === "collect" || this.phase === "vote";
  }

  wake(ctx: ProposerContext): void {
    if (this.phase === "backoff") {
      this.round = inc(this.round);
      this.backoff *= 2;
    }
    this.ballot(ctx);
  }

  deliver(env: Envelope, ctx: ProposerContext): void {
    this.mailbox.push(env);
    if (this.receiving && this.matches(env.msg)) this.receive(ctx);
    else ctx.note({ type: "queued", env });
  }

  timeout(token: number, ctx: ProposerContext): void {
    if (token !== this.token || !this.receiving) return;
    this.abort(ctx, "timeout");
  }

  private ballot(ctx: ProposerContext): void {
    this.rounds++;
    ctx.note({ type: "round", proposer: this.atom, round: this.round, value: this.proposal });
    ctx.broadcast(this.atom, { kind: "prepare", round: this.round });
    this.phase = "collect";
    this.left = ctx.quorum();
    this.refusals = ctx.quorum();
    this.maxVoted = nullRound();
    this.value = this.proposal;
    this.receive(ctx);
  }

  private matches(msg: Msg): boolean {
    if (msg.kind === "sorry") return true;
    return this.phase === "collect" ? msg.kind === "promise" : msg.kind === "vote";
  }

  private receive(ctx: ProposerContext): void {
    for (;;) {
      if (this.left === 0) {
        if (this.phase === "collect") this.accept(ctx);
        else this.decide(ctx);
        return;
      }
      if (this.refusals === 0) {
        this.abort(ctx, "sorry");
        return;
      }
      const i = this.mailbox.findIndex((env) => this.matches(env.msg));
      if (i < 0) {
        this.token++;
        ctx.timeoutAt(this.atom, this.token, ctx.now() + TIMEOUT);
        return;
      }
      const [env] = this.mailbox.splice(i, 1);
      this.read(env, ctx);
    }
  }

  private read(env: Envelope, ctx: ProposerContext): void {
    const msg = env.msg;
    let effect: "counted" | "adopted" | "ignored" | "refusal";
    if (msg.kind === "sorry") {
      this.refusals--;
      effect = "refusal";
    } else if (msg.kind === "promise" && sameRound(msg.round, this.round)) {
      this.left--;
      effect = "counted";
      if (msg.value !== null && gr(msg.voted, this.maxVoted)) {
        this.maxVoted = msg.voted;
        this.value = msg.value;
        effect = "adopted";
      }
    } else if (msg.kind === "vote" && sameRound(msg.round, this.round)) {
      this.left--;
      effect = "counted";
    } else {
      effect = "ignored";
    }
    ctx.note({ type: "read", proposer: this.atom, env, effect, left: this.left, refusals: this.refusals });
  }

  private accept(ctx: ProposerContext): void {
    ctx.note({ type: "accepting", proposer: this.atom, round: this.round, value: this.value, was: this.proposal });
    ctx.broadcast(this.atom, { kind: "accept", round: this.round, value: this.value });
    this.phase = "vote";
    this.left = ctx.quorum();
    this.refusals = ctx.quorum();
    this.receive(ctx);
  }

  private decide(ctx: ProposerContext): void {
    this.phase = "decided";
    this.decided = { value: this.value, round: this.round };
    this.token++;
    ctx.note({ type: "decided", proposer: this.atom, round: this.round, value: this.value });
  }

  private abort(ctx: ProposerContext, reason: "sorry" | "timeout"): void {
    const phase = this.phase === "collect" ? "prepare" : "accept";
    const sleep = uniform(ctx.rng, this.backoff);
    this.phase = "backoff";
    this.token++;
    ctx.note({ type: "abort", proposer: this.atom, round: this.round, reason, phase, sleep });
    ctx.wakeAt(this.atom, ctx.now() + sleep);
  }
}
