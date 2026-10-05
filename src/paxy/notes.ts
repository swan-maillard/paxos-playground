import type { Round } from "./order";
import type { Value } from "./cast";
import type { Envelope } from "./messages";

// What happened at one instant, in a form the narration and the tests can both read.
export type Note =
  | { type: "round"; proposer: string; round: Round; value: Value }
  | { type: "promised"; acceptor: string; proposer: string; round: Round; voted: Round; value: Value | null }
  | { type: "refused"; acceptor: string; proposer: string; about: "prepare" | "accept"; round: Round; promised: Round }
  | { type: "voted"; acceptor: string; proposer: string; round: Round; value: Value; stored: boolean; voted: Round }
  | { type: "lost"; env: Envelope }
  | { type: "down"; env: Envelope }
  | { type: "dead"; env: Envelope }
  | { type: "queued"; env: Envelope }
  | { type: "read"; proposer: string; env: Envelope; effect: ReadEffect; left: number; refusals: number }
  | { type: "accepting"; proposer: string; round: Round; value: Value; was: Value }
  | { type: "abort"; proposer: string; round: Round; reason: "sorry" | "timeout"; phase: "prepare" | "accept"; sleep: number }
  | { type: "decided"; proposer: string; round: Round; value: Value }
  | { type: "crash"; acceptor: string }
  | { type: "restart"; acceptor: string; promised: Round; voted: Round; value: Value | null };

export type ReadEffect = "counted" | "adopted" | "ignored" | "refusal";

export type Timed<T> = T & { time: number };
