package com.krishnasairaj.meridian.sleep

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.annotation.SuppressLint
import android.content.Context
import android.content.Intent
import android.graphics.drawable.Icon
import android.hardware.Sensor
import android.hardware.SensorEvent
import android.hardware.SensorEventListener
import android.hardware.SensorManager
import android.media.AudioAttributes
import android.media.MediaPlayer
import android.media.RingtoneManager
import android.os.Build
import android.os.Handler
import android.os.IBinder
import android.os.Looper
import android.os.PowerManager
import android.os.VibrationEffect
import android.os.Vibrator
import android.os.VibratorManager
import com.krishnasairaj.meridian.MainActivity
import java.util.Calendar
import java.util.Locale
import kotlin.math.abs
import kotlin.math.max
import kotlin.math.min
import kotlin.math.sqrt

/**
 * SleepMotionService — the automatic sleep tracker.
 *
 * A foreground service that samples the accelerometer all night (screen off,
 * app closed) and turns the movement into a per-minute timeline. The phone
 * lying still on the mattress = asleep; the phone being picked up = awake.
 *
 * It also hosts the smart alarm: inside the wake window the alarm rings on the
 * first sign of movement (light sleep), with Stop / Snooze buttons.
 *
 * The raw timeline is persisted in SharedPreferences (SleepMotionStore) so the
 * JS side can infer the sleep session whenever the app is opened.
 */
class SleepMotionService : Service(), SensorEventListener {

    companion object {
        const val CHANNEL_TRACKING = "sleep-tracking"
        const val CHANNEL_ALARM = "sleep-alarm"
        const val CHANNEL_DETECT = "sleep-detected"
        const val CHANNEL_START = "sleep-tracking-start"
        const val NOTIF_TRACKING = 1001
        const val NOTIF_ALARM = 1002
        const val NOTIF_DETECT = 1003
        const val NOTIF_START = 1004

        /** A sleep session shorter than this is not worth reporting. */
        private const val MIN_SLEEP_MS = 2 * 60 * 60 * 1000L

        /** The heads-up banner hides itself again after this long. */
        private const val DETECT_TIMEOUT_MS = 15000L

        /** The "tracking is on" banner hides itself again after this long. */
        private const val START_BANNER_TIMEOUT_MS = 10000L

        const val ACTION_STOP_ALARM = "com.krishnasairaj.meridian.sleep.action.STOP_ALARM"
        const val ACTION_SNOOZE_ALARM = "com.krishnasairaj.meridian.sleep.action.SNOOZE_ALARM"
        const val ACTION_STOP_TRACKING = "com.krishnasairaj.meridian.sleep.action.STOP_TRACKING"

        /** Accelerometer sampling period: 5 seconds. */
        private const val SAMPLE_PERIOD_US = 5_000_000

        /** Persist the timeline at most once a minute. */
        private const val PERSIST_INTERVAL_MS = 60_000L

        /** The running service (used by the alarm receiver). */
        @Volatile
        @SuppressLint("StaticFieldLeak")
        var instance: SleepMotionService? = null
    }

    private var sensorManager: SensorManager? = null
    private var accelerometer: Sensor? = null
    private var accelerometerWakeup: Sensor? = null
    private var registered = false

    /** Held only when the device has NO wake-up accelerometer. */
    private var trackingWakeLock: PowerManager.WakeLock? = null

    private var lastX = 0f
    private var lastY = 0f
    private var lastZ = 0f
    private var hasLastVector = false

    private val buckets = mutableListOf<MotionBucket>()
    private var config: SleepMotionConfig = SleepMotionConfig()

    private var player: MediaPlayer? = null
    private var vibrator: Vibrator? = null
    private var wakeLock: PowerManager.WakeLock? = null
    private var alarmActive = false
    private var lastPersistAt = 0L

    /** Start of the sleep session the tracker is currently watching (epoch ms). */
    private var sleepSessionStart = 0L

    private val handler = Handler(Looper.getMainLooper())

    // --- lifecycle ----------------------------------------------------------

