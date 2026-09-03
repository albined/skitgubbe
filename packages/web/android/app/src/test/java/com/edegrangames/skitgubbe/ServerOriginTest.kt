package com.edegrangames.skitgubbe

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertThrows
import org.junit.Assert.assertTrue
import org.junit.Test

class ServerOriginTest {
    @Test
    fun normalizesDefaultAndCustomPorts() {
        assertEquals(
            ServerOrigin("games.example.com", 443),
            ServerOrigin.fromServerUrl("https://Games.Example.com/")
        )
        assertEquals(
            "https://games.example.com:8443",
            ServerOrigin.fromServerUrl("https://games.example.com:8443/").displayValue
        )
    }

    @Test
    fun rejectsNonHttpsAndCredentialedUrls() {
        assertThrows(IllegalArgumentException::class.java) {
            ServerOrigin.fromServerUrl("http://games.example.com")
        }
        assertThrows(IllegalArgumentException::class.java) {
            ServerOrigin.fromServerUrl("https://user:pass@games.example.com")
        }
    }

    @Test
    fun rejectsAnythingBeyondAnOrigin() {
        listOf(
            "https://games.example.com/room",
            "https://games.example.com/?debug=true",
            "https://games.example.com/#fragment",
            "https://games.example.com:0"
        ).forEach { value ->
            assertThrows(IllegalArgumentException::class.java) {
                ServerOrigin.fromServerUrl(value)
            }
        }
    }

    @Test
    fun matchesOnlyExactHostAndEffectivePort() {
        val origin = ServerOrigin.fromServerUrl("https://games.example.com")
        assertTrue(origin.matches("GAMES.EXAMPLE.COM", 443))
        assertTrue(origin.matches("games.example.com", -1))
        assertFalse(origin.matches("other.example.com", 443))
        assertFalse(origin.matches("games.example.com", 8443))
    }
}
