package com.edegrangames.skitgubbe

import android.content.ActivityNotFoundException
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.provider.Settings
import androidx.core.app.NotificationManagerCompat
import com.getcapacitor.JSObject
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.CapacitorPlugin
import com.google.firebase.messaging.FirebaseMessaging

@CapacitorPlugin(name = "NativePush")
class NativePushPlugin : Plugin() {
    internal var firebaseMessagingProvider: () -> FirebaseMessaging = {
        FirebaseMessaging.getInstance()
    }

    @PluginMethod
    fun deleteToken(call: PluginCall) {
        try {
            val messaging = firebaseMessagingProvider()
            messaging.isAutoInitEnabled = false
            messaging.deleteToken()
                .addOnCompleteListener { task ->
                    if (task.isSuccessful) {
                        call.resolve()
                    } else {
                        val message = task.exception?.localizedMessage ?: "Failed to delete Firebase push token."
                        call.reject(message, task.exception)
                    }
                }
        } catch (exception: Exception) {
            val message = exception.localizedMessage ?: "Could not initiate Firebase token deletion."
            call.reject(message, exception)
        }
    }

    // Unlike the runtime permission, this also reflects notifications switched off in
    // system settings, which is the only switch Android 12 and older have.
    @PluginMethod
    fun areNotificationsEnabled(call: PluginCall) {
        val enabled = NotificationManagerCompat.from(context).areNotificationsEnabled()
        call.resolve(JSObject().put("enabled", enabled))
    }

    // Falls back to the app's details page where a ROM has no notification settings screen.
    @PluginMethod
    fun openNotificationSettings(call: PluginCall) {
        val appDetails = Intent(
            Settings.ACTION_APPLICATION_DETAILS_SETTINGS,
            Uri.fromParts("package", context.packageName, null)
        )
        val intents = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            listOf(
                Intent(Settings.ACTION_APP_NOTIFICATION_SETTINGS)
                    .putExtra(Settings.EXTRA_APP_PACKAGE, context.packageName),
                appDetails
            )
        } else {
            listOf(appDetails)
        }
        for (intent in intents) {
            try {
                activity.startActivity(intent)
                call.resolve()
                return
            } catch (exception: ActivityNotFoundException) {
                // Try the next screen.
            }
        }
        call.reject("Could not open notification settings.")
    }
}
