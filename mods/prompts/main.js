// Saved Prompts panel & editor dialog for Herdr.
// Click a prompt to paste it into the active console window without pressing Enter.
// Hover a prompt for quick Send (paste + Enter), Edit, and Delete actions, or right-click to edit.

import { View, div, svg } from "gpui-kit";
import { v_flex, h_flex, InputState, Input, TextareaState, Textarea } from "gpui-base";
import {
  checking,
  closeOverlay,
  exec,
  focused,
  notify,
  openOverlay,
  props,
  run,
  setShared,
  shared,
  theme,
} from "herdr";

const SHARED_KEY = "prompts.items";
// Herdr Core can wait up to 60 seconds for an unfinished draft by default.
const SEND_TIMEOUT_MS = 75_000;

const DEFAULT_PROMPTS = [
  {
    id: "pr-review",
    title: "PR Review",
    text: "Check every minute for next 10 min if there is a thumbs up; if so merge; otherwise address the comments and ask for @codex review up to max of 10 times.",
  },
];

function getPrompts() {
  const saved = shared(SHARED_KEY);
  return Array.isArray(saved) ? saved : DEFAULT_PROMPTS;
}

function sendKey(target, id) {
  return JSON.stringify([target, id]);
}

export default class Prompts extends View {
  init(_props, cx) {
    this.width = Infinity;
    this.hoveredId = null;
    this.flashId = null;
    this.pendingSends = new Set();
    this.pressed = null;
    this.over = null;

    const p = props() ?? {};
    if (p.editor) {
      this.editingId = p.prompt?.id ?? null;
      this.titleInput = InputState.new({
        value: p.prompt?.title ?? "",
        placeholder: "e.g. PR Review",
      });
      this.bodyInput = TextareaState.new({
        value: p.prompt?.text ?? "",
        placeholder: "Enter the prompt to paste into the active console…",
        rows: 6,
      });
      this.titleFocused = true;
      this.bodyFocused = false;
      this.titleInput.on("change", (_e, cx) => cx.notify());
      this.titleInput.on("focus", (_e, cx) => { this.titleFocused = true; cx.notify(); });
      this.titleInput.on("blur", (_e, cx) => { this.titleFocused = false; cx.notify(); });
      this.titleInput.on("submit", () => this.bodyInput.focus());
      this.bodyInput.on("change", (_e, cx) => cx.notify());
      this.bodyInput.on("focus", (_e, cx) => { this.bodyFocused = true; cx.notify(); });
      this.bodyInput.on("blur", (_e, cx) => { this.bodyFocused = false; cx.notify(); });
      this.handle = cx.focus_handle();
      if (!checking()) {
        this.titleInput.focus();
        cx.timer.after(200, () => this.titleInput.focus());
      }
      return;
    }

    if (!checking() && !Array.isArray(shared(SHARED_KEY))) {
      setShared(SHARED_KEY, DEFAULT_PROMPTS);
    }
  }

  openEditor(prompt = null) {
    openOverlay({
      mod: "prompts",
      kind: "dialog",
      width: 480,
      props: { editor: true, prompt },
    });
  }

  flash(id, cx) {
    this.flashId = id;
    cx.notify();
    cx.timer.after(1200, (cx) => {
      if (this.flashId === id) {
        this.flashId = null;
        cx.notify();
      }
    });
  }

  // Click on a prompt row: paste text directly into the active console window (no Enter).
  pastePrompt(item, cx) {
    const f = focused();
    const target = f?.shown ?? f?.terminal;
    if (!target) {
      notify({ title: "No active console", body: "Click a terminal pane first.", level: "warning" });
      return;
    }
    if (this.pendingSends.has(sendKey(target, item.id))) return;
    cx.write_to_clipboard(item.text);
    if (f.pane) run("pane.focus", { pane: f.pane });
    else run("pane.focus", { terminal: target });
    run("terminal.paste");
    this.flash(item.id, cx);
  }

