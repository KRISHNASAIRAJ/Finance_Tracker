package com.krishnasairaj.meridian.sleep

import com.facebook.react.bridge.ReadableMap
import org.json.JSONObject

/**
 * SleepMotionConfig — settings of the automatic (accelerometer) sleep tracker.
 *
 * The movement thresholds below are mirrored in TypeScript
 * (mobile/src/modules/sleep/sleepInference.ts) so the JS-side inference makes
 * the same "still vs awake" decision as the native service. If you change one,
 * change the other.
 */
data class SleepMotionConfig(
    /** Tracking on/off. */
    val enabled: Boolean = false,
    /** low | medium | high — how small a movement counts as "awake". */
    val sensitivity: String = SENS_MEDIUM,
    /** Start of the night window, minutes from local midnight. */
    val sleepStartMin: Int = 21 * 60,
    /** End of the night window, minutes from local midnight (may wrap midnight). */
    val sleepEndMin: Int = 12 * 60,
    /** Smart alarm on/off. */
    val alarmEnabled: Boolean = false,
    /** smart = ring on the first movement inside the window, fixed = ring at wakeStart. */
    val alarmMode: String = ALARM_SMART,
    /** Alarm window start, minutes from local midnight. */
    val wakeStartMin: Int = 6 * 60 + 30,
    /** Alarm window end, minutes from local midnight. */
    val wakeEndMin: Int = 7 * 60,
    /** How long the alarm rings (minutes). */
    val alarmDurationMin: Int = 2,
    /** Snooze length (minutes). */
    val snoozeMin: Int = 9,
    /** Save a detected session into the sleep log without asking. */
    val autoSave: Boolean = true
) {

    /**
     * Movement threshold in m/s^2. A minute whose peak movement is above this
     * counts as "awake". Lower = more sensitive.
     */
    fun threshold(): Float = when (sensitivity) {
        SENS_LOW -> 0.60f
        SENS_HIGH -> 0.20f
        else -> 0.35f
    }

    /**
     * The smart alarm only rings when the phone has been still for at least
     * this long — otherwise it would fire while the user is still awake.
     */
    fun minStillMinutes(): Int = 45

    fun toJson(): String {
        val o = JSONObject()
        o.put("enabled", enabled)
        o.put("sensitivity", sensitivity)
        o.put("sleepStartMin", sleepStartMin)
        o.put("sleepEndMin", sleepEndMin)
        o.put("alarmEnabled", alarmEnabled)
        o.put("alarmMode", alarmMode)
        o.put("wakeStartMin", wakeStartMin)
        o.put("wakeEndMin", wakeEndMin)
        o.put("alarmDurationMin", alarmDurationMin)
        o.put("snoozeMin", snoozeMin)
        o.put("autoSave", autoSave)
        return o.toString()
    }

    companion object {
        const val SENS_LOW = "low"
        const val SENS_MEDIUM = "medium"
        const val SENS_HIGH = "high"
        const val ALARM_SMART = "smart"
        const val ALARM_FIXED = "fixed"

        fun fromJson(raw: String?): SleepMotionConfig {
            if (raw.isNullOrBlank()) return SleepMotionConfig()
            return try {
                val o = JSONObject(raw)
                SleepMotionConfig(
                    enabled = o.optBoolean("enabled", false),
                    sensitivity = o.optString("sensitivity", SENS_MEDIUM),
                    sleepStartMin = o.optInt("sleepStartMin", 21 * 60),
                    sleepEndMin = o.optInt("sleepEndMin", 12 * 60),
                    alarmEnabled = o.optBoolean("alarmEnabled", false),
                    alarmMode = o.optString("alarmMode", ALARM_SMART),
                    wakeStartMin = o.optInt("wakeStartMin", 6 * 60 + 30),
                    wakeEndMin = o.optInt("wakeEndMin", 7 * 60),
                    alarmDurationMin = o.optInt("alarmDurationMin", 2),
                    snoozeMin = o.optInt("snoozeMin", 9),
                    autoSave = o.optBoolean("autoSave", true)
                )
            } catch (e: Exception) {
                SleepMotionConfig()
            }
        }

        fun fromMap(map: ReadableMap?): SleepMotionConfig {
            val d = SleepMotionConfig()
            if (map == null) return d
            return SleepMotionConfig(
                enabled = mapBool(map, "enabled", d.enabled),
                sensitivity = mapStr(map, "sensitivity", d.sensitivity),
                sleepStartMin = mapInt(map, "sleepStartMin", d.sleepStartMin),
                sleepEndMin = mapInt(map, "sleepEndMin", d.sleepEndMin),
                alarmEnabled = mapBool(map, "alarmEnabled", d.alarmEnabled),
                alarmMode = mapStr(map, "alarmMode", d.alarmMode),
                wakeStartMin = mapInt(map, "wakeStartMin", d.wakeStartMin),
                wakeEndMin = mapInt(map, "wakeEndMin", d.wakeEndMin),
                alarmDurationMin = mapInt(map, "alarmDurationMin", d.alarmDurationMin),
                snoozeMin = mapInt(map, "snoozeMin", d.snoozeMin),
                autoSave = mapBool(map, "autoSave", d.autoSave)
            )
        }

        private fun mapBool(map: ReadableMap, key: String, fallback: Boolean): Boolean {
            return try {
                if (!map.hasKey(key) || map.isNull(key)) fallback else map.getBoolean(key)
            } catch (e: Exception) {
                fallback
            }
        }

        private fun mapInt(map: ReadableMap, key: String, fallback: Int): Int {
            return try {
                if (!map.hasKey(key) || map.isNull(key)) fallback else map.getInt(key)
            } catch (e: Exception) {
                fallback
            }
        }

        private fun mapStr(map: ReadableMap, key: String, fallback: String): String {
            return try {
                if (!map.hasKey(key) || map.isNull(key)) fallback else (map.getString(key) ?: fallback)
            } catch (e: Exception) {
                fallback
            }
        }
    }
}
