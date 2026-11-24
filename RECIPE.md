# Saved Prompts

Save prompts you use often in the Herdr sidebar. Click to paste one into the
active terminal or agent and edit it before sending, or click ↵ to submit it
immediately.

![Prompts](preview.png)

## What you see

- **Sidebar panel (`mods/prompts/`):** Fills its sidebar block on `theme().chrome` with a `1px` top `theme().border`, `13px` base text size.
  - **Header (`34px` tall, `16px` left / `10px` right padding):** `"Prompts"` in `11.5px` medium `theme().dim` on the left, and a `24×24px` rounded (`6px`) `+` button (`mods/workspace-chrome/plus.svg`, `14px`) on the right. In compact rail mode (`width < 160px`), only the centered `+` button shows.
  - **Scrollable list (`8px` horizontal padding, `8px` bottom padding):** One `28px`-tall rounded (`8px`) row per saved prompt, containing a `14px` document icon (`mods/workspace-chrome/file-text.svg` in `theme().dim`, turning to `mods/workspace-chrome/check.svg` in `theme().ansi2` for `1.2s` after pasting/sending) and the truncated prompt title in `theme().foreground`. Hovering highlights the row with `theme().hover`, displays the full prompt text as a tooltip, and reveals three `20×20px` action buttons on the right: `↵` (Send & press Enter), edit (`mods/workspace-chrome/square-pen.svg`, `12px`), and delete (`mods/workspace-chrome/x.svg`, `12px`). In compact rail mode, each row collapses to a centered `32×28px` icon button with a title + body tooltip.
  - **Empty state:** When no prompts remain (and not narrow), shows `"Click + to save a prompt."` in `12px` `theme().dim`.
- **Add / Edit dialog (`kind: "dialog"`, `width: 480px`):** `theme().popover` background, `18px` padding, `"New Prompt"` or `"Edit Prompt"` (`15px` semibold) with `"Esc"` (`11px` `theme().dim`), a `36px`-tall `Input` for `"Title"`, a `140px`-tall `Textarea` for `"Prompt"`, a short `11px` usage hint, and footer buttons (`Delete` in `theme().ansi1` when editing, `Cancel`, and primary `Save` using `theme().solid` / `theme().solid_foreground`).

## How it behaves

- **Click a prompt row:** Focuses the currently focused terminal (`focused()?.shown ?? focused()?.terminal`) via `pane.focus`, writes the prompt text to the clipboard (`cx.write_to_clipboard`), and runs `terminal.paste` so the text lands in the active console without pressing Enter. Flashes the row's icon and title in `theme().ansi2` for `1200ms`. If no terminal is focused, posts a `"warning"` toast via `notify()`.
- **Drag a prompt row up/down:** Pressing and dragging a row over another row dims the dragged row (`opacity(0.5)`), draws a `2px` `theme().accent` indicator line at the top or bottom edge of the target row, and reorders `"prompts.items"` on release. Releasing on the original row pastes as a normal click; dragging outside the panel cancels the drag via `#root`'s `on_hover(false)` handler.
- **Click `↵` on a hovered row:** Focuses the active terminal and runs `hc(["send", "--force", target, text])` to paste and press Enter immediately. Shows `title…` while sending, flashes green on success, or posts an `"error"` toast if `hc` fails.
- **Click `+`:** Opens the editor dialog (`openOverlay` with `props: { editor: true }`) and focuses the Title input.
- **Click the edit icon on a hovered row or right-click a row:** Opens the editor dialog prefilled with that prompt (`props: { editor: true, prompt }`).
- **Click `×` on a hovered row or `Delete` in the editor:** Removes the prompt from `shared("prompts.items")`.
- **Keys inside the editor:** `Enter` in Title moves focus to Prompt; `cmd-enter` or `ctrl-enter` saves; `escape` closes the dialog.
- **Agent statuses:** This mod does not track or display agent statuses (`working`, `blocked`, `done`, `idle`); it acts on whichever terminal pane is currently focused.

## Built from

- **Mod folder:** `mods/prompts/main.js` and `mods/prompts/mod.json` (`{"place": "none"}`).
- **Layout placement:** Intended to tile inside `sidebar-lists` in a cloned layout (e.g. `size: { px: 132 }`, `min: 41`) alongside `spaces`, `agents`, and other sidebar panels.
- **UI primitives:** `View`, `div`, `svg` from `gpui-kit`; `v_flex`, `h_flex`, `InputState`, `Input`, `TextareaState`, `Textarea` from `gpui-base`.
- **Icons reused from shipped `workspace-chrome`:** `plus.svg`, `file-text.svg`, `check.svg`, `square-pen.svg`, `x.svg`.
- **`herdr` functions and commands:** `shared` / `setShared` (persisted under `"prompts.items"`, seeded with a default `"PR Review"` prompt), `focused`, `run` (`pane.focus`, `terminal.paste`), `hc` (`hc send --force`), `openOverlay`, `closeOverlay`, `notify`, `props`, `theme`, `checking`.
- **Mod roles via `props()`:** Default sidebar panel when `!props()?.editor`; modal Add/Edit dialog when `props()?.editor === true` (with optional `props().prompt`).

## Watch out

- **Do not set `"place": "left"` in `mod.json`** if you want the panel tiled inside the existing left sidebar — `"place": "left"` docks a brand-new top-level column in `root`. Keep `"place": "none"` and add the block to `sidebar-lists` in a cloned layout.
- **Paste uses the system clipboard** (`cx.write_to_clipboard` + `run("terminal.paste")`) because `hc send` always submits with Enter. Clicking a prompt replaces the clipboard contents with that prompt text.
- **Guard side effects during `herdr-app check`:** `init()` checks `if (!checking())` before calling `setShared` or focusing inputs.
- **Stop propagation on row action buttons:** Each hover button calls `cx.stop_propagation()` on both `on_mouse_down("left")` and `on_click` so clicking `↵`, Edit, or Delete does not also trigger the row's paste handler.
- **Key chords in GPUI:** Use `e.keystroke === "cmd-enter" || e.keystroke === "ctrl-enter"` rather than platform-specific modifier checks.

## Done when

- `herdr-app check ~/.config/herdr-app/mods/prompts` passes with exit code `0`.
- `herdr-app status` reports `"errors": []` with the panel visible inside the left sidebar.
- Clicking a saved prompt pastes its text into the focused terminal without submitting and flashes a green checkmark.
- Clicking `+` opens the dialog, saving a new prompt immediately adds it to the sidebar list, and it persists across Herdr restarts.
- Hovering a row reveals `↵`, Edit, and Delete; clicking `↵` submits the prompt to the active terminal via `hc send`.
