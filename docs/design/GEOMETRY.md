# Sleep block geometry (source of truth for an exact match)

Everything is in design units. The block is W = 292 by H = 132 units.
Scale uniformly: s = blockWidthPx / 292. Never stretch X and Y separately.

## Placement in the card
- Card design width = 340 units. Block left and right inset = 24 units
  each (7.1% of the card width). Block width = 85.9% of the card width.
- In a RemoteViews layout use a horizontal LinearLayout with three
  children: spacer (weight 7.1), ImageView (weight 85.8, 0dp width,
  wrap_content height, adjustViewBounds, fitCenter), spacer (weight 7.1).

## Silhouette (path, in block units)
M0,58  Q0,34 24,34  L136,34  Q152,34 152,22  Q152,0 174,0  L270,0
Q292,0 292,22  L292,108  Q292,132 268,132  L24,132  Q0,132 0,108  Z
- Body top is y = 34. Tab top is y = 0 (protrudes 34 units).
- Tab starts at x = 152 (52% of block width), width 140 (48%).
- The tab's right edge is flush with the body's right edge (no gap).
- Left side of the tab joins the body with a concave fillet.
  The tab is NOT a separate pill.

## Texts
- "SLEEP": x 12, baseline 28, size 13, letter spacing 0.14em, #9A9A9A
- Duration: x 178, baseline 28, size 27, medium, #1A0006
- "Score NN": x 171, baseline 46, size 12, #3A0010
- Score line: x 226..276, y 41..45, radius 2. Track black 18%,
  fill #1A0006 = score percent.
- Bed / wake labels render as "11:48PM" / "7:00AM" (uppercase,
  no space).

## Lanes
- Labels x 14, baselines 66 / 88 / 110, size 9, medium, #FFE3E8,
  letter spacing 0.11em: DEEP, LIGHT, AWAKE
- Tracks x 68..276 (width 208), height 10, radius 5, black 16%.
  Row tops: 58, 80, 102.
- Bars: same height and radius, minimum width 5.
  Deep #5A0012, Light #FFC2CC, Awake #FFFFFF.
  x = 68 + pct / 100 * 208.
- Dotted line behind awake bars: y 107, x 72..272, black 40%, round
  dots every 5 units.
- Times: baseline 126, size 10, #FFE3E8. Bed starts at x 68, wake
  is right aligned at x 276.

## Visual checks (compare with the target)
1. Tab is about half the block width and protrudes about one quarter
   of the body height. Right edge is flush.
2. There is a smooth concave curve on the tab's left side.
3. Tracks are visible in all three lanes, bars are plump pills.
4. Light lane shows pale pink pills, not hairlines.
5. Labels are the same pale pink as the times, noticeably larger
   than the current build.
6. No stray vertical lines inside a lane.
