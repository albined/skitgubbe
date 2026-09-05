package com.edegrangames.skitgubbe

import android.webkit.ClientCertRequest
import android.webkit.WebView
import com.getcapacitor.Bridge
import com.getcapacitor.BridgeWebViewClient
import java.util.concurrent.ExecutorService
import java.util.concurrent.Executors

class ClientCertificateWebViewClient(
    bridge: Bridge,
    private val executor: ExecutorService = Executors.newCachedThreadPool()
) : BridgeWebViewClient(bridge) {
    override fun onReceivedClientCertRequest(view: WebView, request: ClientCertRequest) {
        val requestHost = request.host
        val requestPort = request.port
        val binding = ClientCertificateManager.bindingFor(requestHost, requestPort)
        if (binding == null) {
            request.ignore()
            return
        }

        val requestedAlias = binding.alias
        val keyTypes = request.keyTypes?.clone()
        val issuers = request.principals?.clone()
        executor.execute {
            val material = ClientCertificateManager.loadMaterial(requestedAlias)
            view.post {
                val current = ClientCertificateManager.bindingFor(requestHost, requestPort)
                if (
                    current?.alias == requestedAlias &&
                    material != null &&
                    certificateMatches(material.certificateChain, keyTypes, issuers)
                ) {
                    request.proceed(material.privateKey, material.certificateChain)
                } else {
                    request.ignore()
                }
            }
        }
    }

    fun shutdown() {
        executor.shutdownNow()
    }
}
