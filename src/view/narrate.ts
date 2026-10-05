import { nameOf } from "../paxy/cast";
import type { Note } from "../paxy/notes";
import { TIMEOUT } from "../paxy/proposer";
import { isNull, ms, ordinal, roundOf } from "./words";

const his = (n: number) => (n === 1 ? "1 more" : `${n} more`);

export function narrate(n: Note): string {
  switch (n.type) {
    case "round": {
      const p = nameOf(n.proposer);
      return `${p} starts round ${n.round.n} with ${n.value} and sends prepare to all five acceptors: "promise you'll ignore any older round".`;
    }
    case "promised": {
      const a = nameOf(n.acceptor);
      const head = `${a} promises ${roundOf(n.round)}`;
      if (n.value === null) return `${head}. She hasn't voted for anything yet.`;
      return `${head} and tells him her last vote: ${n.value}, in ${roundOf(n.voted)}.`;
    }
    case "refused": {
      const a = nameOf(n.acceptor);
      if (n.about === "prepare")
        return `${a} already promised ${roundOf(n.promised)}, so she answers sorry to ${roundOf(n.round)}.`;
      return `${a} has promised ${roundOf(n.promised)} since, so she answers sorry to the accept for ${roundOf(n.round)}.`;
    }
    case "voted": {
      const a = nameOf(n.acceptor);
      if (n.stored) return `${a} votes ${n.value} in ${roundOf(n.round)} and writes it to disk.`;
      return `${a} answers vote to ${roundOf(n.round)} but keeps her vote from ${roundOf(n.voted)}.`;
    }
    case "lost":
      return `The ${n.env.msg.kind} from ${nameOf(n.env.from)} to ${nameOf(n.env.to)} is lost on the way.`;
    case "down":
      return `The ${n.env.msg.kind} from ${nameOf(n.env.from)} reaches ${nameOf(n.env.to)} while she's crashed. Nobody reads it.`;
    case "dead":
      return `${nameOf(n.env.from)}'s ${n.env.msg.kind} reaches ${nameOf(n.env.to)} after he decided. His process has ended, so it goes nowhere.`;
    case "queued": {
      const what = n.waiting === "backoff" ? "he's backing off" : n.waiting === "collect" ? "he waits for promises" : "he waits for votes";
      return `${nameOf(n.env.from)}'s ${n.env.msg.kind} reaches ${nameOf(n.env.to)} while ${what}. It stays in his mailbox.`;
    }
    case "read": {
      const p = nameOf(n.proposer);
      const a = nameOf(n.env.from);
      const m = n.env.msg;
      if (n.effect === "refusal") {
        const tail = n.refusals > 0 ? ` ${his(n.refusals)} and he gives up this round.` : "";
        return `${p} reads a sorry from ${a}, about ${roundOf(m.round)}.${tail}`;
      }
      if (n.effect === "ignored") return `${p} reads ${a}'s ${m.kind} for ${roundOf(m.round)}, not his current round, and moves on.`;
      if (n.effect === "adopted" && m.kind === "promise")
        return `${a} voted ${m.value} in ${roundOf(m.voted)}, the latest vote ${p} has heard of. He'll propose ${m.value} now.${need(n.left, "promises")}`;
      return `${p} counts ${a}'s ${m.kind}.${need(n.left, m.kind === "vote" ? "votes" : "promises")}`;
    }
    case "accepting": {
      const p = nameOf(n.proposer);
      if (n.value === n.was) return `${p} has three promises, a majority of five. He asks all five to accept ${n.value}.`;
      return `${p} has three promises. One carried a vote for ${n.value}, so he asks all five to accept ${n.value}, not his own ${n.was}.`;
    }
    case "abort": {
      const p = nameOf(n.proposer);
      const why =
        n.reason === "sorry"
          ? `${p} has read three sorry messages`
          : `${p} heard nothing for ${TIMEOUT / 1000} seconds while waiting for ${n.phase === "prepare" ? "promises" : "votes"}`;
      return `${why}, so he gives up round ${n.round.n}. He waits ${ms(n.sleep)}, then tries round ${n.round.n + 1}.`;
    }
    case "decided":
      return `${nameOf(n.proposer)} has three votes for round ${n.round.n}. He decides ${n.value}.`;
    case "crash":
      return `${nameOf(n.acceptor)} crashes. Messages sent to her are lost until she restarts, but her promise and vote are on disk.`;
    case "restart": {
      const a = nameOf(n.acceptor);
      const vote = n.value === null ? "no vote yet" : `voted ${n.value} in ${roundOf(n.voted)}`;
      const promise = isNull(n.promised) ? "no promise" : `promised ${roundOf(n.promised)}`;
      return `${a} restarts and reads her state back from disk: ${promise}, ${vote}.`;
    }
  }
}

function need(left: number, what: string): string {
  if (left === 0) return ` That's three ${what}, a majority.`;
  return ` ${ordinal[3 - left][0].toUpperCase()}${ordinal[3 - left].slice(1)} of three ${what}.`;
}
