package com.krishnasairaj.meridian.sleep

import android.content.Context
import org.json.JSONArray
import org.json.JSONObject
import kotlin.math.max

/**
 * MotionBucket — one minute of motion data.
 *
 * @param minute epoch minute (System.currentTimeMillis() / 60000)
 * @param value  peak movement seen during that minute, in m/s^2 (0 = perfectly still)
 * @param movingSeconds seconds of *sustained* movement inside that minute.
 *                 -1 means "unknown" (a bucket recorded before the second
 *                 counter existed) — the peak value is then used on its own.
 */
data class MotionBucket(val minute: Long, val value: Float, val movingSeconds: Int = -1)

/**
 * SleepMotionStore — SharedPreferences persistence for the automatic sleep
 * tracker.
 *
 * Everything lives in one preferences file so the native service can keep
 * recording while the React Native side is dead, and the JS bridge can read
 * the timeline back whenever the app opens.
 */
object SleepMotionStore {

    const val PREFS = "meridian_sleep_motion"

    private const val KEY_CONFIG = "config"
    private const val KEY_BUCKETS = "buckets"
    private const val KEY_STARTED_AT = "started_at"
    private const val KEY_LAST_SAMPLE_AT = "last_sample_at"
    private const val KEY_LAST_MOVEMENT_AT = "last_movement_at"
    private const val KEY_STILL_SINCE = "still_since"
    private const val KEY_ALARM_DATE = "alarm_date"
    private const val KEY_ALARM_FIRED = "alarm_fired"
    private const val KEY_SNOOZE_UNTIL = "snooze_until"

    /** Keep at most 36h of motion history (covers a night plus a day of slack). */
    private const val RETENTION_MIN = 36 * 60

    private fun prefs(ctx: Context) =
        ctx.applicationContext.getSharedPreferences(PREFS, Context.MODE_PRIVATE)

    // --- config -------------------------------------------------------------

    fun loadConfig(ctx: Context): SleepMotionConfig =
        SleepMotionConfig.fromJson(prefs(ctx).getString(KEY_CONFIG, null))

    fun saveConfig(ctx: Context, config: SleepMotionConfig) {
        prefs(ctx).edit()
            .putString(KEY_CONFIG, config.toJson())
            .apply()
    }

    // --- motion buckets -----------------------------------------------------

    fun loadBuckets(ctx: Context): MutableList<MotionBucket> {
        val raw = prefs(ctx).getString(KEY_BUCKETS, null) ?: return mutableListOf()
        val out = mutableListOf<MotionBucket>()
        try {
            val arr = JSONArray(raw)
            for (i in 0 until arr.length()) {
                val o = arr.optJSONObject(i) ?: continue
                val m = o.optLong("m", 0L)
                val v = o.optDouble("v", 0.0)
                // "s" is the sustained-movement counter; older buckets do not
                // have it (-1 = unknown).
                val s = if (o.has("s")) o.optInt("s", 0) else -1
                if (m > 0L) out.add(MotionBucket(m, v.toFloat(), s))
            }
        } catch (e: Exception) {
            return mutableListOf()
        }
        out.sortBy { it.minute }
        return out
    }

    fun saveBuckets(ctx: Context, buckets: List<MotionBucket>) {
        val cutoff = System.currentTimeMillis() / 60000L - RETENTION_MIN
        val arr = JSONArray()
        for (b in buckets) {
            if (b.minute < cutoff) continue
            val o = JSONObject()
            o.put("m", b.minute)
            o.put("v", b.value.toDouble())
            o.put("s", max(b.movingSeconds, 0))
            arr.put(o)
        }
        prefs(ctx).edit().putString(KEY_BUCKETS, arr.toString()).apply()
    }

    fun clearBuckets(ctx: Context) {
        prefs(ctx).edit().remove(KEY_BUCKETS).apply()
    }

    // --- session status -----------------------------------------------------

    fun startedAt(ctx: Context): Long = prefs(ctx).getLong(KEY_STARTED_AT, 0L)

    fun setStartedAt(ctx: Context, ts: Long) {
        prefs(ctx).edit().putLong(KEY_STARTED_AT, ts).apply()
    }

    fun lastSampleAt(ctx: Context): Long = prefs(ctx).getLong(KEY_LAST_SAMPLE_AT, 0L)

    fun setLastSampleAt(ctx: Context, ts: Long) {
        prefs(ctx).edit().putLong(KEY_LAST_SAMPLE_AT, ts).apply()
    }

    fun lastMovementAt(ctx: Context): Long = prefs(ctx).getLong(KEY_LAST_MOVEMENT_AT, 0L)

    fun setLastMovementAt(ctx: Context, ts: Long) {
        prefs(ctx).edit().putLong(KEY_LAST_MOVEMENT_AT, ts).apply()
    }

    fun stillSince(ctx: Context): Long = prefs(ctx).getLong(KEY_STILL_SINCE, 0L)

    fun setStillSince(ctx: Context, ts: Long) {
        prefs(ctx).edit().putLong(KEY_STILL_SINCE, ts).apply()
    }

    // --- smart alarm --------------------------------------------------------

    fun alarmDate(ctx: Context): String = prefs(ctx).getString(KEY_ALARM_DATE, "") ?: ""

    fun setAlarmDate(ctx: Context, date: String) {
        prefs(ctx).edit().putString(KEY_ALARM_DATE, date).apply()
    }

    fun alarmFired(ctx: Context): Boolean = prefs(ctx).getBoolean(KEY_ALARM_FIRED, false)

    fun setAlarmFired(ctx: Context, fired: Boolean) {
        prefs(ctx).edit().putBoolean(KEY_ALARM_FIRED, fired).apply()
    }

    fun snoozeUntil(ctx: Context): Long = prefs(ctx).getLong(KEY_SNOOZE_UNTIL, 0L)

    fun setSnoozeUntil(ctx: Context, ts: Long) {
        prefs(ctx).edit().putLong(KEY_SNOOZE_UNTIL, ts).apply()
    }
}
