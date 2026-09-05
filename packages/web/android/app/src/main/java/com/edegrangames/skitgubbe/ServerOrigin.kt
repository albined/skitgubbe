package com.edegrangames.skitgubbe

import java.net.IDN
import java.net.URI
import java.util.Locale

internal data class ServerOrigin(val host: String, val port: Int) {
    val displayValue: String
        get() {
            val displayHost = if (host.contains(':')) "[$host]" else host
            return if (port == DEFAULT_HTTPS_PORT) {
                "https://$displayHost"
            } else {
                "https://$displayHost:$port"
            }
        }

    fun matches(candidateHost: String?, candidatePort: Int): Boolean {
        val normalizedHost = normalizeHost(candidateHost) ?: return false
        val normalizedPort = if (candidatePort > 0) candidatePort else DEFAULT_HTTPS_PORT
        return host == normalizedHost && port == normalizedPort
    }

    companion object {
        const val DEFAULT_HTTPS_PORT = 443

        fun fromServerUrl(value: String): ServerOrigin {
            val uri = try {
                URI(value.trim())
            } catch (exception: Exception) {
                throw IllegalArgumentException("Enter a valid HTTPS server URL.", exception)
            }

            if (!uri.scheme.equals("https", ignoreCase = true) || uri.userInfo != null) {
                throw IllegalArgumentException("Client certificates require an HTTPS server URL.")
            }
            if (
                (!uri.rawPath.isNullOrEmpty() && uri.rawPath != "/") ||
                uri.rawQuery != null ||
                uri.rawFragment != null
            ) {
                throw IllegalArgumentException("Enter only the HTTPS server origin.")
            }
            val host = normalizeHost(uri.host)
                ?: throw IllegalArgumentException("Enter a valid HTTPS server URL.")
            val port = if (uri.port == -1) DEFAULT_HTTPS_PORT else uri.port
            if (port !in 1..65_535) {
                throw IllegalArgumentException("Enter a valid HTTPS server port.")
            }
            return ServerOrigin(host, port)
        }

        fun fromStored(host: String?, port: Int): ServerOrigin? {
            val normalizedHost = normalizeHost(host) ?: return null
            if (port !in 1..65_535) return null
            return ServerOrigin(normalizedHost, port)
        }

        private fun normalizeHost(value: String?): String? {
            val trimmed = value?.trim()?.trimEnd('.')?.removePrefix("[")?.removeSuffix("]")
            if (trimmed.isNullOrEmpty()) return null
            return try {
                if (trimmed.contains(':')) {
                    trimmed.lowercase(Locale.US)
                } else {
                    IDN.toASCII(trimmed).lowercase(Locale.US)
                }
            } catch (_: IllegalArgumentException) {
                null
            }
        }
    }
}
