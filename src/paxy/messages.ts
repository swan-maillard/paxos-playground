import type { Round } from "./order";
import type { Value } from "./cast";

export type Msg =
  | { kind: "prepare"; round: Round }
  | { kind: "promise"; round: Round; voted: Round; value: Value | null }
  | { kind: "sorry"; about: "prepare" | "accept"; round: Round }
  | { kind: "accept"; round: Round; value: Value }
  | { kind: "vote"; round: Round };

export type Kind = Msg["kind"];

export type Fate = "delivered" | "lost" | "down" | "dead";

export interface Envelope {
  id: number;
  from: string;
  to: string;
  msg: Msg;
  sentAt: number;
  arriveAt: number;
  lost: boolean;
  fate?: Fate;
}
