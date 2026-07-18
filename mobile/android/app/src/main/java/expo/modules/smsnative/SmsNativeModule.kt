package expo.modules.smsnative

import android.Manifest
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.content.pm.PackageManager
import android.database.Cursor
import android.net.Uri
import android.os.Build
import android.provider.Telephony
import androidx.core.content.ContextCompat
import com.facebook.react.bridge.*
import com.facebook.react.module.annotations.ReactModule
import com.facebook.react.modules.core.DeviceEventManagerModule

@ReactModule(name = SmsNativeModule.NAME)
class SmsNativeModule(reactContext: ReactApplicationContext) : ReactContextBaseJavaModule(reactContext) {

    companion object {
        const val NAME = "SmsNative"
    }

    override fun getName(): String = NAME

    private var broadcastReceiver: SmsBroadcastReceiver? = null
    private var isListening = false

    @ReactMethod
    fun readSms(maxCount: Int, promise: Promise) {
        val context = reactApplicationContext
        if (ContextCompat.checkSelfPermission(context, Manifest.permission.READ_SMS)
            != PackageManager.PERMISSION_GRANTED) {
            promise.resolve(Arguments.createArray())
            return
        }

        val messages = Arguments.createArray()
        val uri: Uri = Telephony.Sms.Inbox.CONTENT_URI
        val projection = arrayOf(
            Telephony.Sms._ID,
            Telephony.Sms.ADDRESS,
            Telephony.Sms.BODY,
            Telephony.Sms.DATE
        )
        val sortOrder = "${Telephony.Sms.DATE} DESC LIMIT $maxCount"

        var cursor: Cursor? = null
        try {
            cursor = context.contentResolver.query(uri, projection, null, null, sortOrder)
            if (cursor != null && cursor.moveToFirst()) {
                do {
                    val msg = Arguments.createMap()
                    msg.putString("id", cursor.getString(cursor.getColumnIndexOrThrow(Telephony.Sms._ID)))
                    msg.putString("address", cursor.getString(cursor.getColumnIndexOrThrow(Telephony.Sms.ADDRESS)) ?: "")
                    msg.putString("body", cursor.getString(cursor.getColumnIndexOrThrow(Telephony.Sms.BODY)) ?: "")
                    msg.putDouble("date", cursor.getLong(cursor.getColumnIndexOrThrow(Telephony.Sms.DATE)).toDouble())
                    messages.pushMap(msg)
                } while (cursor.moveToNext() && messages.size() < maxCount)
            }
        } finally {
            cursor?.close()
        }
        promise.resolve(messages)
    }

    @ReactMethod
    fun requestPermissions(promise: Promise) {
        val context = reactApplicationContext
        val readGranted = ContextCompat.checkSelfPermission(context, Manifest.permission.READ_SMS) == PackageManager.PERMISSION_GRANTED
        val recvGranted = ContextCompat.checkSelfPermission(context, Manifest.permission.RECEIVE_SMS) == PackageManager.PERMISSION_GRANTED
        promise.resolve(Arguments.makeNativeMap("granted", readGranted && recvGranted))
    }

    @ReactMethod
    fun addListener(eventName: String) {}

    @ReactMethod
    fun removeListeners(count: Int) {}

    @ReactMethod
    fun startListening() {
        if (isListening) return
        val context = reactApplicationContext

        broadcastReceiver = SmsBroadcastReceiver { msg ->
            reactApplicationContext
                .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
                .emit("onSmsReceived", msg)
        }

        val filter = IntentFilter(Telephony.Sms.Intents.SMS_RECEIVED_ACTION)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            context.registerReceiver(broadcastReceiver, filter, Context.RECEIVER_EXPORTED)
        } else {
            context.registerReceiver(broadcastReceiver, filter)
        }

        isListening = true
    }

    @ReactMethod
    fun stopListening() {
        if (!isListening || broadcastReceiver == null) return
        try {
            reactApplicationContext.unregisterReceiver(broadcastReceiver)
        } catch (_: Exception) {}
        broadcastReceiver = null
        isListening = false
    }
}

class SmsBroadcastReceiver(
    private val onReceive: (ReadableMap) -> Unit
) : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        if (intent.action == Telephony.Sms.Intents.SMS_RECEIVED_ACTION) {
            val messages = Telephony.Sms.Intents.getMessagesFromIntent(intent)
            for (msg in messages) {
                val map = Arguments.createMap()
                map.putString("id", "${System.currentTimeMillis()}${msg.hashCode()}")
                map.putString("address", msg.originatingAddress ?: "")
                map.putString("body", msg.messageBody ?: "")
                map.putDouble("date", System.currentTimeMillis().toDouble())
                onReceive(map)
            }
        }
    }
}
