import { calendarDate, DAYS_PER_YEAR, TURNS_PER_DAY } from "./time.js";
import { validateDocument } from "../admin/model.js";

export const eraThemes = {
  demonic: {
    glyph: "劫",
    chapter: "暗流湧動",
    tagline: "고요했던 강호에, 이름 없는 그림자가 드리운다.",
    label: "먹구름 아래의 강호",
  },
  manual: {
    glyph: "秘",
    chapter: "奇書現世",
    tagline: "잊힌 한 장의 전승이, 천하의 발걸음을 움직인다.",
    label: "전승을 찾아 떠나는 강호",
  },
  schism: {
    glyph: "裂",
    chapter: "群雄分立",
    tagline: "하나였던 깃발 아래, 서로 다른 뜻이 일어선다.",
    label: "갈라진 맹약의 강호",
  },
  fallen: {
    glyph: "寂",
    chapter: "巨星隕落",
    tagline: "한 사람의 빈자리에, 오래된 질서가 흔들린다.",
    label: "큰 별이 저문 강호",
  },
  dawn: {
    glyph: "世",
    chapter: "風起江湖",
    tagline: "새로운 바람이 불고, 당신의 이야기가 시작된다.",
    label: "새로운 강호의 시작",
  },
};
export function themeForEra(catalog) {
  const text = catalog.era.id + " " + catalog.era.name;
  if (/demonic|마교|마도/.test(text)) return "demonic";
  if (/manual|비급|전승/.test(text)) return "manual";
  if (/schism|분열/.test(text)) return "schism";
  if (/fallen|죽음|죽은|거성/.test(text)) return "fallen";
  return "dawn";
}
export function validEraCatalog(catalog) {
  try {
    return (
      !!catalog &&
      typeof catalog.era?.id === "string" &&
      catalog.era.status === "published" &&
      typeof catalog.era.description === "string" &&
      catalog.era.description.length <= 5000 &&
      Array.isArray(catalog.objectives) &&
      Array.isArray(catalog.outcomes) &&
      validateDocument(catalog, { publish: true }).length === 0
    );
  } catch {
    return false;
  }
}
export function createEraSnapshot(catalog, turn) {
  if (!validEraCatalog(catalog))
    throw Error("공개된 시대 설정을 확인할 수 없습니다.");
  return {
    schemaVersion: 1,
    ordinal: 1,
    startedTurn: turn,
    endTurn: turn + catalog.era.duration_years * DAYS_PER_YEAR * TURNS_PER_DAY,
    catalog: structuredClone(catalog),
    introSeen: false,
  };
}
export function validEraSnapshot(snapshot) {
  return (
    snapshot?.schemaVersion === 1 &&
    Number.isSafeInteger(snapshot.startedTurn) &&
    snapshot.startedTurn >= 0 &&
    Number.isSafeInteger(snapshot.endTurn) &&
    snapshot.endTurn > snapshot.startedTurn &&
    validEraCatalog(snapshot.catalog)
  );
}
export function eraClock(snapshot, turn) {
  const duration = snapshot.endTurn - snapshot.startedTurn,
    elapsed = Math.max(0, Math.min(duration, turn - snapshot.startedTurn));
  return {
    progress: (elapsed / duration) * 100,
    year: Math.min(
      snapshot.catalog.era.duration_years,
      Math.floor(elapsed / (DAYS_PER_YEAR * TURNS_PER_DAY)) + 1,
    ),
    ended: turn >= snapshot.endTurn,
  };
}
export function eraDateRange(snapshot) {
  const a = calendarDate(snapshot.startedTurn),
    b = calendarDate(snapshot.endTurn - 1);
  return `${a.year}년 ${a.month}월 ${a.day}일 — ${b.year}년 ${b.month}월 ${b.day}일`;
}
