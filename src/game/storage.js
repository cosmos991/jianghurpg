// Keep the original key so existing saves on the same origin remain compatible.
export const SAVE_KEY = "jianghu-fate-v1";

export function loadSave(storage = globalThis.localStorage) {
  try {
    return JSON.parse(storage.getItem(SAVE_KEY));
  } catch {
    return null;
  }
}

export function saveGame(state, storage = globalThis.localStorage) {
  storage.setItem(SAVE_KEY, JSON.stringify(state));
}