    override fun onCreate() {
        super.onCreate()
        instance = this
        config = SleepMotionStore.loadConfig(this)
        buckets.addAll(SleepMotionStore.loadBuckets(this))
        createChannels()
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        // Re-read the config on every start so changes made in the app apply
        // even when the service was already running.
        config = SleepMotionStore.loadConfig(this)
        // Android gives a foreground service ~5s to show its notification —
        // always do that first, even when we are about to stop again.
        startInForeground()
        if (!config.enabled) {
            stopTracking()
            return START_NOT_STICKY
        }
        // NIGHT ONLY: outside the night window the tracker does not run at all
        // — no service, no "Sleep tracking" notification, no battery drain.
        // It is armed to start when the window opens.
        if (!SleepMotionScheduler.isTrackingTime(config)) {
            stopTracking()
            // If the window opens shortly, come back then instead of skipping
            // tonight.
            val untilWindow = SleepMotionScheduler.minutesUntilWindow(config)
            if (untilWindow in 1..30) {
                SleepMotionScheduler.scheduleRetry(this, untilWindow)
            } else {
                SleepMotionScheduler.scheduleStart(this, config)
            }
            return START_NOT_STICKY
        }
        registerSensor()
        val firstStart = SleepMotionStore.startedAt(this) <= 0L
        if (firstStart) {
            SleepMotionStore.setStartedAt(this, System.currentTimeMillis())
            // The user-facing feedback is a brief heads-up banner (the notch
            // area) instead of a permanent shade notification. It only shows
            // when the tracking actually starts, not on every service restart.
            postTrackingStarted()
        }
        return START_STICKY
    }

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onDestroy() {
        unregisterSensor()
        stopAlarmSound()
        persist(true)
        instance = null
        super.onDestroy()
    }

    // --- sensor -------------------------------------------------------------

    private fun registerSensor() {
        if (registered) return
        try {
            if (sensorManager == null) {
                sensorManager = getSystemService(Context.SENSOR_SERVICE) as SensorManager
            }
            if (accelerometer == null) {
                accelerometer = sensorManager?.getDefaultSensor(Sensor.TYPE_ACCELEROMETER)
            }
            if (accelerometerWakeup == null) {
                accelerometerWakeup = sensorManager?.getDefaultSensor(Sensor.TYPE_ACCELEROMETER_WAKEUP)
            }
            // A normal accelerometer STOPS delivering events when the screen is
            // off — deep sleep means zero samples all night. The wake-up
            // accelerometer wakes the CPU for every sample, so the timeline is
            // recorded even in deep sleep (with the phone under a pillow).
            // When the device has no wake-up sensor we hold a partial wake
            // lock instead (only inside the night window).
            val sensor = accelerometerWakeup ?: accelerometer
            if (sensor == null) return
            if (accelerometerWakeup == null) acquireTrackingWakeLock()
            registered = sensorManager?.registerListener(this, sensor, SAMPLE_PERIOD_US) ?: false
        } catch (e: Exception) {
            registered = false
        }
    }

    private fun unregisterSensor() {
        if (!registered) {
            releaseTrackingWakeLock()
            return
        }
        try {
            sensorManager?.unregisterListener(this)
        } catch (e: Exception) {
            /* ignore */
        }
        registered = false
        releaseTrackingWakeLock()
    }

