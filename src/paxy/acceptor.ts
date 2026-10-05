import { gr, goe, nullRound, type Round } from "./order";
import type { Value } from "./cast";
import type { Envelope, Msg } from "./messages";
import type { Note } from "./notes";

export interface AcceptorState {
  promised: Round;
  voted: Round;
  value: Value | null;
}

export interface AcceptorContext {
  reply(from: string, to: string, msg: Msg): void;
  note(n: Note): void;
}

// acceptor.erl: answers prepare and accept, and writes its state to dets after every change.
export class Acceptor {
  promised: Round = nullRound();
  voted: Round = nullRound();
  value: Value | null = null;
  down = false;
  stored: AcceptorState = { promised: nullRound(), voted: nullRound(), value: null };

  constructor(readonly atom: string) {}

  handle(env: Envelope, ctx: AcceptorContext): void {
    const { msg } = env;
    const proposer = env.from;
    if (msg.kind === "prepare") {
      if (gr(msg.round, this.promised)) {
        ctx.reply(this.atom, proposer, { kind: "promise", round: msg.round, voted: this.voted, value: this.value });
        this.promised = msg.round;
        this.store();
        ctx.note({ type: "promised", acceptor: this.atom, proposer, round: msg.round, voted: this.voted, value: this.value });
      } else {
        ctx.reply(this.atom, proposer, { kind: "sorry", about: "prepare", round: msg.round });
        ctx.note({ type: "refused", acceptor: this.atom, proposer, about: "prepare", round: msg.round, promised: this.promised });
      }
    } else if (msg.kind === "accept") {
      if (goe(msg.round, this.promised)) {
        ctx.reply(this.atom, proposer, { kind: "vote", round: msg.round });
        const stored = goe(msg.round, this.voted);
        if (stored) {
          this.voted = msg.round;
          this.value = msg.value;
          this.store();
        }
        ctx.note({ type: "voted", acceptor: this.atom, proposer, round: msg.round, value: msg.value, stored, voted: this.voted });
      } else {
        ctx.reply(this.atom, proposer, { kind: "sorry", about: "accept", round: msg.round });
        ctx.note({ type: "refused", acceptor: this.atom, proposer, about: "accept", round: msg.round, promised: this.promised });
      }
    }
  }

  crash(): void {
    this.down = true;
    this.promised = nullRound();
    this.voted = nullRound();
    this.value = null;
  }

  // init/2 reads the dets file back, so a restarted acceptor remembers its promise and vote.
  restart(): void {
    this.down = false;
    this.promised = this.stored.promised;
    this.voted = this.stored.voted;
    this.value = this.stored.value;
  }

  private store(): void {
    this.stored = { promised: this.promised, voted: this.voted, value: this.value };
  }
}
