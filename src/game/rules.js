import {
  DRAW_RULES,
  origins,
  traits,
  weaknesses,
  defs,
  grades,
} from "./data.js";

export function random(n) {
  const a = new Uint32Array(1);
  crypto.getRandomValues(a);
  return Math.floor((a[0] / 4294967296) * n);
}

export function grade(v) {
  return grades.find((g) => v >= g.min);
}

export function statFromTicket(ticket) {
  let cumulative = 0;
  for (const band of DRAW_RULES.bands) {
    cumulative += band.weight;
    if (ticket < cumulative) return band.min + random(band.max - band.min + 1);
  }
  throw Error("Invalid probability configuration");
}

export function generate() {
  const trait =
    traits[
      random(100) < DRAW_RULES.rarePercent
        ? [3, 7][random(2)]
        : [0, 1, 2, 4, 5, 6][random(6)]
    ];
  return {
    origin: random(origins.length),
    stats: defs.map(() => statFromTicket(random(100))),
    trait: trait.name,
    weakness:
      random(100) < DRAW_RULES.weaknessPercent
        ? weaknesses[random(weaknesses.length)].name
        : null,
    id: crypto.randomUUID(),
  };
}

export function valid(f) {
  return (
    f &&
    Number.isInteger(f.origin) &&
    origins[f.origin] &&
    Array.isArray(f.stats) &&
    f.stats.length === 4 &&
    f.stats.every((v) => Number.isInteger(v) && v >= 15 && v <= 100) &&
    traits.some((t) => t.name === f.trait) &&
    (!f.weakness || weaknesses.some((w) => w.name === f.weakness)) &&
    typeof f.id === "string"
  );
}

export function kindFromTicket(ticket) {
  return ticket < 10 ? "major" : ticket < 30 ? "minor" : "ordinary";
}

export function martialPhase(xp) {
  return xp >= 100
    ? "대성"
    : xp >= 80
      ? "숙련"
      : xp >= 50
        ? "소성"
        : xp >= 20
          ? "입문"
          : "초입";
}
