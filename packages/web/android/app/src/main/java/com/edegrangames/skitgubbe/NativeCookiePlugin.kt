package com.edegrangames.skitgubbe

import android.net.Uri
import android.webkit.CookieManager
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.CapacitorPlugin

@CapacitorPlugin(name = "NativeCookie")
class NativeCookiePlugin : Plugin() {
    @PluginMethod
    fun syncResponseCookie(call: PluginCall) {
        val url = call.getString("url")
        val cookie = call.getString("cookie")
        val uri = url?.let(Uri::parse)
        if (
            url.isNullOrBlank() ||
            cookie.isNullOrBlank() ||
            uri?.host.isNullOrBlank() ||
            (uri?.scheme != "http" && uri?.scheme != "https")
        ) {
            call.reject("The response cookie target is invalid.")
            return
        }

        activity.runOnUiThread {
            try {
                val manager = CookieManager.getInstance()
                manager.setCookie(url, cookie) { accepted ->
                    if (accepted) {
                        manager.flush()
                        call.resolve()
                    } else {
                        call.reject("Android rejected the server session cookie.")
                    }
                }
            } catch (exception: Exception) {
                call.reject("Android could not store the server session cookie.", exception)
            }
        }
    }
}
