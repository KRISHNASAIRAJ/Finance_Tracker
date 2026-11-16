package com.krishnasairaj.meridian.widgets

import android.graphics.Bitmap
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.DashPathEffect
import android.graphics.Paint
import android.graphics.Path
import android.graphics.RectF
import android.graphics.Typeface

/** One stage segment as percent of the night (0..100). */
data class Seg(val startPct: Float, val endPct: Float)

data class SleepBlockData(
    val duration: String,   // "7H 11M"
    val score: Int,         // 0..100, or -1 to hide the score text + track entirely
    val bed: String,        // "11:48p"
    val wake: String,       // "7:00a"
    val deep: List<Seg>,
    val light: List<Seg>,
    val awake: List<Seg>
)

/**
 * Draws the whole sleep block (shape, tab, tab text, lane tracks, bars,
 * labels, times) into one Bitmap. All numbers are in "design units":
 * the block is 292 x 132 units and everything scales uniformly.
 * The bitmap aspect ratio is therefore always 292:132.
 *
 * Written to match docs/design/GEOMETRY.md. Uniform scale: the bitmap
 * aspect ratio is always 292:132.
 */
object SleepBlockRenderer {
    private const val W = 292f
    private const val H = 132f
    private const val TRACK_X = 68f
    private const val TRACK_W = 208f
    private const val BAR_H = 10f
    private const val MIN_BAR = 5f

    private val RED = Color.parseColor("#E8002A")
    private val DEEP = Color.parseColor("#5A0012")
    private val LIGHT = Color.parseColor("#FFC2CC")
    private val AWAKE = Color.WHITE
    private val LABEL = Color.parseColor("#FFE3E8")
    private val INK = Color.parseColor("#1A0006")
    private val INK2 = Color.parseColor("#3A0010")
    private val GREY = Color.parseColor("#9A9A9A")

    private val medium: Typeface = Typeface.create("sans-serif-medium", Typeface.NORMAL)
    private val regular: Typeface = Typeface.create("sans-serif", Typeface.NORMAL)

    fun heightFor(widthPx: Int): Int = (widthPx * H / W).toInt()

    fun render(widthPx: Int, d: SleepBlockData): Bitmap {
        val s = widthPx / W
        val bmp = Bitmap.createBitmap(widthPx, heightFor(widthPx), Bitmap.Config.ARGB_8888)
        val c = Canvas(bmp)
        c.scale(s, s)

        fun paint(color: Int, tf: Typeface = regular, size: Float = 0f, spacingEm: Float = 0f) =
            Paint(Paint.ANTI_ALIAS_FLAG).apply {
                this.color = color; typeface = tf
                if (size > 0f) textSize = size
                letterSpacing = spacingEm
            }

        // 1. Block silhouette with raised tab and concave fillet
        val path = Path().apply {
            moveTo(0f, 58f)
            quadTo(0f, 34f, 24f, 34f)
            lineTo(136f, 34f)
            quadTo(152f, 34f, 152f, 22f)   // concave fillet into the tab
            quadTo(152f, 0f, 174f, 0f)
            lineTo(270f, 0f)
            quadTo(292f, 0f, 292f, 22f)
            lineTo(292f, 108f)             // tab flows straight into the body
            quadTo(292f, 132f, 268f, 132f)
            lineTo(24f, 132f)
            quadTo(0f, 132f, 0f, 108f)
            close()
        }
        c.drawPath(path, paint(RED))

        // 2. Texts
        c.drawText("SLEEP", 2f, 28f, paint(GREY, medium, 11f, 0.14f))
        c.drawText(d.duration, 170f, 28f, paint(INK, medium, 25f))

        // score text + track; -1 means "no real score yet" — draw neither
        if (d.score >= 0) {
            c.drawText("Score ${d.score}", 170f, 48f, paint(INK2, regular, 12f))

            // score line
            val sp = paint(Color.argb(46, 0, 0, 0))
            c.drawRoundRect(RectF(226f, 41f, 276f, 45f), 2f, 2f, sp)
            c.drawRoundRect(RectF(226f, 41f, 226f + 50f * d.score.coerceIn(0, 100) / 100f, 45f), 2f, 2f, paint(INK))
        }

        // 3. Lane labels
        val lp = paint(LABEL, medium, 9f, 0.11f)
        c.drawText("DEEP", 14f, 66f, lp)
        c.drawText("LIGHT", 14f, 88f, lp)
        c.drawText("AWAKE", 14f, 110f, lp)

        // 4. Tracks (always visible, even with no data)
        val track = paint(Color.argb(41, 0, 0, 0))
        for (y in floatArrayOf(58f, 80f, 102f)) {
            c.drawRoundRect(RectF(TRACK_X, y, TRACK_X + TRACK_W, y + BAR_H), 5f, 5f, track)
        }

        // 5. Dotted line behind the awake bars
        val dots = paint(Color.argb(102, 0, 0, 0)).apply {
            style = Paint.Style.STROKE; strokeWidth = 2f; strokeCap = Paint.Cap.ROUND
            pathEffect = DashPathEffect(floatArrayOf(0.1f, 5f), 0f)
        }
        c.drawLine(72f, 107f, 272f, 107f, dots)

        // 6. Bars
        fun bars(y: Float, segs: List<Seg>, color: Int) {
            val p = paint(color)
            for (g in segs) {
                val a = g.startPct.coerceIn(0f, 100f); val b = g.endPct.coerceIn(0f, 100f)
                if (b <= a) continue
                val x0 = TRACK_X + a / 100f * TRACK_W
                val x1 = maxOf(x0 + MIN_BAR, TRACK_X + b / 100f * TRACK_W).coerceAtMost(TRACK_X + TRACK_W)
                c.drawRoundRect(RectF(x0, y, x1, y + BAR_H), 5f, 5f, p)
            }
        }
        bars(58f, d.deep, DEEP)
        bars(80f, d.light, LIGHT)
        bars(102f, d.awake, AWAKE)

        // 7. Bed and wake times
        c.drawText(d.bed, TRACK_X, 126f, paint(LABEL, regular, 10f))
        val rp = paint(LABEL, regular, 10f).apply { textAlign = Paint.Align.RIGHT }
        c.drawText(d.wake, TRACK_X + TRACK_W, 126f, rp)
        return bmp
    }
}
