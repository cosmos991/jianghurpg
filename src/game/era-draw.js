import { eraTypes, eraTemplates, ERA_POOL_VERSION } from "./era-candidates.js";
import { validateDocument } from "../admin/model.js";

export function normalizeSeed(seed) {
  if (typeof seed !== "string" || !seed.trim() || seed.trim().length > 128)
    throw Error("시드값은 1~128자로 입력해주세요.");
  return seed.trim();
}
// FNV-1a seed hash followed by Mulberry32. Keep this algorithm versioned for replay.
export function seededRandom(seed) {
  let state = 2166136261;
  for (let i = 0; i < seed.length; i++)
    state = Math.imul(state ^ seed.charCodeAt(i), 16777619) >>> 0;
  return () => {
    let t = (state += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
export function pickWeighted(items, random) {
  if (
    !items.length ||
    items.some(
      (x) =>
        !Number.isSafeInteger(x.weight) || x.weight < 1 || x.weight > 10000,
    )
  )
    throw Error("추첨 후보와 가중치를 확인해주세요.");
  const value = random();
  if (!Number.isFinite(value) || value < 0 || value >= 1)
    throw Error("추첨 난수의 범위가 올바르지 않습니다.");
  const total = items.reduce((sum, x) => sum + x.weight, 0);
  let ticket = value * total;
  for (const item of items) {
    if (ticket < item.weight) return item;
    ticket -= item.weight;
  }
  return items.at(-1);
}
export function drawEra({
  seed,
  typeId = null,
  templates = eraTemplates,
} = {}) {
  seed = normalizeSeed(seed);
  const active = templates.filter((t) => t.enabled);
  if (
    new Set(active.map((t) => t.id)).size !== active.length ||
    active.some(
      (t) =>
        !eraTypes.some((type) => type.id === t.typeId) ||
        !Number.isSafeInteger(t.weight) ||
        t.weight < 1 ||
        t.weight > 10000 ||
        t.id !== t.catalog?.era?.id ||
        validateDocument(t.catalog, { publish: true }).length,
    )
  )
    throw Error("시대 템플릿 구성이 올바르지 않습니다.");
  const types = eraTypes.filter((type) =>
    active.some((t) => t.typeId === type.id),
  );
  if (typeId !== null && !types.some((t) => t.id === typeId))
    throw Error("선택한 유형에 추첨할 템플릿이 없습니다.");
  const random = seededRandom("era-draw-v1:" + seed);
  const type =
    typeId === null
      ? pickWeighted(types, random)
      : types.find((t) => t.id === typeId);
  const candidates = active.filter((t) => t.typeId === type.id);
  const template = pickWeighted(candidates, random);
  const typeChance =
    typeId === null ? type.weight / types.reduce((s, t) => s + t.weight, 0) : 1;
  const templateChance =
    template.weight / candidates.reduce((s, t) => s + t.weight, 0);
  return {
    algorithm: "era-draw-v1",
    poolVersion: ERA_POOL_VERSION,
    seed,
    mode: typeId === null ? "random" : "forced",
    type: { id: type.id, name: type.name },
    template: structuredClone(template),
    chances: {
      type: typeChance,
      template: templateChance,
      combined: typeChance * templateChance,
    },
  };
}
export function sampleEras(seed, typeId = null, count = 1000) {
  seed = normalizeSeed(seed);
  if (!Number.isInteger(count) || count < 1 || count > 10000)
    throw Error("분포 검사는 1~10,000회까지 가능합니다.");
  const counts = Object.fromEntries(
    eraTemplates
      .filter((t) => t.enabled && (typeId === null || t.typeId === typeId))
      .map((t) => [t.id, 0]),
  );
  const random = seededRandom("era-batch-v1:" + seed);
  for (let i = 0; i < count; i++) {
    // Keep derived seeds bounded even when the user supplied all 128 characters.
    const result = drawEra({
      seed:
        i === 0
          ? seed
          : Math.floor(random() * 4294967296).toString(16) + "-" + i,
      typeId,
    });
    counts[result.template.id]++;
  }
  return { count, counts };
}