  // Send button: paste text and press Enter via herdr-core.
  sendPrompt(item, cx) {
    const f = focused();
    const target = f?.shown ?? f?.terminal;
    if (!target) {
      notify({ title: "No active console", body: "Click a terminal pane first.", level: "warning" });
      return;
    }
    const key = sendKey(target, item.id);
    if (this.pendingSends.has(key)) return;

    if (f.pane) run("pane.focus", { pane: f.pane });
    else run("pane.focus", { terminal: target });
    this.pendingSends.add(key);
    cx.notify();
    cx.spawn(async (cx) => {
      try {
        const r = await exec("hc", ["send", "--force", target, item.text], { timeout: SEND_TIMEOUT_MS });
        if (r.code !== 0) {
          notify({
            title: "Could not send prompt",
            body: r.stderr.trim() || `hc exited with ${r.code}`,
            level: "error",
          });
        } else {
          this.flash(item.id, cx);
        }
      } catch (e) {
        notify({ title: "Could not send prompt", body: String(e?.message ?? e), level: "error" });
      } finally {
        this.pendingSends.delete(key);
        cx.notify();
      }
    });
  }

  deletePrompt(id) {
    const next = getPrompts().filter((p) => p.id !== id);
    setShared(SHARED_KEY, next);
  }

  movePrompt(fromId, toId) {
    const list = [...getPrompts()];
    const fromIndex = list.findIndex((p) => p.id === fromId);
    const toIndex = list.findIndex((p) => p.id === toId);
    if (fromIndex === -1 || toIndex === -1 || fromIndex === toIndex) return;
    const [moved] = list.splice(fromIndex, 1);
    list.splice(toIndex, 0, moved);
    setShared(SHARED_KEY, list);
  }

  saveEditor() {
    const title = this.titleInput.value().trim();
    const text = this.bodyInput.value().trim();
    if (!title || !text) return;

    const current = getPrompts();
    let next;
    if (this.editingId) {
      next = current.map((p) => (p.id === this.editingId ? { ...p, title, text } : p));
    } else {
      next = [{ id: `p-${Date.now()}`, title, text }, ...current];
    }
    setShared(SHARED_KEY, next);
    closeOverlay(props().overlay);
  }

  renderEditor(t) {
    const overlay = props().overlay;
    const titleVal = this.titleInput.value().trim();
    const bodyVal = this.bodyInput.value().trim();
    const canSave = Boolean(titleVal && bodyVal);

    const label = (text) => div().pt(14).pb(6).text_size(11.5).text_color(t.dim).child(text);
    const button = (id, text, style, action, disabled = false) => {
      const bg = style === "primary"
        ? (disabled ? t.raised : t.solid)
        : style === "danger"
          ? t.raised
          : t.raised;
      const border = style === "primary" && !disabled ? t.solid : t.input;
      const fg = style === "primary"
        ? (disabled ? t.dim : t.solid_foreground)
        : style === "danger"
          ? t.ansi1
          : t.foreground;
      return h_flex()
        .id(id)
        .h(32)
        .px(14)
        .items_center()
        .rounded(8)
        .border_1()
        .border_color(border)
        .bg(bg)
        .text_color(fg)
        .text_size(12.5)
        .font_medium()
        .when(!disabled, (el) => el.cursor_pointer().hover((s) => s.opacity(0.88)))
        .on_click((e, cx) => { if (!disabled) action(e, cx); })
        .child(text);
    };

    return v_flex()
      .id("prompt-editor")
      .track_focus(this.handle)
      .on_key_down((e, cx) => {
        if (e.key === "escape") {
          closeOverlay(overlay);
          cx.stop_propagation();
        } else if (e.keystroke === "cmd-enter" || e.keystroke === "ctrl-enter") {
          this.saveEditor();
          cx.stop_propagation();
        }
      })
      .w_full()
      .min_h(0)
      .p(18)
      .bg(t.popover)
      .text_color(t.foreground)
      .child(
        h_flex()
          .items_center()
          .child(div().flex_1().text_size(15).font_semibold().child(this.editingId ? "Edit Prompt" : "New Prompt"))
          .child(div().text_size(11).text_color(t.dim).child("Esc")),
      )
      .child(label("Title"))
      .child(
        Input.new(this.titleInput)
          .h(36)
          .px(10)
          .rounded(9)
          .border_1()
          .border_color(this.titleFocused ? t.accent : t.input)
          .bg(t.background)
          .text_size(12.8)
          .text_color(t.foreground),
      )
      .child(label("Prompt"))
      .child(
        Textarea.new(this.bodyInput)
          .w_full()
          .h(140)
          .p(10)
          .rounded(9)
          .border_1()
          .border_color(this.bodyFocused ? t.accent : t.input)
          .bg(t.background)
          .text_size(12.8)
          .text_color(t.foreground),
      )
      .child(
        div()
          .pt(6)
          .text_size(11)
          .text_color(t.dim)
          .child("Click a saved prompt in the sidebar to paste it into the active console. ⌘↵ saves."),
      )
      .child(
        h_flex()
          .pt(18)
          .gap(8)
          .items_center()
          .when(Boolean(this.editingId), (el) =>
            el.child(
              button("pm-delete", "Delete", "danger", () => {
                this.deletePrompt(this.editingId);
                closeOverlay(overlay);
              }),
            ),
          )
          .child(div().flex_1())
          .child(button("pm-cancel", "Cancel", "secondary", () => closeOverlay(overlay)))
          .child(button("pm-save", "Save", "primary", () => this.saveEditor(), !canSave)),
      );
  }

