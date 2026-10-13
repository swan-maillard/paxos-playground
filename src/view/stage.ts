import { ACCEPTORS, PROPOSERS, nameOf } from "../paxy/cast";
import type { Kind } from "../paxy/messages";
import type { Sim } from "../paxy/sim";
import type { Proposer } from "../paxy/proposer";
import type { Acceptor } from "../paxy/acceptor";
import { shortTuple } from "./words";

const SVG = "http://www.w3.org/2000/svg";

interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

interface Layout {
  width: number;
  height: number;
  narrow: boolean;
  nodes: Map<string, Box>;
  anchors: Map<string, { x: number; y: number }>;
}

// Requests are amber outlines, good answers are filled amber, refusals are grey.
const PILL: Record<Kind, { fill: string; stroke: string; text: string }> = {
  prepare: { fill: "#0D161C", stroke: "#EA9A27", text: "#FFB44A" },
  accept: { fill: "#0D161C", stroke: "#FFB44A", text: "#FFB44A" },
  promise: { fill: "#EA9A27", stroke: "#EA9A27", text: "#0D161C" },
  vote: { fill: "#FFB44A", stroke: "#FFB44A", text: "#0D161C" },
  sorry: { fill: "#263741", stroke: "#A5B1BC", text: "#D5DCE2" },
};

function el<K extends keyof SVGElementTagNameMap>(tag: K, attrs: Record<string, string | number>, text?: string) {
  const node = document.createElementNS(SVG, tag);
  for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, String(v));
  if (text !== undefined) node.textContent = text;
  return node;
}

// Wide screens: proposers in a row above the acceptors. Phones: two columns side by side.
function layout(width: number): Layout {
  const narrow = width < 640;
  const nodes = new Map<string, Box>();
  const anchors = new Map<string, { x: number; y: number }>();
  if (narrow) {
    const ah = 68;
    const gap = 10;
    const height = ACCEPTORS.length * ah + (ACCEPTORS.length - 1) * gap + 8;
    const pw = Math.round(width * 0.34);
    const aw = Math.round(width * 0.41);
    const ph = 76;
    PROPOSERS.forEach((p, i) => {
      const cy = (height * (i + 0.5)) / PROPOSERS.length;
      const box = { x: 1, y: cy - ph / 2, w: pw, h: ph };
      nodes.set(p.atom, box);
      anchors.set(p.atom, { x: box.x + box.w, y: cy });
    });
    ACCEPTORS.forEach((a, i) => {
      const box = { x: width - aw - 1, y: 4 + i * (ah + gap), w: aw, h: ah };
      nodes.set(a.atom, box);
      anchors.set(a.atom, { x: box.x, y: box.y + ah / 2 });
    });
    return { width, height, narrow, nodes, anchors };
  }
  const height = 340;
  const pw = Math.min(200, width / 3 - 24);
  const ph = 70;
  PROPOSERS.forEach((p, i) => {
    const cx = (width * (i + 0.5)) / 3;
    nodes.set(p.atom, { x: cx - pw / 2, y: 4, w: pw, h: ph });
    anchors.set(p.atom, { x: cx, y: 4 + ph });
  });
  const aw = Math.min(170, width / 5 - 12);
  const ah = 72;
  ACCEPTORS.forEach((a, i) => {
    const cx = (width * (i + 0.5)) / 5;
    nodes.set(a.atom, { x: cx - aw / 2, y: height - ah - 4, w: aw, h: ah });
    anchors.set(a.atom, { x: cx, y: height - ah - 4 });
  });
  return { width, height, narrow, nodes, anchors };
}

export class Stage {
  private svg: SVGSVGElement;
  private wires = el("g", {});
  private nodesG = el("g", {});
  private msgsG = el("g", {});
  private lay: Layout;

  constructor(private host: HTMLElement) {
    this.svg = el("svg", { role: "img", "aria-labelledby": "stage-title" });
    this.svg.append(
      el("title", { id: "stage-title" }, "Three proposers at the top and five acceptors at the bottom, with Paxos messages travelling between them."),
    );
    this.svg.append(this.wires, this.nodesG, this.msgsG);
    host.append(this.svg);
    this.lay = layout(800);
    this.resize();
  }

  resize(): void {
    const css = getComputedStyle(this.host);
    const inner = this.host.clientWidth - parseFloat(css.paddingLeft) - parseFloat(css.paddingRight);
    this.lay = layout(Math.max(280, Math.floor(inner)));
    const { width, height } = this.lay;
    this.svg.setAttribute("viewBox", `0 0 ${width} ${height}`);
    this.svg.setAttribute("width", String(width));
    this.svg.setAttribute("height", String(height));
    this.wires.replaceChildren();
    for (const p of PROPOSERS)
      for (const a of ACCEPTORS) {
        const from = this.lay.anchors.get(p.atom)!;
        const to = this.lay.anchors.get(a.atom)!;
        this.wires.append(el("line", { x1: from.x, y1: from.y, x2: to.x, y2: to.y, class: "wire" }));
      }
  }

