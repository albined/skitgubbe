package com.edegrangames.skitgubbe

import java.security.PrivateKey
import java.security.PublicKey
import java.security.cert.X509Certificate
import javax.net.ssl.SSLContext
import javax.security.auth.x500.X500Principal
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test
import org.mockito.Mockito.mock
import org.mockito.Mockito.`when`

class HostBoundKeyManagerTest {
    @Test
    fun unrelatedOriginsNeverConsultCredentials() {
        val credentials = RecordingCredentialProvider(null, null)
        val manager = HostBoundKeyManager(
            CertificateBinding("phone-cert", ServerOrigin("games.example.com", 443)),
            credentials
        )

        assertNull(manager.chooseEngineClientAlias(
            arrayOf("RSA"), null, SSLContext.getDefault().createSSLEngine("other.example.com", 443)
        ))
        assertNull(manager.chooseEngineClientAlias(
            arrayOf("RSA"), null, SSLContext.getDefault().createSSLEngine("games.example.com", 8443)
        ))
        assertEquals(0, credentials.chainLookups)
        assertEquals(0, credentials.keyLookups)
    }

    @Test
    fun configuredOriginReturnsOnlyMatchingCertificate() {
        val issuer = X500Principal("CN=Skitgubbe Client CA")
        val certificate = mock(X509Certificate::class.java)
        val publicKey = mock(PublicKey::class.java)
        val privateKey = mock(PrivateKey::class.java)
        `when`(publicKey.algorithm).thenReturn("RSA")
        `when`(certificate.publicKey).thenReturn(publicKey)
        `when`(certificate.issuerX500Principal).thenReturn(issuer)
        `when`(certificate.subjectX500Principal).thenReturn(X500Principal("CN=Phone"))
        val credentials = RecordingCredentialProvider(privateKey, arrayOf(certificate))
        val manager = HostBoundKeyManager(
            CertificateBinding("phone-cert", ServerOrigin("games.example.com", 443)),
            credentials
        )
        val engine = SSLContext.getDefault().createSSLEngine("games.example.com", 443)

        assertEquals("phone-cert", manager.chooseEngineClientAlias(arrayOf("RSA"), arrayOf(issuer), engine))
        assertNull(manager.chooseEngineClientAlias(arrayOf("EC"), arrayOf(issuer), engine))
        assertNull(
            manager.chooseEngineClientAlias(
                arrayOf("RSA"), arrayOf(X500Principal("CN=Different CA")), engine
            )
        )
    }

    private class RecordingCredentialProvider(
        private val privateKey: PrivateKey?,
        private val chain: Array<X509Certificate>?
    ) : ClientCredentialProvider {
        var chainLookups = 0
        var keyLookups = 0

        override fun getPrivateKey(alias: String): PrivateKey? {
            keyLookups += 1
            return privateKey
        }

        override fun getCertificateChain(alias: String): Array<X509Certificate>? {
            chainLookups += 1
            return chain
        }
    }
}
