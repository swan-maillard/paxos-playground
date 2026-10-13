import "@fontsource/josefin-sans/latin-500";
import "@fontsource/barlow/latin-400";
import "@fontsource/barlow/latin-500";
import "@fontsource/barlow-condensed/latin-500";
import "./style.css";

import { Sim } from "./paxy/sim";
import type { Note } from "./paxy/notes";
import { Stage } from "./view/stage";
import { Panel } from "./view/panel";
import { narrate } from "./view/narrate";
import { ms } from "./view/words";

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;

const playButton = $<HTMLButtonElement>("play");
const stepButton = $<HTMLButtonElement>("step");
const resetButton = $<HTMLButtonElement>("reset");
const speedInput = $<HTMLInputElement>("speed");
const delayInput = $<HTMLInputElement>("delay");
const dropInput = $<HTMLInputElement>("drop");
const startSelect = $<HTMLSelectElement>("start");
const seedInput = $<HTMLInputElement>("seed");
const clock = $<HTMLSpanElement>("clock");
const story = $<HTMLOListElement>("story");
const live = $<HTMLParagraphElement>("live");

const stage = new Stage($("stage"));
const panel = new Panel(toggleAcceptor);

let sim = makeSim();
let view = 0;
let playing = false;
let hold = 0;
let lastFrame = 0;
let lastAnnounce = 0;
let onScreen = true;
let active = new Set<string>();
const lines: string[] = [];

function makeSim(): Sim {
  const seed = Math.max(1, Math.floor(Number(seedInput.value)) || 1);
  seedInput.value = String(seed);
  return new Sim({
    seed,
    sleeps: startSelect.value.split(",").map(Number),
    delay: Number(delayInput.value),
    drop: Number(dropInput.value) / 100,
  });
}

const speed = () => 2 ** (Number(speedInput.value) / 2);

// Sim milliseconds per real millisecond. Scaling by the expected trip time means a message
// takes about a second to cross at 1×, whatever the delay slider says.
const rate = () => (speed() * (3 + Number(delayInput.value) / 2)) / 1000;

function setPlaying(on: boolean): void {
  playing = on;
  playButton.textContent = on ? "Pause" : "Play";
  hold = 0;
  if (!on) announce(lines[0] ?? "", true);
}

function show(notes: Note[]): void {
  if (!notes.length) return;
  active = new Set();
  for (const n of notes) {
    for (const key of ["proposer", "acceptor"] as const) if (key in n) active.add((n as Record<string, unknown>)[key] as string);
    if ("env" in n) active.add(n.env.to);
  }
  const text = notes.map(narrate);
  lines.unshift(...text.reverse());
  lines.length = Math.min(lines.length, 6);
  story.replaceChildren(
    ...lines.map((line, i) => {
      const li = document.createElement("li");
      li.textContent = line;
      if (i >= text.length) li.className = "old";
      return li;
    }),
  );
  announce(text.slice().reverse().join(" "), !playing);
}

// Screen readers get every step when paused, and a sentence every few seconds while playing.
function announce(text: string, now: boolean): void {
  const t = performance.now();
  if (!now && t - lastAnnounce < 4000) return;
  lastAnnounce = t;
  live.textContent = text;
}

function advanceTo(time: number): void {
  const before = sim.log.length;
  sim.runUntil(time);
  view = time;
  show(sim.log.slice(before));
}

function step(): void {
  setPlaying(false);
  const before = sim.log.length;
  sim.stepMessage();
  view = sim.now;
  show(sim.log.slice(before));
  draw();
}

function draw(): void {
  stage.render(sim, view, active);
  panel.update(sim);
  clock.textContent = `t = ${ms(view)}`;
  stepButton.disabled = sim.peekTime() === null;
}

function frame(t: number): void {
  const dt = Math.min(64, t - (lastFrame || t));
  lastFrame = t;
  if (playing && onScreen && !document.hidden) {
    if (sim.inFlight.size > 0) {
      hold = 0;
      advanceTo(view + dt * rate());
    } else if (sim.allDecided) {
      setPlaying(false);
    } else {
      // Nothing on the wire: pause on the last event for a moment, then skip the idle time.
      hold += dt;
      if (hold >= 600 / speed()) {
        hold = 0;
        const next = sim.peekTime();
        if (next === null) setPlaying(false);
        else advanceTo(next);
      }
    }
    draw();
  }
  requestAnimationFrame(frame);
}

function reset(): void {
  setPlaying(false);
  sim = makeSim();
  view = 0;
  active = new Set();
  lines.length = 0;
  panel.reset();
  story.replaceChildren();
  const li = document.createElement("li");
  li.textContent = "Nothing yet. Press Play, or Step to go one message at a time.";
  story.append(li);
  draw();
}

function toggleAcceptor(atom: string): void {
  const before = sim.log.length;
  if (sim.acceptor(atom).down) sim.restart(atom);
  else sim.crash(atom);
  show(sim.log.slice(before));
  draw();
}

function syncOutputs(): void {
  $("speed-out").textContent = `${speed().toLocaleString("en-GB", { maximumFractionDigits: 2 })}×`;
  $("delay-out").textContent = ms(Number(delayInput.value));
  $("drop-out").textContent = `${dropInput.value}%`;
  sim.network.delay = Number(delayInput.value);
  sim.network.drop = Number(dropInput.value) / 100;
}

playButton.addEventListener("click", () => setPlaying(!playing));
stepButton.addEventListener("click", step);
resetButton.addEventListener("click", reset);
startSelect.addEventListener("change", reset);
seedInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") reset();
});
for (const input of [speedInput, delayInput, dropInput]) input.addEventListener("input", syncOutputs);

new ResizeObserver(() => {
  stage.resize();
  draw();
}).observe($("stage"));

new IntersectionObserver((entries) => {
  onScreen = entries.some((e) => e.isIntersecting);
}).observe($("stage"));

syncOutputs();
reset();
requestAnimationFrame(frame);