  actionBtn(t, id, tooltip, content, action) {
    return h_flex()
      .id(id)
      .size(20)
      .flex_none()
      .rounded(5)
      .items_center()
      .justify_center()
      .text_color(t.dim)
      .when(Boolean(action), (el) => el.cursor_pointer().hover((s) => s.bg(t.raised).text_color(t.foreground)))
      .when(!action, (el) => el.cursor_not_allowed().opacity(0.5))
      .tooltip(tooltip)
      .on_mouse_down("left", (_e, cx) => cx.stop_propagation())
      .on_click((_e, cx) => {
        cx.stop_propagation();
        action?.(cx);
      })
      .child(content);
  }

  row(t, item, index, fromIndex, narrow, target) {
    const dragging = this.pressed !== null && this.over !== this.pressed;
    const hovered = !dragging && this.hoveredId === item.id;
    const flashed = this.flashId === item.id;
    const sending = this.pendingSends.has(sendKey(target, item.id));

    if (narrow) {
      return h_flex()
        .id(`pm-${item.id}`)
        .h(28)
        .w(32)
        .flex_none()
        .rounded(6)
        .items_center()
        .justify_center()
        .cursor_pointer()
        .hover((s) => s.bg(t.hover))
        .tooltip(`${item.title}\n${item.text}`)
        .on_click((_e, cx) => this.pastePrompt(item, cx))
        .on_mouse_down("right", () => this.openEditor(item))
        .child(
          svg(flashed ? "mods/workspace-chrome/check.svg" : "mods/workspace-chrome/file-text.svg")
            .size(14)
            .text_color(flashed ? t.ansi2 : t.muted),
        );
    }

    const iconName = flashed
      ? "mods/workspace-chrome/check.svg"
      : "mods/workspace-chrome/file-text.svg";
    const iconColor = flashed ? t.ansi2 : hovered ? t.foreground : t.dim;

    return h_flex()
      .relative()
      .id(`pm-${item.id}`)
      .h(28)
      .px(8)
      .flex_none()
      .rounded(8)
      .items_center()
      .gap(8)
      .cursor_pointer()
      .hover((s) => s.bg(t.hover))
      .when(this.pressed === item.id && this.over !== item.id, (el) => el.opacity(0.5))
      .when(this.pressed !== null && this.over === item.id && this.pressed !== item.id, (el) =>
        el.child(
          div()
            .absolute()
            .left(0)
            .right(0)
            .h(2)
            .bg(t.accent)
            .when(fromIndex < index, (line) => line.bottom(0))
            .when(fromIndex > index, (line) => line.top(0)),
        ),
      )
      .tooltip(item.text)
      .on_hover((isHover, cx) => {
        const next = isHover ? item.id : (this.hoveredId === item.id ? null : this.hoveredId);
        if (next !== this.hoveredId) {
          this.hoveredId = next;
          cx.notify();
        }
      })
      .on_mouse_down("left", () => {
        this.pressed = item.id;
        this.over = item.id;
      })
      .on_mouse_move((_e, cx) => {
        if (this.pressed !== null && this.over !== item.id) {
          this.over = item.id;
          cx.notify();
        }
      })
      .on_mouse_up("left", (_e, cx) => {
        const from = this.pressed;
        const over = this.over;
        this.pressed = null;
        this.over = null;
        if (from !== null && over === item.id && from !== item.id) {
          this.movePrompt(from, item.id);
        } else if (from === item.id) {
          this.pastePrompt(item, cx);
        }
        cx.notify();
      })
      .on_mouse_down("right", () => this.openEditor(item))
      .child(svg(iconName).size(14).flex_none().text_color(iconColor))
      .child(
        div()
          .flex_1()
          .min_w(0)
          .truncate()
          .text_color(flashed ? t.ansi2 : t.foreground)
          .child(sending ? `${item.title}…` : item.title),
      )
      .when(hovered || sending, (el) =>
        el.child(
          h_flex()
            .flex_none()
            .gap(2)
            .items_center()
            .child(
              this.actionBtn(
                t,
                `pm-run-${item.id}`,
                sending ? "Sending…" : "Send & press Enter",
                div().text_size(11).child("↵"),
                sending ? null : (cx) => this.sendPrompt(item, cx),
              ),
            )
            .child(
              this.actionBtn(
                t,
                `pm-edit-${item.id}`,
                "Edit prompt",
                svg("mods/workspace-chrome/square-pen.svg").size(12),
                () => this.openEditor(item),
              ),
            )
            .child(
              this.actionBtn(
                t,
                `pm-del-${item.id}`,
                "Delete prompt",
                svg("mods/workspace-chrome/x.svg").size(12),
                () => this.deletePrompt(item.id),
              ),
            ),
        ),
      );
  }

