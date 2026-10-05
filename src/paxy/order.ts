// A round is {N, Id} as in order.erl. Id is the proposer's registered name, an Erlang atom.
export type Id = string | 0;

export interface Round {
  n: number;
  id: Id;
}

export const nullRound = (): Round => ({ n: 0, id: 0 });

export const first = (id: string): Round => ({ n: 0, id });

export const inc = (r: Round): Round => ({ n: r.n + 1, id: r.id });

// Erlang sorts numbers before atoms and atoms alphabetically, so {0,0} is below any
// real round and jeaneude < jeanmaxence < jeanphillibert when the numbers tie.
function compareId(a: Id, b: Id): number {
  if (a === b) return 0;
  if (a === 0) return -1;
  if (b === 0) return 1;
  return a < b ? -1 : 1;
}

export const gr = (a: Round, b: Round): boolean =>
  a.n > b.n || (a.n === b.n && compareId(a.id, b.id) > 0);

export const goe = (a: Round, b: Round): boolean =>
  a.n > b.n || (a.n === b.n && compareId(a.id, b.id) >= 0);

export const sameRound = (a: Round, b: Round): boolean => a.n === b.n && a.id === b.id;
