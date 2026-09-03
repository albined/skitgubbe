# Maintaining the Android app

The Android target is a thin Capacitor shell around the existing SvelteKit client. The browser
deployment remains an `adapter-node` application; only `VITE_MOBILE_BUILD=true` selects
`adapter-static`, client-side rendering, and the `build-mobile/index.html` fallback. The mobile
bundle does not use a production `server.url` or load its fonts from the network.

The application ID, Gradle namespace, and Kotlin package are fixed as
`com.edegrangames.skitgubbe`. The Android project requires Java 21, minimum SDK 24, and Android
SDK 36.

## Architecture

- `packages/web/capacitor.config.ts` owns the Capacitor shell and HTTPS local origin.
- `packages/web/src/lib/platform/` owns runtime detection, configured-server persistence,
  native HTTP/cookies, URL construction, lifecycle, certificate access, and native push.
- `packages/web/android/app/src/main/java/com/edegrangames/skitgubbe/` owns Android KeyChain and
  mTLS integration. The selected alias is bound to an exact HTTPS host and effective port.
- `GET /api/app-info` is the public, database-independent server compatibility contract.
- Browser Web Push remains VAPID-based. Android registrations use FCM and are stored per app
  installation and active profile.

Ordinary Android API requests use Capacitor HTTP with bounded connect/read timeouts. Browser
requests remain relative and same-origin. WebSocket URLs are constructed centrally; Android uses
the selected server's absolute `wss:` origin. Native requests identify the Android transport so
profile selection can issue the same HttpOnly session as `SameSite=None; Secure`; browser sessions
retain the existing `SameSite=Lax` policy. This header does not grant or bypass authentication.

## Build and test

Install Bun dependencies at the repository root, then use:

```sh
bun install --frozen-lockfile
bun run build:mobile       # static client in packages/web/build-mobile
bun run mobile:sync        # build and copy plugins/assets into Android
bun run android:debug      # sync and assemble a debug APK on Unix-like hosts
```

The complete local automated gate is:

```sh
bun run check
bun test
bun --filter web build
bun run mobile:sync
cd packages/web/android
./gradlew testDebugUnitTest lintDebug assembleDebug
```

The debug APK is written to
`packages/web/android/app/build/outputs/apk/debug/app-debug.apk`. CI runs the same web/mobile
build, Android JVM tests, lint, and debug assembly on Linux with Java 21 and SDK 36.

On Windows, `gradlew.bat` can be run from Android Studio's terminal. When the repository is in
WSL, either configure a Linux JDK 21/SDK 36 or invoke the Windows wrapper with Android Studio's
bundled JBR 21. Do not let an older Gradle daemon select Java 11; stop it with `gradlew.bat --stop`
after changing `JAVA_HOME`.

## Server selection and compatibility

On first launch the app requires an HTTPS origin such as `https://games.example.com` and verifies
`/api/app-info` before accepting it. Origins with credentials, paths, queries, fragments, or HTTP
are rejected. The durable origin lives in Capacitor Preferences and is mirrored to `localStorage`
before route/state initialization so synchronous URL construction is safe.

The compatibility response is:

```json
{
	"product": "skitgubbe",
	"api_version": 1,
	"server_version": "<informational build version>"
}
```

Change `api_version` only for an incompatible client/server protocol. Set `SERVER_VERSION` at
server deployment time to a release name or commit SHA; it does not control compatibility.

Changing or clearing the configured server clears the previous server's cookies, server-scoped
client state, and any certificate binding without requiring the previous server to be reachable.

## Cloudflare mTLS and Android KeyChain

Provision each friend's client certificate outside the app and install it in Android's credential
storage. Never add a PKCS#12 file, private key, password, or Cloudflare service token to this
repository or application resources.

In the app:

1. Open the Android server settings.
2. Enter the exact public HTTPS server origin, including a non-default port if used.
3. Choose an already-installed certificate through Android KeyChain.
4. Connect. The app accepts the origin only after the mTLS-protected compatibility request works.

The native key manager returns the selected alias only for the bound host and effective port and
retains Android's normal server trust validation. A custom Capacitor WebView client handles client
certificate challenges for WebView HTTPS/WSS. Selection, removal, and origin changes clear
WebView certificate decisions, rebuild native TLS state, and invalidate cached client sessions.

## Firebase Cloud Messaging

Create a Firebase Android app with package name `com.edegrangames.skitgubbe`. Download its
`google-services.json` to `packages/web/android/app/google-services.json` for local/release builds.
That filename is ignored by git. Without it the app still builds, but native push is unavailable.

The server uses Firebase Admin application-default credentials only when native registrations
exist. Supply credentials at deployment through a mounted secret and configure, as applicable:

```sh
GOOGLE_APPLICATION_CREDENTIALS=/run/secrets/firebase-service-account.json
FIREBASE_PROJECT_ID=your-firebase-project
```

Do not commit the service-account JSON. Existing `VAPID_PUBLIC_KEY` and `VAPID_PRIVATE_KEY`
configuration remains unchanged for browsers. Invalid/unregistered FCM tokens are pruned after a
send failure.

## Versioning and signed Play bundles

Gradle reads validated release values from the environment. `ANDROID_VERSION_CODE` must be a
positive integer and must increase for every Play upload; `ANDROID_VERSION_NAME` must be nonempty.

Keep signing material outside the repository. Create the ignored
`packages/web/android/key.properties` only on a trusted build machine or inject it temporarily in
CI:

```properties
storeFile=/absolute/path/to/skitgubbe-upload.jks
storePassword=<secret>
keyAlias=<upload-key-alias>
keyPassword=<secret>
```

After syncing the bundle, create a signed Android App Bundle:

```sh
bun run mobile:sync
cd packages/web/android
ANDROID_VERSION_CODE=2 ANDROID_VERSION_NAME=1.1 ./gradlew bundleRelease
```

The result is `app/build/outputs/bundle/release/app-release.aab`. If `key.properties` is absent,
debug builds continue to work and a release bundle is unsigned. Google Play internal testing is
the first distribution track.

## Physical-device release checklist

Automated tests cannot prove WebView cookie forwarding or certificate presentation during a WSS
upgrade. Before each first/internal release, preferably use two physical Android devices:

- Fresh-install the APK/AAB-derived build and confirm the UI works with airplane mode before a
  server is selected (the frontend itself is bundled).
- Install a different client certificate on each device, select each once, and connect through
  Cloudflare mTLS.
- Select distinct profiles, force-stop both apps, relaunch, and verify authenticated REST access
  survives the real process restart.
- Create, invite, accept, play, reconnect, and finish a complete two-device game. Confirm the WSS
  upgrade is authenticated and presents the client certificate.
- Background/foreground during a turn, then change between Wi-Fi and cellular. Confirm one socket
  recovers through existing reconnect/replay behavior without leaking masked state.
- Bind a certificate to a custom port, then prove it is not offered to another host or port.
  Remove it and change servers; verify the change takes effect immediately.
- Enable Android notifications and verify invite, turn, and game-ended delivery in foreground and
  background. Tap each notification and confirm it opens only the lobby or expected room.
- Disable notifications and log out; verify registrations are detached or subsequently pruned.
- Confirm the Capacitor app does not register a service worker or browser Push subscription.
- Re-run the existing browser deployment, login/game flow, PWA update UI, and VAPID Web Push.

If cookie authentication is not available on native WSS, reproduce and record that result before
adding the specified short-lived, room-scoped ticket fallback. If WebView mTLS works for HTTPS but
not WSS on supported devices, reproduce it before adding a native WebSocket bridge. Neither
fallback should weaken or replace the normal browser cookie flow.