    private fun acquireTrackingWakeLock() {
        try {
            if (trackingWakeLock != null) return
            val pm = getSystemService(Context.POWER_SERVICE) as PowerManager
            trackingWakeLock = pm.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "meridian:sleep-tracker").apply {
                setReferenceCounted(false)
                // At most a night — the lock is never held during the day.
                acquire(12 * 60 * 60 * 1000L)
            }
        } catch (e: Exception) {
            trackingWakeLock = null
        }
    }

    private fun releaseTrackingWakeLock() {
        try {
            trackingWakeLock?.let {
                if (it.isHeld) it.release()
            }
        } catch (e: Exception) {
            /* ignore */
        }
        trackingWakeLock = null
    }

    override fun onAccuracyChanged(sensor: Sensor?, accuracy: Int) {
        /* not used */
    }

    override fun onSensorChanged(event: SensorEvent?) {
        try {
            val values = event?.values ?: return
            if (values.size < 3) return
            val x = values[0]
            val y = values[1]
            val z = values[2]

            val magnitude = sqrt(x * x + y * y + z * z)
            // Distance from "flat and calm" — a phone lying on a mattress reads
            // roughly one g.
            var movement = abs(magnitude - SensorManager.GRAVITY_EARTH)

            // A phone that is picked up or turned over changes orientation even
            // when the total force stays the same — treat that as movement too.
            if (hasLastVector) {
                val lastMagnitude = sqrt(lastX * lastX + lastY * lastY + lastZ * lastZ)
                if (lastMagnitude > 0.01f && magnitude > 0.01f) {
                    val cosine = (x * lastX + y * lastY + z * lastZ) / (magnitude * lastMagnitude)
                    val turn = (1f - cosine).coerceIn(0f, 2f) * SensorManager.GRAVITY_EARTH
                    if (turn > movement) movement = turn
                }
            }
            lastX = x
            lastY = y
            lastZ = z
            hasLastVector = true

            val now = System.currentTimeMillis()
            // The night is over (the window closed) — stop tracking and arm
            // the next night. Nothing is recorded during the day.
            if (!SleepMotionScheduler.isTrackingTime(config, now)) {
                endOfNight()
                return
            }
            recordBucket(now, movement)
            handleMovement(now, movement)
            persist(false)
        } catch (e: Exception) {
            /* never crash the service */
        }
    }

    /**
     * Keep one bucket per minute holding the peak movement of that minute and
     * the number of seconds of *sustained* movement inside it.
     *
     * The second counter is what makes the tracker work with the phone under a
     * pillow: a single bump (the mattress settling) is a short spike, while a
     * real wake-up keeps moving for several seconds.
     */
    private fun recordBucket(now: Long, movement: Float) {
        val minute = now / 60000L
        val sampleSeconds = (SAMPLE_PERIOD_US / 1_000_000L).toInt().coerceAtLeast(1)
        val moving = if (movement > config.threshold()) sampleSeconds else 0
        val last = buckets.lastOrNull()
        if (last == null || last.minute != minute) {
            buckets.add(MotionBucket(minute, movement, moving))
        } else {
            buckets.removeAt(buckets.size - 1)
            val knownSeconds = if (last.movingSeconds < 0) 0 else last.movingSeconds
            buckets.add(
                MotionBucket(
                    minute,
                    max(last.value, movement),
                    min(60, knownSeconds + moving)
                )
            )
        }
    }

    /** Track the stillness / movement streaks and drive the smart alarm. */
    private fun handleMovement(now: Long, movement: Float) {
        val threshold = config.threshold()
        val lastMovementAt = SleepMotionStore.lastMovementAt(this)
        val stillForMs = if (lastMovementAt <= 0L) Long.MAX_VALUE else now - lastMovementAt

        if (movement > threshold) {
            // Movement after a long stillness inside the night = the user woke
            // up. Report the session as a brief banner over the status bar.
            val stillSince = SleepMotionStore.stillSince(this)
            if (sleepSessionStart > 0L && stillSince > sleepSessionStart) {
                val sleptMs = stillSince - sleepSessionStart
                if (sleptMs >= MIN_SLEEP_MS && isInNightWindow(localMinutesOfDay(now))) {
                    postSleepDetected(sleptMs)
                }
            }
            sleepSessionStart = 0L
            SleepMotionStore.setLastMovementAt(this, now)
            SleepMotionStore.setStillSince(this, 0L)
        } else if (SleepMotionStore.stillSince(this) <= 0L) {
            SleepMotionStore.setStillSince(this, now)
            // A stillness streak that starts now may become tonight's sleep.
            if (sleepSessionStart <= 0L) sleepSessionStart = now
        }

        maybeFireAlarm(now, movement, stillForMs)
    }

    /**
     * A brief heads-up banner (it shows over the status bar / notch and hides
     * itself again instead of sitting in the notification panel).
     */
    private fun postSleepDetected(sleptMs: Long) {
        try {
            val minutes = sleptMs / 60000L
            val h = minutes / 60
            val m = minutes % 60
            val nm = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
            val builder = builder(CHANNEL_DETECT)
                .setContentTitle("😴 Good morning")
                .setContentText("You slept ${h}h ${m}m")
                .setSmallIcon(android.R.drawable.ic_lock_idle_alarm)
                .setAutoCancel(true)
                .setOngoing(false)
                .setCategory(Notification.CATEGORY_STATUS)
                .setPriority(Notification.PRIORITY_HIGH)
                .setContentIntent(openAppIntent())
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                builder.setTimeoutAfter(DETECT_TIMEOUT_MS)
            }
            nm.notify(NOTIF_DETECT, builder.build())
        } catch (e: Exception) {
            /* best-effort */
        }
    }

    /** Is this minute of the day inside the configured night window? */
    private fun isInNightWindow(minute: Int): Boolean =
        SleepMotionScheduler.isInNightWindow(config, minute)

    // --- smart alarm --------------------------------------------------------

    private fun maybeFireAlarm(now: Long, movement: Float, stillForMs: Long) {
        if (!config.alarmEnabled) return
        if (alarmActive) return

        // One alarm per calendar day.
        val today = localDateKey(now)
        if (SleepMotionStore.alarmDate(this) != today) {
            SleepMotionStore.setAlarmDate(this, today)
            SleepMotionStore.setAlarmFired(this, false)
        }
        if (SleepMotionStore.alarmFired(this)) return
        if (now < SleepMotionStore.snoozeUntil(this)) return

        val minuteOfDay = localMinutesOfDay(now)
        if (minuteOfDay < config.wakeStartMin || minuteOfDay > config.wakeEndMin) return

        if (config.alarmMode == SleepMotionConfig.ALARM_FIXED) {
            fireAlarm(now)
            return
        }

        // Smart alarm: ring on the first movement inside the wake window, but
        // only when the phone has been still for a while (the user is asleep).
        val minStillMs = config.minStillMinutes() * 60_000L
        if (movement > config.threshold() && stillForMs >= minStillMs) {
            fireAlarm(now)
        }
    }

    private fun fireAlarm(now: Long) {
        alarmActive = true
        SleepMotionStore.setAlarmFired(this, true)
        startAlarmSound()
        startVibration()
        acquireWakeLock()
        showAlarmNotification()
        // Stop ringing after the configured duration, but keep it "fired" so it
        // does not ring again on the next movement.
        handler.postDelayed({
            stopAlarmSound()
            releaseWakeLock()
            alarmActive = false
        }, config.alarmDurationMin.coerceAtLeast(1) * 60_000L)
    }

    /** Stop (or snooze) the ringing alarm. Safe to call when nothing rings. */
    fun stopAlarm(snooze: Boolean) {
        stopAlarmSound()
        releaseWakeLock()
        cancelNotification(NOTIF_ALARM)
        alarmActive = false
        if (snooze) {
            // Ring again once the snooze is over.
            SleepMotionStore.setAlarmFired(this, false)
            SleepMotionStore.setSnoozeUntil(this, System.currentTimeMillis() + config.snoozeMin * 60_000L)
        }
    }

    fun isAlarmActive(): Boolean = alarmActive

    /** Stop the whole tracker (sensor + notification). */
    fun stopTracking() {
        unregisterSensor()
        cancelNotification(NOTIF_TRACKING)
        stopAlarmSound()
        releaseWakeLock()
        alarmActive = false
        // The pending "start tonight" alarm goes away with the tracker.
        SleepMotionScheduler.cancelStart(this)
        stopForeground(Service.STOP_FOREGROUND_REMOVE)
        stopSelf()
    }

    /**
     * The night window closed: the tracker stops (so there is no "Sleep
     * tracking" notification during the day) and arms itself for the next
     * night.
     */
    private fun endOfNight() {
        stopTracking()
        try {
            // A new session → the "tracking is on" banner may show again.
            SleepMotionStore.setStartedAt(this, 0L)
            SleepMotionScheduler.scheduleStart(this, config)
        } catch (e: Exception) {
            /* ignore */
        }
    }

    private fun startAlarmSound() {
        try {
            val uri = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_ALARM)
                ?: RingtoneManager.getDefaultUri(RingtoneManager.TYPE_RINGTONE)
                ?: RingtoneManager.getDefaultUri(RingtoneManager.TYPE_NOTIFICATION)
            if (uri == null) return
            stopAlarmSound()
            val mp = MediaPlayer()
            mp.setAudioAttributes(
                AudioAttributes.Builder()
                    .setUsage(AudioAttributes.USAGE_ALARM)
                    .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                    .build()
            )
            mp.setDataSource(this, uri)
            mp.isLooping = true
            mp.prepare()
            mp.start()
            player = mp
        } catch (e: Exception) {
            player = null
        }
    }

    private fun stopAlarmSound() {
        try {
            player?.let {
                if (it.isPlaying) it.stop()
                it.release()
            }
        } catch (e: Exception) {
            /* ignore */
        }
        player = null
        try {
            vibrator?.cancel()
        } catch (e: Exception) {
            /* ignore */
        }
        vibrator = null
    }

    private fun startVibration() {
        try {
            val v: Vibrator = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                val vm = getSystemService(Context.VIBRATOR_MANAGER_SERVICE) as VibratorManager
                vm.defaultVibrator
            } else {
                @Suppress("DEPRECATION")
                getSystemService(Context.VIBRATOR_SERVICE) as Vibrator
            }
            vibrator = v
            val pattern = longArrayOf(0, 500, 500, 500, 1000)
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                v.vibrate(VibrationEffect.createWaveform(pattern, 0))
            } else {
                @Suppress("DEPRECATION")
                v.vibrate(pattern, 0)
            }
        } catch (e: Exception) {
            /* ignore */
        }
    }

    private fun acquireWakeLock() {
        try {
            if (wakeLock != null) return
            val pm = getSystemService(Context.POWER_SERVICE) as PowerManager
            wakeLock = pm.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "meridian:sleep-alarm").apply {
                setReferenceCounted(false)
                @Suppress("DEPRECATION")
                acquire(config.alarmDurationMin.coerceAtLeast(1) * 60_000L)
            }
        } catch (e: Exception) {
            wakeLock = null
        }
    }

    private fun releaseWakeLock() {
        try {
            wakeLock?.let {
                if (it.isHeld) it.release()
            }
        } catch (e: Exception) {
            /* ignore */
        }
        wakeLock = null
    }

    // --- notifications ------------------------------------------------------

    @SuppressLint("InlinedApi")
    private fun createChannels() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return
        try {
            val nm = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
            val tracking = NotificationChannel(
                CHANNEL_TRACKING,
                "Sleep tracking",
                NotificationManager.IMPORTANCE_MIN
            ).apply {
                description = "Shown while Meridian tracks your sleep automatically"
                setShowBadge(false)
                enableVibration(false)
                setSound(null, null)
            }
            val alarm = NotificationChannel(
                CHANNEL_ALARM,
                "Smart alarm",
                NotificationManager.IMPORTANCE_HIGH
            ).apply {
                description = "Wake-up alarm for automatic sleep tracking"
                enableVibration(true)
                setSound(null, null)
            }
            // The sleep-detected banner: high importance so it shows as a
            // heads-up over the status bar (the notch area), silent and it
            // removes itself again — it never lingers in the panel.
            val detect = NotificationChannel(
                CHANNEL_DETECT,
                "Sleep detected",
                NotificationManager.IMPORTANCE_HIGH
            ).apply {
                description = "Shows the detected night of sleep as a brief banner"
                enableVibration(false)
                setSound(null, null)
                setShowBadge(false)
            }
            // The "tracking is on" banner — the same heads-up treatment.
            val start = NotificationChannel(
                CHANNEL_START,
                "Sleep tracking started",
                NotificationManager.IMPORTANCE_HIGH
            ).apply {
                description = "A brief banner when the automatic tracking starts"
                enableVibration(false)
                setSound(null, null)
                setShowBadge(false)
            }
            nm.createNotificationChannel(tracking)
            nm.createNotificationChannel(alarm)
            nm.createNotificationChannel(detect)
            nm.createNotificationChannel(start)
        } catch (e: Exception) {
            /* ignore */
        }
    }

    private fun startInForeground() {
        try {
            val notification = buildTrackingNotification()
            startForeground(NOTIF_TRACKING, notification)
        } catch (e: Exception) {
            /* ignore — the service still runs, just without a notification */
        }
    }

    private fun builder(channelId: String): Notification.Builder {
        return if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            Notification.Builder(this, channelId)
        } else {
            Notification.Builder(this)
        }
    }

    /**
     * The foreground-service notification.
     *
     * Android requires a foreground service to show a notification, but it
     * should be as quiet as possible: the channel is at the lowest importance
     * (silent, no badge) and the notification is NOT ongoing, so it can be
     * swiped away and does not come back until the service restarts. The
     * user-facing "tracking is on" feedback is the brief heads-up banner
     * instead (see postTrackingStarted).
     */
    private fun buildTrackingNotification(): Notification {
        val stopIntent = PendingIntent.getBroadcast(
            this,
            10,
            Intent(this, SleepMotionAlarmReceiver::class.java).setAction(ACTION_STOP_TRACKING),
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )
        return builder(CHANNEL_TRACKING)
            .setContentTitle("Sleep tracking")
            .setSmallIcon(android.R.drawable.ic_lock_idle_alarm)
            .setOngoing(false)
            .setShowWhen(false)
            .setOnlyAlertOnce(true)
            .setVisibility(Notification.VISIBILITY_SECRET)
            .setCategory(Notification.CATEGORY_SERVICE)
            .setPriority(Notification.PRIORITY_MIN)
            .setContentIntent(openAppIntent())
            .addAction(Notification.Action.Builder(null as Icon?, "Stop", stopIntent).build())
            .build()
    }

    /**
     * A brief heads-up banner (it shows over the status bar / the notch and
     * hides itself again) — the "tracking is on" feedback that used to be a
     * permanent shade notification.
     */
    private fun postTrackingStarted() {
        try {
            val nm = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
            val builder = builder(CHANNEL_START)
                .setContentTitle("😴 Sleep tracking on")
                .setContentText("The motion sensor is watching until you stop it")
                .setSmallIcon(android.R.drawable.ic_lock_idle_alarm)
                .setAutoCancel(true)
                .setOngoing(false)
                .setShowWhen(false)
                .setOnlyAlertOnce(true)
                .setCategory(Notification.CATEGORY_STATUS)
                .setPriority(Notification.PRIORITY_HIGH)
                .setContentIntent(openAppIntent())
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                builder.setTimeoutAfter(START_BANNER_TIMEOUT_MS)
            }
            nm.notify(NOTIF_START, builder.build())
        } catch (e: Exception) {
            /* best-effort */
        }
    }

    private fun showAlarmNotification() {
        try {
            val stopIntent = PendingIntent.getBroadcast(
                this,
                11,
                Intent(this, SleepMotionAlarmReceiver::class.java).setAction(ACTION_STOP_ALARM),
                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
            )
            val snoozeIntent = PendingIntent.getBroadcast(
                this,
                12,
                Intent(this, SleepMotionAlarmReceiver::class.java).setAction(ACTION_SNOOZE_ALARM),
                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
            )
            val notification = builder(CHANNEL_ALARM)
                .setContentTitle("⏰ Good morning")
                .setContentText("Time to wake up")
                .setSmallIcon(android.R.drawable.ic_lock_idle_alarm)
                .setOngoing(true)
                .setAutoCancel(false)
                .setCategory(Notification.CATEGORY_ALARM)
                .setPriority(Notification.PRIORITY_MAX)
                .setContentIntent(openAppIntent())
                .addAction(Notification.Action.Builder(null as Icon?, "Snooze ${config.snoozeMin} min", snoozeIntent).build())
                .addAction(Notification.Action.Builder(null as Icon?, "Stop", stopIntent).build())
                .build()
            val nm = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
            nm.notify(NOTIF_ALARM, notification)
        } catch (e: Exception) {
            /* ignore */
        }
    }

    private fun cancelNotification(id: Int) {
        try {
            val nm = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
            nm.cancel(id)
        } catch (e: Exception) {
            /* ignore */
        }
    }

    private fun openAppIntent(): PendingIntent {
        val intent = Intent(this, MainActivity::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP
        }
        return PendingIntent.getActivity(
            this,
            0,
            intent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )
    }

    // --- persistence --------------------------------------------------------

    private fun persist(force: Boolean) {
        val now = System.currentTimeMillis()
        if (!force && now - lastPersistAt < PERSIST_INTERVAL_MS) return
        lastPersistAt = now
        try {
            // Pick up config changes made in the app while we were running.
            val fresh = SleepMotionStore.loadConfig(this)
            if (fresh.toJson() != config.toJson()) config = fresh
            SleepMotionStore.saveBuckets(this, buckets)
            SleepMotionStore.setLastSampleAt(this, now)
        } catch (e: Exception) {
            /* ignore */
        }
    }

    // --- helpers ------------------------------------------------------------

    private fun localMinutesOfDay(ts: Long): Int {
        val cal = Calendar.getInstance()
        cal.timeInMillis = ts
        return cal.get(Calendar.HOUR_OF_DAY) * 60 + cal.get(Calendar.MINUTE)
    }

    private fun localDateKey(ts: Long): String {
        val cal = Calendar.getInstance()
        cal.timeInMillis = ts
        return String.format(
            Locale.US,
            "%04d%02d%02d",
            cal.get(Calendar.YEAR),
            cal.get(Calendar.MONTH) + 1,
            cal.get(Calendar.DAY_OF_MONTH)
        )
    }
}
