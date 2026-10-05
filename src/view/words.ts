import { nameOf } from "../paxy/cast";
import type { Round } from "../paxy/order";

export const isNull = (r: Round) => r.id === 0;

export const roundOf = (r: Round) => (isNull(r) ? "no round" : `round ${r.n} of ${nameOf(r.id as string)}`);

export const initials = (atom: string) =>
  nameOf(atom)
    .split("-")
    .map((part) => part[0])
    .join("");

export const shortTuple = (r: Round) => (isNull(r) ? "none" : `(${r.n}, ${initials(r.id as string)})`);

export const ms = (t: number) => `${Math.round(t).toLocaleString("en-GB")} ms`;

export const ordinal = ["no", "one", "two", "three", "four", "five"];
