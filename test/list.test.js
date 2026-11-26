import { expect, test } from "bun:test";
import {
  DEFAULT_PROMPTS, movePrompt, promptsOrDefault, removePrompt, savePrompt, sendKey,
} from "../herdr-app/mods/prompts/list.js";

const a = { id: "a", title: "A", text: "alpha" };
const b = { id: "b", title: "B", text: "beta" };
const c = { id: "c", title: "C", text: "gamma" };
const ids = (list) => list.map((p) => p.id);

test("a saved list is used as is, including an empty one", () => {
  expect(promptsOrDefault([a])).toEqual([a]);
  expect(promptsOrDefault([])).toEqual([]);
});

test("anything other than a list falls back to the defaults", () => {
  for (const saved of [undefined, null, {}, "x", 3]) {
    expect(promptsOrDefault(saved)).toBe(DEFAULT_PROMPTS);
  }
});

test("send keys differ by terminal and by prompt", () => {
  expect(sendKey("t1", "a")).toBe(sendKey("t1", "a"));
  expect(sendKey("t1", "a")).not.toBe(sendKey("t2", "a"));
  expect(sendKey("t1", "a")).not.toBe(sendKey("t1", "b"));
  // Joining with JSON keeps ids containing separators apart.
  expect(sendKey("t:1", "a")).not.toBe(sendKey("t", "1:a"));
});

test("removing a prompt keeps the others in order", () => {
  expect(ids(removePrompt([a, b, c], "b"))).toEqual(["a", "c"]);
  expect(ids(removePrompt([a, b], "missing"))).toEqual(["a", "b"]);
});

test("dragging down puts the prompt below its target", () => {
  expect(ids(movePrompt([a, b, c], "a", "c"))).toEqual(["b", "c", "a"]);
  expect(ids(movePrompt([a, b, c], "a", "b"))).toEqual(["b", "a", "c"]);
});

test("dragging up puts the prompt above its target", () => {
  expect(ids(movePrompt([a, b, c], "c", "a"))).toEqual(["c", "a", "b"]);
});

test("moving does not change the original list", () => {
  const list = [a, b, c];
  movePrompt(list, "a", "c");
  expect(ids(list)).toEqual(["a", "b", "c"]);
});

test("moving onto itself or an unknown id changes nothing", () => {
  expect(movePrompt([a, b], "a", "a")).toBeNull();
  expect(movePrompt([a, b], "x", "a")).toBeNull();
  expect(movePrompt([a, b], "a", "x")).toBeNull();
});

test("a new prompt goes on top, trimmed", () => {
  const next = savePrompt([a, b], { editingId: null, title: "  New ", text: " body\n" }, "p-1");
  expect(next).toEqual([{ id: "p-1", title: "New", text: "body" }, a, b]);
});

test("editing replaces the prompt in place and keeps its id", () => {
  const next = savePrompt([a, b, c], { editingId: "b", title: "B2", text: "beta 2" }, "unused");
  expect(next).toEqual([a, { id: "b", title: "B2", text: "beta 2" }, c]);
});

test("a blank title or body is not saved", () => {
  expect(savePrompt([a], { editingId: null, title: "  ", text: "x" }, "p")).toBeNull();
  expect(savePrompt([a], { editingId: "a", title: "x", text: "\n " }, "p")).toBeNull();
});
