package com.edegrangames.skitgubbe

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
}
