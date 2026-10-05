// mulberry32: small, fast and the same sequence on every browser for a given seed.
export function makeRng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// rand:uniform(N) in Erlang returns an integer in 1..N.
export const uniform = (rng: () => number, n: number): number => 1 + Math.floor(rng() * n);
