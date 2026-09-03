package com.edegrangames.skitgubbe

import android.net.Uri
import android.security.KeyChain
import android.security.KeyChainAliasCallback
import android.util.Log
import android.webkit.WebView
import com.getcapacitor.JSObject
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.CapacitorPlugin
import java.util.concurrent.ExecutorService
import java.util.concurrent.Executors
import java.util.concurrent.atomic.AtomicBoolean

@CapacitorPlugin(name = "ClientCertificate")
class ClientCertificatePlugin : Plugin() {
    private companion object {
        const val TAG = "ClientCertificate"
    }

    private val executor: ExecutorService = Executors.newSingleThreadExecutor()
    private val selectionInProgress = AtomicBoolean(false)

    override fun load() {
        ClientCertificateManager.initialize(context.applicationContext)
        super.load()
    }

    @PluginMethod
    fun getStatus(call: PluginCall) {
        executor.execute {
            try {
                call.resolve(statusJson(ClientCertificateManager.status()))
            } catch (exception: Exception) {
                call.reject("Android could not read the client certificate status.", exception)
            }
        }
    }

    @PluginMethod
    fun selectInstalledCertificate(call: PluginCall) {
        chooseAlias(call)
    }

    @PluginMethod
    fun removeConfiguration(call: PluginCall) {
        try {
            ClientCertificateManager.removeConfiguration()
            clearWebViewCertificatePreferences {
                call.resolve(statusJson(ClientCertificateManager.status()))
            }
        } catch (exception: Exception) {
            call.reject("Android could not remove the client certificate configuration.", exception)
        }
    }

    override fun handleOnResume() {
        super.handleOnResume()
        val binding = ClientCertificateManager.binding() ?: return
        executor.execute {
            try {
                if (ClientCertificateManager.loadMaterial(binding.alias) == null) {
                    ClientCertificateManager.resetTlsState()
                    clearWebViewCertificatePreferences()
                }
            } catch (exception: Exception) {
                Log.w(TAG, "Could not refresh client certificate TLS state.", exception)
            }
        }
    }

    override fun handleOnDestroy() {
        executor.shutdownNow()
        super.handleOnDestroy()
    }

    private fun chooseAlias(call: PluginCall) {
        val origin = try {
            originFromCall(call)
        } catch (exception: IllegalArgumentException) {
            call.reject(exception.message ?: "Enter a valid HTTPS server URL.", exception)
            return
        }

        if (!selectionInProgress.compareAndSet(false, true)) {
            call.reject("A certificate selection is already in progress.")
            return
        }

        val currentAlias = ClientCertificateManager.binding()
            ?.takeIf { it.origin == origin }
            ?.alias
        val callback = KeyChainAliasCallback { alias ->
            if (alias == null) {
                selectionInProgress.set(false)
                call.resolve(JSObject().put("selected", false))
                return@KeyChainAliasCallback
            }

            executor.execute {
                try {
                    val material = ClientCertificateManager.loadMaterial(alias)
                    if (material == null) {
                        selectionInProgress.set(false)
                        call.reject("Android did not grant access to the selected certificate.")
                        return@execute
                    }

                    ClientCertificateManager.configure(alias, origin)
                    val response = statusJson(ClientCertificateManager.status())
                    response.put("selected", true)
                    clearWebViewCertificatePreferences {
                        selectionInProgress.set(false)
                        call.resolve(response)
                    }
                } catch (exception: Exception) {
                    selectionInProgress.set(false)
                    call.reject("Android could not configure the selected certificate.", exception)
                }
            }
        }

        activity.runOnUiThread {
            try {
                KeyChain.choosePrivateKeyAlias(
                    activity,
                    callback,
                    null,
                    null,
                    Uri.parse(origin.displayValue),
                    currentAlias
                )
            } catch (exception: Exception) {
                selectionInProgress.set(false)
                call.reject("Android could not open the certificate chooser.", exception)
            }
        }
    }

    private fun originFromCall(call: PluginCall): ServerOrigin {
        val serverUrl = call.getString("serverUrl")
            ?: throw IllegalArgumentException("Enter the HTTPS server URL first.")
        return ServerOrigin.fromServerUrl(serverUrl)
    }

    private fun clearWebViewCertificatePreferences(afterClear: (() -> Unit)? = null) {
        activity.runOnUiThread {
            WebView.clearClientCertPreferences {
                if (afterClear != null) activity.runOnUiThread { afterClear() }
            }
        }
    }

    private fun statusJson(status: CertificateStatus): JSObject {
        val response = JSObject()
        val binding = status.binding
        response.put("configured", binding != null)
        response.put("available", status.available)
        if (binding != null) {
            response.put("alias", binding.alias)
            response.put("origin", binding.origin.displayValue)
        }
        status.subject?.let { response.put("subject", it) }
        status.issuer?.let { response.put("issuer", it) }
        status.validFrom?.let { response.put("validFrom", it) }
        status.expiresAt?.let { response.put("expiresAt", it) }
        status.validNow?.let { response.put("validNow", it) }
        return response
    }
}
