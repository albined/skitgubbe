package com.edegrangames.skitgubbe

import android.content.Context
import android.security.KeyChain
import java.net.InetSocketAddress
import java.net.Socket
import java.security.Principal
import java.security.PrivateKey
import java.security.cert.X509Certificate
import java.util.Locale
import javax.net.ssl.HttpsURLConnection
import javax.net.ssl.KeyManager
import javax.net.ssl.SSLContext
import javax.net.ssl.SSLEngine
import javax.net.ssl.SSLSessionContext
import javax.net.ssl.SSLSocket
import javax.net.ssl.X509ExtendedKeyManager

internal data class CertificateBinding(val alias: String, val origin: ServerOrigin)

internal data class CertificateMaterial(
    val privateKey: PrivateKey,
    val certificateChain: Array<X509Certificate>
)

internal data class CertificateStatus(
    val binding: CertificateBinding?,
    val available: Boolean,
    val subject: String? = null,
    val issuer: String? = null,
    val validFrom: Long? = null,
    val expiresAt: Long? = null,
    val validNow: Boolean? = null
)

internal interface ClientCredentialProvider {
    fun getPrivateKey(alias: String): PrivateKey?
    fun getCertificateChain(alias: String): Array<X509Certificate>?
}

private class KeyChainCredentialProvider(context: Context) : ClientCredentialProvider {
    private val applicationContext = context.applicationContext

    override fun getPrivateKey(alias: String): PrivateKey? = try {
        KeyChain.getPrivateKey(applicationContext, alias)
    } catch (exception: InterruptedException) {
        Thread.currentThread().interrupt()
        null
    } catch (_: Exception) {
        null
    }

    override fun getCertificateChain(alias: String): Array<X509Certificate>? = try {
        KeyChain.getCertificateChain(applicationContext, alias)
    } catch (exception: InterruptedException) {
        Thread.currentThread().interrupt()
        null
    } catch (_: Exception) {
        null
    }
}

internal class HostBoundKeyManager(
    private val binding: CertificateBinding?,
    private val credentials: ClientCredentialProvider
) : X509ExtendedKeyManager() {
    override fun chooseClientAlias(
        keyTypes: Array<out String>?,
        issuers: Array<out Principal>?,
        socket: Socket?
    ): String? {
        val peer = peerFor(socket) ?: return null
        return chooseAlias(keyTypes, issuers, peer.first, peer.second)
    }

    override fun chooseEngineClientAlias(
        keyTypes: Array<out String>?,
        issuers: Array<out Principal>?,
        engine: SSLEngine?
    ): String? {
        if (engine == null) return null
        return chooseAlias(keyTypes, issuers, engine.peerHost, engine.peerPort)
    }

    private fun chooseAlias(
        keyTypes: Array<out String>?,
        issuers: Array<out Principal>?,
        host: String?,
        port: Int
    ): String? {
        val configured = binding ?: return null
        if (!configured.origin.matches(host, port)) return null
        val chain = credentials.getCertificateChain(configured.alias) ?: return null
        if (!certificateMatches(chain, keyTypes, issuers)) return null
        if (credentials.getPrivateKey(configured.alias) == null) return null
        return configured.alias
    }

    override fun getCertificateChain(alias: String?): Array<X509Certificate>? {
        val configured = binding ?: return null
        if (alias != configured.alias) return null
        return credentials.getCertificateChain(configured.alias)
    }

    override fun getPrivateKey(alias: String?): PrivateKey? {
        val configured = binding ?: return null
        if (alias != configured.alias) return null
        return credentials.getPrivateKey(configured.alias)
    }

    // These methods lack a destination, so returning the configured alias could leak it.
    override fun getClientAliases(keyType: String?, issuers: Array<out Principal>?): Array<String>? = null
    override fun chooseServerAlias(keyType: String?, issuers: Array<out Principal>?, socket: Socket?): String? = null
    override fun getServerAliases(keyType: String?, issuers: Array<out Principal>?): Array<String>? = null
    override fun chooseEngineServerAlias(
        keyType: String?,
        issuers: Array<out Principal>?,
        engine: SSLEngine?
    ): String? = null

    private fun peerFor(socket: Socket?): Pair<String, Int>? {
        if (socket == null) return null
        val handshakeSession = try {
            (socket as? SSLSocket)?.handshakeSession
        } catch (_: UnsupportedOperationException) {
            null
        }
        val address = socket.remoteSocketAddress as? InetSocketAddress
        val host = handshakeSession?.peerHost ?: address?.hostString ?: return null
        val port = handshakeSession?.peerPort?.takeIf { it > 0 } ?: socket.port
        return host to port
    }
}