  clearDrag(cx) {
    if (this.pressed === null && this.over === null) return;
    this.pressed = null;
    this.over = null;
    cx.notify();
  }

  render() {
    const t = theme();
    if (props()?.editor) return this.renderEditor(t);

    const narrow = this.width < 160;
    const list = getPrompts();
    const f = focused();
    const target = f?.shown ?? f?.terminal;
    const fromIndex = this.pressed === null ? -1 : list.findIndex((p) => p.id === this.pressed);

    return v_flex()
      .id("root")
      .on_size_change((size, cx) => {
        if (size.width === this.width) return;
        this.width = size.width;
        cx.notify();
      })
      .on_hover((hovered, cx) => {
        if (!hovered) this.clearDrag(cx);
      })
      .on_mouse_up("left", (_e, cx) => this.clearDrag(cx))
      .on_mouse_down_out((_e, cx) => this.clearDrag(cx))
      .size_full()
      .min_h(0)
      .bg(t.chrome)
      .border_t(1)
      .border_color(t.border)
      .text_size(13)
      .child(
        h_flex()
          .h(34)
          .pl(narrow ? 0 : 16)
          .pr(narrow ? 0 : 10)
          .flex_none()
          .items_center()
          .justify_between()
          .when(narrow, (el) => el.justify_center())
          .when(!narrow, (el) =>
            el.child(div().text_size(11.5).font_medium().text_color(t.dim).child("Prompts")),
          )
          .child(
            div()
              .id("prompt-new")
              .size(24)
              .flex_none()
              .flex()
              .items_center()
              .justify_center()
              .rounded(6)
              .text_color(t.dim)
              .cursor_pointer()
              .hover((s) => s.bg(t.hover).text_color(t.foreground))
              .tooltip("New prompt")
              .on_click(() => this.openEditor(null))
              .child(svg("mods/workspace-chrome/plus.svg").size(14)),
          ),
      )
      .when(!list.length && !narrow, (el) =>
        el.child(
          div()
            .id("prompts-empty")
            .px(16)
            .pb(8)
            .text_size(12)
            .text_color(t.dim)
            .child("Click + to save a prompt."),
        ),
      )
      .child(
        v_flex()
          .id("prompts-list")
          .flex_1()
          .min_h(0)
          .px(narrow ? 0 : 8)
          .pb(8)
          .when(narrow, (el) => el.items_center())
          .overflow_y_scrollbar()
          .mode("always")
          .children(list.map((item, index) => this.row(t, item, index, fromIndex, narrow, target))),
      );
  }
}
