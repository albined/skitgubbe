package com.edegrangames.skitgubbe

import android.content.pm.ApplicationInfo
import android.os.Bundle
import android.webkit.WebSettings
import com.getcapacitor.BridgeActivity

class MainActivity : BridgeActivity() {
    private var clientCertificateWebViewClient: ClientCertificateWebViewClient? = null

    override fun onCreate(savedInstanceState: Bundle?) {
        ClientCertificateManager.initialize(applicationContext)
        registerPlugin(ClientCertificatePlugin::class.java)
        registerPlugin(NativeCookiePlugin::class.java)
        super.onCreate(savedInstanceState)
        if (applicationInfo.flags and ApplicationInfo.FLAG_DEBUGGABLE != 0) {
            // The bundled app is served from https://localhost. Debug builds may connect
            // to a developer's HTTP API and ws:// endpoint on the local network.
            bridge.webView.settings.mixedContentMode = WebSettings.MIXED_CONTENT_ALWAYS_ALLOW
        }
        clientCertificateWebViewClient = ClientCertificateWebViewClient(bridge).also {
            bridge.setWebViewClient(it)
        }
    }

    override fun onDestroy() {
        clientCertificateWebViewClient?.shutdown()
        clientCertificateWebViewClient = null
        super.onDestroy()
    }
}
