package com.edegrangames.skitgubbe

import android.app.Application
import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.os.Build

class SkitgubbeApplication : Application() {
    override fun onCreate() {
        super.onCreate()
        createNotificationChannels()
    }

    // One channel per kind of push, matching the channel the server tags each message with
    // (packages/server/src/nativePush.ts). Created when the process starts, so a push that
    // arrives before the app is opened after an update still finds its channel.
    private fun createNotificationChannels() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return
        val manager = getSystemService(NotificationManager::class.java)
        listOf(
            "invites" to R.string.channel_invites,
            "turns" to R.string.channel_turns,
            "game-ended" to R.string.channel_game_ended
        ).forEach { (id, name) ->
            val channel = NotificationChannel(id, getString(name), NotificationManager.IMPORTANCE_HIGH)
            channel.lockscreenVisibility = Notification.VISIBILITY_PUBLIC
            channel.enableVibration(true)
            manager.createNotificationChannel(channel)
        }
        // Replaced by the channels above; keeping it would leave a dead switch in settings.
        manager.deleteNotificationChannel("game-updates")
    }
}
