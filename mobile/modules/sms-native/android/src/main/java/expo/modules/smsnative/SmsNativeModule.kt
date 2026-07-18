package expo.modules.smsnative

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.database.Cursor
import android.net.Uri
import android.os.Build
import android.provider.Telephony
import android.Manifest
import android.content.pm.PackageManager
import expo.modules.kotlin.Promise
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import expo.modules.kotlin.exception.Exceptions
import androidx.core.content.ContextCompat
import androidx.core.app.ActivityCompat

class SmsNativeModule : Module() {
    private var broadcastReceiver: SmsBroadcastReceiver? = null
    private var isListening = false

    override fun definition() = ModuleDefinition {
        Name("SmsNative")

        AsyncFunction("readSms") { maxCount: Int ->
            readSmsMessages(maxCount)
        }

        AsyncFunction("requestPermissions") {
            requestSmsPermissions()
        }

        Function("startListening") {
            startListening()
        }

        Function("stopListening") {
            stopListening()
        }
    }

    private fun readSmsMessages(maxCount: Int): List<Map<String, Any>> {
        val context = appContext.reactContext ?: return emptyList()
        val messages = mutableListOf<Map<String, Any>>()

        if (ContextCompat.checkSelfPermission(context, Manifest.permission.READ_SMS)
            != PackageManager.PERMISSION_GRANTED) {
            return emptyList()
        }

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
                    val idIndex = cursor.getColumnIndex(Telephony.Sms._ID)
                    val addressIndex = cursor.getColumnIndex(Telephony.Sms.ADDRESS)
                    val bodyIndex = cursor.getColumnIndex(Telephony.Sms.BODY)
                    val dateIndex = cursor.getColumnIndex(Telephony.Sms.DATE)

                    if (idIndex >= 0 && addressIndex >= 0 && bodyIndex >= 0) {
                        messages.add(mapOf(
                            "id" to cursor.getString(idIndex),
                            "address" to (cursor.getString(addressIndex) ?: ""),
                            "body" to (cursor.getString(bodyIndex) ?: ""),
                            "date" to (if (dateIndex >= 0) cursor.getLong(dateIndex) else System.currentTimeMillis())
                        ))
                    }
                } while (cursor.moveToNext() && messages.size < maxCount)
            }
        } catch (e: Exception) {
            // silently fail
        } finally {
            cursor?.close()
        }

        return messages
    }

    private fun requestSmsPermissions(): Map<String, Boolean> {
        val context = appContext.reactContext ?: return mapOf("granted" to false)
        val activity = appContext.currentActivity ?: return mapOf("granted" to false)

        val permissions = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            arrayOf(Manifest.permission.READ_SMS , Manifest.permission.RECEIVE_SMS)
        } else {
            arrayOf(Manifest.permission.READ_SMS , Manifest.permission.RECEIVE_SMS)
        }

        val needsRequest = permissions.any {
            ContextCompat.checkSelfPermission(context, it) != PackageManager.PERMISSION_GRANTED
        }

        if (needsRequest) {
            ActivityCompat.requestPermissions(activity, permissions, 1001)
        }

        val granted = permissions.all {
            ContextCompat.checkSelfPermission(context, it) == PackageManager.PERMISSION_GRANTED
        }

        return mapOf("granted" to granted)
    }

    private fun startListening() {
        if (isListening) return
        val context = appContext.reactContext ?: return

        broadcastReceiver = SmsBroadcastReceiver { message ->
            sendEvent("onSmsReceived", mapOf(
                "id" to (message["id"] ?: ""),
                "address" to (message["address"] ?: ""),
                "body" to (message["body"] ?: ""),
                "date" to (message["date"] ?: System.currentTimeMillis())
            ))
        }

        val filter = IntentFilter(Telephony.Sms.Intents.SMS_RECEIVED_ACTION)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            context.registerReceiver(broadcastReceiver, filter, Context.RECEIVER_EXPORTED)
        } else {
            context.registerReceiver(broadcastReceiver, filter)
        }

        isListening = true
    }

    private fun stopListening() {
        if (!isListening || broadcastReceiver == null) return
        val context = appContext.reactContext ?: return

        try {
            context.unregisterReceiver(broadcastReceiver)
        } catch (e: Exception) {}

        broadcastReceiver = null
        isListening = false
    }
}

class SmsBroadcastReceiver(
    private val onReceive: (Map<String, Any>) -> Unit
) : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        if (intent.action == Telephony.Sms.Intents.SMS_RECEIVED_ACTION) {
            val messages = Telephony.Sms.Intents.getMessagesFromIntent(intent)
            for (message in messages) {
                onReceive(mapOf(
                    "id" to (System.currentTimeMillis().toString() + message.hashCode()),
                    "address" to (message.originatingAddress ?: ""),
                    "body" to (message.messageBody ?: ""),
                    "date" to System.currentTimeMillis()
                ))
            }
        }
    }
}
