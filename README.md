# Paxy, a Paxos playground

Three proposers want five acceptors to agree on one colour, and every Paxos message between them is on screen. You can slow messages down, lose some of them, or crash acceptors, and a side panel says in plain words what just happened and why. The proposer and acceptor logic follows the lab's Erlang code.

Live page: https://swan-maillard.github.io/paxos-playground/

## The project

Paxy was a lab from my Erasmus semester at UPC Barcelona, in October 2023. It's a Paxos simulation in Erlang/OTP: three proposers (Jean-Phillibert, Jean-Maxence and Jean-Eude) and five acceptors (Marie-Josette, Marie-Micheline, Marie-Cunégonde, Marie-Jeanne and Marie-Elise), each one an Erlang process, with a wx GUI showing their rounds and votes. Acceptors write their state to disk with dets after every change, so a crashed acceptor comes back with its promises intact. Code: https://github.com/swan-maillard/UPC-Erlang-Paxy

## What this demo shows

- A round from start to finish: prepare, then promise or sorry, then accept, then vote.
- Why a proposer sometimes ends up deciding another proposer's colour: a promise can carry an earlier vote, and he has to adopt it.
- What delays, lost messages and crashed acceptors do to the number of rounds, and that the proposers still never decide two different values.

## Differences with the school version

- `proposer.erl`, `acceptor.erl` and `order.erl` are now TypeScript state machines in `src/paxy`. The rules, the 2000 ms timeout, the backoff starting at 10 ms, the quorum and the way replies are counted are the same. Erlang's selective receive is kept: a message that the current receive doesn't match stays in the mailbox for a later one.
- The Erlang processes run on one simulated clock driven by an event queue, with a seeded random generator, so a seed always gives the same run. A message takes 1 to 5 ms, and messages between the same two processes stay in order, as in Erlang.
- The delay and loss I injected for my experiments at the time aren't in the final repo, so the two sliders are my own version: each message waits a random extra time up to the delay you pick, and is lost with the probability you pick.
- dets is replaced by an in-memory copy of each acceptor's state that survives a crash.
- The values were RGB colours in the GUI. Here they're the words red, green and blue.

The tests in `tests/` replay two traced runs of the unmodified Erlang modules (in `tests/fixtures`): with the proposers starting one after another, the TypeScript version sends exactly the same 100 messages and prints the same round lines for any seed. With all three starting together, round 0 matches the trace exactly, and seed 1 reproduces the whole run. Other tests check that the proposers always agree with a perfect network, and never decide two different values across 400 seeds with delays, losses and crashes.

## Run it

```sh
npm install
npm run dev
npm test
```
