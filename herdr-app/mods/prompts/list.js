// Pure helpers for the saved-prompt list. No Herdr or GPUI imports, so tests can load this file directly.

export const DEFAULT_PROMPTS = [
  {
    id: "pr-review",
    title: "PR Review",
    text: "Check every minute for next 10 min if there is a thumbs up; if so merge; otherwise address the comments and ask for @codex review up to max of 10 times.",
  },
];

// The stored list, or the defaults when nothing valid has been saved yet.
export function promptsOrDefault(saved) {
  return Array.isArray(saved) ? saved : DEFAULT_PROMPTS;
}

// One key per prompt per terminal, so a prompt can't be sent twice to the same terminal at once.
export function sendKey(target, id) {
  return JSON.stringify([target, id]);
}

export function removePrompt(list, id) {
  return list.filter((p) => p.id !== id);
}

// Moves `fromId` to where `toId` is. Returns null when nothing should change.
export function movePrompt(list, fromId, toId) {
  const fromIndex = list.findIndex((p) => p.id === fromId);
  const toIndex = list.findIndex((p) => p.id === toId);
  if (fromIndex === -1 || toIndex === -1 || fromIndex === toIndex) return null;
  const next = [...list];
  const [moved] = next.splice(fromIndex, 1);
  next.splice(toIndex, 0, moved);
  return next;
}

// Edits `editingId` in place, or adds a new prompt at the top. Returns null when the title or text is blank.
export function savePrompt(list, { editingId, title, text }, newId) {
  title = title.trim();
  text = text.trim();
  if (!title || !text) return null;
  if (editingId) return list.map((p) => (p.id === editingId ? { ...p, title, text } : p));
  return [{ id: newId, title, text }, ...list];
}
