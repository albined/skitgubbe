package com.edegrangames.skitgubbe

import android.os.Bundle
import com.getcapacitor.BridgeActivity

class MainActivity : BridgeActivity() {
    private var clientCertificateWebViewClient: ClientCertificateWebViewClient? = null

    override fun onCreate(savedInstanceState: Bundle?) {
        ClientCertificateManager.initialize(applicationContext)
        registerPlugin(ClientCertificatePlugin::class.java)
        super.onCreate(savedInstanceState)
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
