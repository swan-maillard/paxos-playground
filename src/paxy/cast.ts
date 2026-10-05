// Names and values from paxy.erl. The values were RGB colours in the wx GUI.
export type Value = "red" | "green" | "blue";

export interface ProposerInfo {
  atom: string;
  name: string;
  value: Value;
}

export interface AcceptorInfo {
  atom: string;
  name: string;
}

export const PROPOSERS: ProposerInfo[] = [
  { atom: "jeanphillibert", name: "Jean-Phillibert", value: "red" },
  { atom: "jeanmaxence", name: "Jean-Maxence", value: "green" },
  { atom: "jeaneude", name: "Jean-Eude", value: "blue" },
];

export const ACCEPTORS: AcceptorInfo[] = [
  { atom: "mariejosette", name: "Marie-Josette" },
  { atom: "mariemicheline", name: "Marie-Micheline" },
  { atom: "mariecunegonde", name: "Marie-Cunégonde" },
  { atom: "mariejeanne", name: "Marie-Jeanne" },
  { atom: "marieelise", name: "Marie-Elise" },
];

const NAMES = new Map<string, string>(
  [...PROPOSERS, ...ACCEPTORS].map((p) => [p.atom, p.name]),
);

export const nameOf = (atom: string): string => NAMES.get(atom) ?? atom;
