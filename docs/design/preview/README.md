# Sleep block — live preview

Renders the red SLEEP block from `geometry.json` in a plain HTML canvas and
polls that file every 600 ms. Edit `geometry.json`, save, watch the render
change — no Gradle, no APK, no device.

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
