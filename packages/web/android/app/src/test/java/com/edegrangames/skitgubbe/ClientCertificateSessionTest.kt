package com.edegrangames.skitgubbe

import java.lang.reflect.Proxy
import java.util.Collections
import java.util.Enumeration
import javax.net.ssl.SSLSession
import javax.net.ssl.SSLSessionContext
import org.junit.Assert.assertTrue
import org.junit.Test

class ClientCertificateSessionTest {
    @Test
    fun unsupportedInvalidationDoesNotAbortRemainingSessions() {
        var secondSessionInvalidated = false
        val context = TestSessionContext(
            listOf(
                session { throw UnsupportedOperationException() },
                session { secondSessionInvalidated = true }
            )
        )

        invalidateClientSessions(context)

        assertTrue(secondSessionInvalidated)
    }

    private class TestSessionContext(private val sessions: List<SSLSession>) : SSLSessionContext {
        override fun getSession(sessionId: ByteArray): SSLSession? =
            sessions.getOrNull(sessionId.first().toInt())

        override fun getIds(): Enumeration<ByteArray> =
            Collections.enumeration(sessions.indices.map { byteArrayOf(it.toByte()) })

        override fun setSessionTimeout(seconds: Int) = Unit
        override fun getSessionTimeout(): Int = 0
        override fun setSessionCacheSize(size: Int) = Unit
        override fun getSessionCacheSize(): Int = sessions.size
    }

    private fun session(onInvalidate: () -> Unit): SSLSession =
        Proxy.newProxyInstance(
            SSLSession::class.java.classLoader,
            arrayOf(SSLSession::class.java)
        ) { _, method, _ ->
            if (method.name == "invalidate") onInvalidate()
            null
        } as SSLSession
}