  render(sim: Sim, time: number, active: Set<string>): void {
    this.nodesG.replaceChildren(
      ...sim.proposers.map((p) => this.proposerNode(p, active.has(p.atom))),
      ...sim.acceptors.map((a) => this.acceptorNode(a, active.has(a.atom))),
    );
    const pills: SVGGElement[] = [];
    for (const env of sim.inFlight) {
      const span = env.arriveAt - env.sentAt;
      const t = span > 0 ? Math.min(1, Math.max(0, (time - env.sentAt) / span)) : 1;
      let opacity = 1;
      // A lost message fades out halfway, so you can see it leave and never land.
      if (env.lost) {
        if (t > 0.6) continue;
        opacity = t < 0.4 ? 1 : 1 - (t - 0.4) / 0.2;
      }
      const a = this.lay.anchors.get(env.from)!;
      const b = this.lay.anchors.get(env.to)!;
      pills.push(this.pill(env.msg.kind, a.x + (b.x - a.x) * t, a.y + (b.y - a.y) * t, opacity, env.lost));
    }
    this.msgsG.replaceChildren(...pills);
  }

  private pill(kind: Kind, x: number, y: number, opacity: number, lost: boolean) {
    const style = PILL[kind];
    const w = kind.length * 7.4 + 14;
    const g = el("g", { transform: `translate(${x.toFixed(1)} ${y.toFixed(1)})`, opacity: opacity.toFixed(2) });
    g.append(
      el("rect", {
        x: -w / 2,
        y: -10,
        width: w,
        height: 20,
        rx: 2,
        fill: style.fill,
        stroke: style.stroke,
        "stroke-width": 1.5,
        ...(lost ? { "stroke-dasharray": "3 3" } : {}),
      }),
      el("text", { x: 0, y: 4.5, "text-anchor": "middle", class: "pill-text", fill: style.text }, kind),
    );
    return g;
  }

  private card(box: Box, opts: { active: boolean; done?: boolean; down?: boolean }) {
    const stroke = opts.down ? "#6B7B88" : opts.active || opts.done ? "#EA9A27" : "rgba(255,255,255,0.16)";
    return el("rect", {
      x: box.x,
      y: box.y,
      width: box.w,
      height: box.h,
      rx: 3,
      fill: opts.down ? "#121E26" : "#18262F",
      stroke,
      "stroke-width": opts.active ? 2 : 1,
      ...(opts.down ? { "stroke-dasharray": "5 4" } : {}),
    });
  }

  private proposerNode(p: Proposer, active: boolean) {
    const box = this.lay.nodes.get(p.atom)!;
    const narrow = this.lay.narrow;
    const g = el("g", {});
    g.append(this.card(box, { active, done: !!p.decided }));
    const x = box.x + (narrow ? 8 : 12);
    g.append(el("text", { x, y: box.y + 22, class: narrow ? "node-name small" : "node-name" }, nameOf(p.atom)));
    const status = p.decided ? `decided ${p.decided.value}` : p.phase === "sleeping" ? `wants ${p.proposal}` : `proposes ${p.value}`;
    g.append(el("text", { x, y: box.y + 42, class: p.decided ? "node-strong" : "node-line" }, status));
    const round = p.phase === "sleeping" ? "not started" : `round ${p.round.n}`;
    g.append(el("text", { x, y: box.y + 60, class: "node-dim" }, round));
    return g;
  }

  private acceptorNode(a: Acceptor, active: boolean) {
    const box = this.lay.nodes.get(a.atom)!;
    const narrow = this.lay.narrow;
    const g = el("g", {});
    g.append(this.card(box, { active, down: a.down }));
    const full = nameOf(a.atom);
    const x = box.x + (narrow ? 8 : 12);
    const [y1, y2, y3] = narrow ? [21, 41, 59] : [22, 42, 60];
    g.append(el("text", { x, y: box.y + y1, class: narrow ? "node-name small" : "node-name" }, full));
    if (a.down) {
      g.append(el("text", { x, y: box.y + y2, class: "node-dim" }, "crashed"));
      return g;
    }
    g.append(el("text", { x, y: box.y + y2, class: "node-line" }, `promised ${shortTuple(a.promised)}`));
    const vote = a.value === null ? "no vote yet" : `voted ${a.value} ${shortTuple(a.voted)}`;
    g.append(el("text", { x, y: box.y + y3, class: a.value ? "node-strong" : "node-dim" }, vote));
    return g;
  }
}
