# Sleep block — live preview

Two pages, both render from `geometry.json` (poll every 600 ms — no reload)
and share `sleep-block.js` (a canvas port of `SleepBlockRenderer.kt`):

- **`/preview/preview.html`** — the SLEEP block alone, zoomed in (2–6x),
  with an optional dashed-guide overlay aligned to every key y/x coordinate.
- **`/preview/widget.html`** — the whole 2x2 widget card: black shell with the
  22dp-radius hairline, live date (day in OnePlus red), live ticking clock
  (hours red, minutes white, seconds + am/pm small), the full sleep block,
  and the ALARM / BATT / TEMP footer with dividers. Backdrop can be toggled
  between a teal wallpaper gradient and plain dark. Date and clock tick live;
  ALARM/BATT/TEMP texts live in `geometry.json` (`widget.stats`) so you can
  edit them. Design reference is the 340 x 316 canvas (matches
  `docs/design/widget_polished_design.svg`).

Edit `geometry.json`, save, watch the render change — no Gradle, no APK,
no device.

This is the **tuning ground**. `GEOMETRY.md` and
`mobile/android/app/src/main/java/com/krishnasairaj/meridian/widgets/SleepBlockRenderer.kt`
remain the source of truth for the app — port the numbers you settle on back
into both. (The preview draws with browser fonts, so letterforms differ from
Android's `sans-serif`; every coordinate, curve and lane is exact.)

## GitHub Codespaces (recommended)

1. Push the repo, open it in a Codespace.
2. In the Codespace terminal:

   ```sh
   python3 -m http.server 5500 --directory docs/design
   ```

   (or: `npx --yes serve docs/design -l 5500`)
3. VS Code auto-detects port 5500 and shows it in the **Ports** panel.
   Click **Open in Browser**, or use the in-editor preview:
   `Ctrl+Shift+P` → **Simple Browser: Show** →
   `http://localhost:5500/preview/`
4. Put the preview beside `geometry.json` (split editor, top-right).
5. Edit `geometry.json` and save — the canvas re-renders in under a second.
   If you type a syntax error, the banner shows the parse error and the last
   good frame stays on screen.

Codespaces forwards the port privately by default; when you open it the URL
looks like `https://<name>-5500.app.github.dev/preview/` — that is normal and
only reachable by you.

## Local (any machine with a browser)

```sh
python3 -m http.server 5500 --directory docs/design
# then open http://localhost:5500/preview/
```

Do not open `preview.html` via `file://` — browsers block the `fetch()` of
`geometry.json` there. Any tiny static server works; `npx serve`,
`npx http-server`, or VS Code's Live Preview extension are all fine.

## What to edit for what

Everything is in design units (canvas is `canvas.w` x `canvas.h` = 292 x 132).

| You want to change…              | File / JSON path                                        |
|----------------------------------|---------------------------------------------------------|
| Whole look of the block          | `geometry.json` in this folder (all sections)           |
| The full card (date/clock/stats) | `geometry.json` → `widget.*` (card, date, clock, block placement, stats) |
| Block alone, 2–6x zoom           | `/preview/preview.html`                                 |
| Full widget card                 | `/preview/widget.html`                                  |
| Block width / height             | `canvas.w`, `canvas.h` (+ silhouette bottom values)     |
| Tab size / fillet                | `silhouette.*`                                          |
| Font sizes, baselines, colors    | `texts.*`                                               |
| Lane tracks, bars, dotted line   | `lanes.*`                                               |
| Bar colors                       | `colors.deep/light/awake`, `colors.red`                 |
| The sample night under test      | `sampleNight.*` (`deep`/`light`/`awake` are 0-100 %)    |
| The app itself (after tuning)    | `../GEOMETRY.md` + `SleepBlockRenderer.kt` in widgets/  |

Guides checkbox overlays the key y/x coordinates (0 / 34 / 58 / 80 / 102 /
dotY / 126 / H and 68 / 152 / 174 / 226 / 276) so you can line things up by
number instead of by eye.

When a value in `geometry.json` becomes "the design", fold it back into
`GEOMETRY.md` (constants) and `SleepBlockRenderer.kt` (the same numbers) —
and delete or keep `preview/` as you like; it is dev-tooling, not app code.