internal fun certificateMatches(
    chain: Array<X509Certificate>,
    keyTypes: Array<out String>?,
    issuers: Array<out Principal>?
): Boolean {
    if (chain.isEmpty()) return false
    val algorithm = chain.first().publicKey.algorithm.uppercase(Locale.US)
    val keyTypeMatches = keyTypes.isNullOrEmpty() || keyTypes.any { requested ->
        val normalized = requested.uppercase(Locale.US)
        when (algorithm) {
            "EC" -> normalized == "EC" || normalized == "ECDSA" || normalized.startsWith("EC_")
            "RSA" -> normalized == "RSA" || normalized.startsWith("RSA_")
            else -> normalized == algorithm
        }
    }
    if (!keyTypeMatches) return false

    if (issuers.isNullOrEmpty()) return true
    val acceptedIssuers = issuers.toSet()
    return chain.any { certificate ->
        certificate.issuerX500Principal in acceptedIssuers ||
            certificate.subjectX500Principal in acceptedIssuers
    }
}

internal fun invalidateClientSessions(sessionContext: SSLSessionContext?) {
    val sessions = sessionContext ?: return
    val ids = sessions.ids
    while (ids.hasMoreElements()) {
        try {
            sessions.getSession(ids.nextElement())?.invalidate()
        } catch (_: UnsupportedOperationException) {
            // Some Android Conscrypt session implementations cannot invalidate here.
        }
    }
}

internal object ClientCertificateManager {
    private const val PREFERENCES_NAME = "skitgubbe_mtls"
    private const val ALIAS_KEY = "alias"
    private const val HOST_KEY = "host"
    private const val PORT_KEY = "port"

    private val lock = Any()
    @Volatile private var applicationContext: Context? = null
    @Volatile private var currentBinding: CertificateBinding? = null
    @Volatile private var currentTlsContext: SSLContext? = null
    @Volatile private var credentialProvider: ClientCredentialProvider? = null

    fun initialize(context: Context) {
        if (applicationContext != null) return
        synchronized(lock) {
            if (applicationContext != null) return
            val appContext = context.applicationContext
            applicationContext = appContext
            credentialProvider = KeyChainCredentialProvider(appContext)

            val preferences = appContext.getSharedPreferences(PREFERENCES_NAME, Context.MODE_PRIVATE)
            val alias = preferences.getString(ALIAS_KEY, null)?.takeIf { it.isNotBlank() }
            val origin = ServerOrigin.fromStored(
                preferences.getString(HOST_KEY, null),
                preferences.getInt(PORT_KEY, ServerOrigin.DEFAULT_HTTPS_PORT)
            )
            currentBinding = if (alias != null && origin != null) CertificateBinding(alias, origin) else null
            rebuildTlsContextLocked()
        }
    }

    fun binding(): CertificateBinding? = currentBinding

    fun configure(alias: String, origin: ServerOrigin) {
        val context = requireContext()
        synchronized(lock) {
            context.getSharedPreferences(PREFERENCES_NAME, Context.MODE_PRIVATE)
                .edit()
                .putString(ALIAS_KEY, alias)
                .putString(HOST_KEY, origin.host)
                .putInt(PORT_KEY, origin.port)
                .apply()
            currentBinding = CertificateBinding(alias, origin)
            rebuildTlsContextLocked()
        }
    }

    fun removeConfiguration() {
        val context = requireContext()
        synchronized(lock) {
            context.getSharedPreferences(PREFERENCES_NAME, Context.MODE_PRIVATE).edit().clear().apply()
            currentBinding = null
            rebuildTlsContextLocked()
        }
    }

    fun resetTlsState() {
        synchronized(lock) {
            rebuildTlsContextLocked()
        }
    }

    fun loadMaterial(alias: String): CertificateMaterial? {
        val provider = credentialProvider ?: return null
        val privateKey = provider.getPrivateKey(alias) ?: return null
        val chain = provider.getCertificateChain(alias) ?: return null
        if (chain.isEmpty()) return null
        return CertificateMaterial(privateKey, chain)
    }

    fun status(): CertificateStatus {
        val configured = currentBinding ?: return CertificateStatus(null, available = false)
        val material = loadMaterial(configured.alias)
            ?: return CertificateStatus(configured, available = false)
        val leaf = material.certificateChain.first()
        val validNow = try {
            leaf.checkValidity()
            true
        } catch (_: Exception) {
            false
        }
        return CertificateStatus(
            binding = configured,
            available = true,
            subject = leaf.subjectX500Principal.name,
            issuer = leaf.issuerX500Principal.name,
            validFrom = leaf.notBefore.time,
            expiresAt = leaf.notAfter.time,
            validNow = validNow
        )
    }

    private fun rebuildTlsContextLocked() {
        val provider = credentialProvider ?: return
        val previousTlsContext = currentTlsContext
        val sslContext = SSLContext.getInstance("TLS")
        val keyManagers: Array<KeyManager> = arrayOf(HostBoundKeyManager(currentBinding, provider))
        // Null trust managers retain Android's normal server-certificate validation.
        sslContext.init(keyManagers, null, null)
        currentTlsContext = sslContext
        // CapacitorHttp opens HttpsURLConnection instances, which inherit this factory.
        HttpsURLConnection.setDefaultSSLSocketFactory(sslContext.socketFactory)
        invalidateClientSessions(previousTlsContext?.clientSessionContext)
    }

    private fun requireContext(): Context = applicationContext
        ?: throw IllegalStateException("ClientCertificateManager has not been initialized.")
}
