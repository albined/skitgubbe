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
retain the existing `SameSite=Lax` policy. Android debug builds additionally support local HTTP as
described below. Release builds do not. The platform header does not grant or bypass authentication.

## Build from WSL

The root Android commands use a Linux JDK 21 and Linux Android SDK 36. On this machine they
already exist at `~/.jdks/temurin-21` and `~/.android-sdk`. No Windows Gradle invocation or global
shell configuration is needed. Windows Android Studio/ADB can still be used independently.

Run every `bun run android:*` command below from the repository root (`/home/albin/egna_proj/skitgubbe`)
inside WSL. They are not Windows PowerShell commands and do not need to be run from
`packages/web/android`.

Install dependencies once, then initialize the local signing file:

```sh
bun install --frozen-lockfile
bun run android:setup
```

Setup preserves existing configuration. It creates the ignored `packages/web/android/key.properties`
with owner-only permissions and points to `~/.local/share/skitgubbe-signing/skitgubbe-upload.p12`.
Open that file locally and fill in `keyAlias`, `storePassword`, and `keyPassword`. PKCS12 normally
uses the same password for both entries. Do not send passwords in chat or put them in commands.
The format is Java properties: do not surround values with quotes; double literal backslashes and
escape any leading password spaces with a backslash. A tracked `key.properties.example` documents
all fields, including explicit `storeType=PKCS12`. Paths must be absolute Linux paths, not `~`.

If you need to find the alias, this command prompts for the password without echoing it:

```sh
~/.jdks/temurin-21/bin/keytool -list -keystore ~/.local/share/skitgubbe-signing/skitgubbe-upload.p12 -storetype PKCS12
```

Back up the upload key and its password privately. Setup never generates or replaces the key.

```sh
bun run android:doctor    # validate the toolchain, version, Firebase Android config, and upload key
bun run android:bundle    # build/sync the web app, sign, verify, and copy the Play App Bundle
```

The final file is `dist/android/skitgubbe-<versionName>-<versionCode>.aab`. The command prints its
Linux path and, in WSL, a Windows path that can be pasted into your browser's file picker.
The Gradle original remains at `packages/web/android/app/build/outputs/bundle/release/app-release.aab`.
A rebuilt version replaces its local artifact; builds never increment versions or upload anything.

For another Linux machine, set `JAVA_HOME` to JDK 21 and `ANDROID_HOME` to its SDK before setup.
A JDK 21 in `PATH` or `/usr/lib/jvm/java-21-openjdk-amd64` is also recognized. Install SDK components
`platforms;android-36` and `build-tools;36.0.0` using Linux `sdkmanager`. An existing `sdk.dir` in
ignored `android/local.properties` must agree with your SDK environment. Paths apply only to the
build subprocess; the scripts do not install tools, change shell startup files, or modify Windows.

Other commands:

```sh
bun run android:debug      # build/sync and assemble a debug APK using the same WSL toolchain
bun run build:mobile       # static frontend only
bun run mobile:sync        # static frontend and Capacitor sync only
bun run android:gradle testDebugUnitTest lintDebug assembleDebug
```

The debug APK is `packages/web/android/app/build/outputs/apk/debug/app-debug.apk`. Debug builds and
CI do not require signing credentials or Firebase configuration. A partially filled signing file
does not prevent debugging. Release tasks require valid configuration even when Gradle is called
directly, and the bundle command explicitly disables frontend development tools.

The automated gate is:

```sh
bun run check
bun test
bun --filter web build
bun run mobile:sync
bun run android:gradle testDebugUnitTest lintDebug assembleDebug
```

## Versioning and the next upload

`packages/web/android/version.properties` is the authoritative Android version, initially
`versionName=0.1.0` and `versionCode=1`. Environment variables `ANDROID_VERSION_CODE` and
`ANDROID_VERSION_NAME` are no longer used. The server version and `/api/app-info` compatibility
version are independent of the Android release number.

Build the first upload as-is. Before each subsequent upload, intentionally bump and commit:

```sh
bun run android:version build   # edit version.properties: same display version, versionCode + 1
bun run android:bundle           # use that version to produce the signed .aab
```

Use `patch`, `minor`, or `major` instead of `build` to also bump the corresponding part of the
display version, resetting smaller parts. Each increments the existing version code by one.
Commit `version.properties` with the release changes. Rebuilding does not change either value.
Never reuse a code already uploaded to Play, even if that release was discarded. Play accepts
positive version codes up to 2100000000; the workflow validates this limit. See
[Android versioning](https://developer.android.com/studio/publish/versioning).

## Upload to Google Play internal testing

1. Create the Skitgubbe app in Play Console, if needed. The bundle package is fixed as
   `com.edegrangames.skitgubbe`; uploading the first artifact fixes the Play app's package name.
2. Open **Test and release → Testing → Internal testing**, create a release, and upload the
   verified `.aab` from `dist/android`.
3. Complete Play App Signing enrollment when prompted. Let Google manage the app signing key;
   your existing `.p12` is the upload key. The certificate Google uses on installed apps can
   differ from your upload certificate. See [Play App Signing](https://developer.android.com/studio/publish/app-signing).
4. Add release notes, resolve the Console's required prompts, review, and roll out to internal testing.
5. In the **Testers** tab, create/select the email list for your friends, save it, and copy the
   opt-in link. Each friend joins using the listed Google account and installs through Google Play.

Internal testing supports up to 100 testers and can start before completing public app setup.
The initial opt-in link can take several hours to become available. There is no need to move to
closed testing or production for this use case. See the
[Google Play internal testing guide](https://support.google.com/googleplay/android-developer/answer/9845334?hl=en).

An existing sideloaded debug build has the same package but a different signing key. If it blocks
installation from Play, removing it also removes its local app settings; reselect the server and
client certificate after installing from Play. Subsequent Play releases update normally.

## Server selection and compatibility

On first launch the app requires an HTTPS origin such as `https://games.example.com` and verifies
`/api/app-info` before accepting it. Origins with credentials, paths, queries, or fragments are
rejected. The durable origin lives in Capacitor Preferences and is mirrored to `localStorage`
before route/state initialization so synchronous URL construction is safe.

A debuggable APK also accepts an HTTP origin such as `http://10.15.20.42:5173`. Its debug manifest
allows cleartext traffic and its WebView permits the corresponding `ws:` connection. Run
`bun run dev`, use the development machine's LAN address and Vite port `5173`, and keep both devices
on the same network. Because cross-site WebView cookies cannot use `SameSite=None` without HTTPS,
the non-production server returns a development-only session token for HTTP API and WebSocket
authentication. This fallback is disabled whenever `NODE_ENV=production`; release APKs also reject
HTTP in URL validation, disallow cleartext in the manifest, and retain normal mixed-content rules.

Before an HTTPS game's WebSocket opens, the app makes an unpatched WebView HTTPS request to
`/api/app-info`. This primes Chromium's client-certificate selection through the existing
WebView handler; native HTTP uses a separate TLS context. Chromium cancels a WebSocket handshake
when a new client-certificate selection is needed. The warm-up retains certificate validation,
has a ten-second timeout, and is cancelled when leaving the room. Verify this on a cold app launch
against the mTLS server, not just after a successful connection in the same process.

Server settings are available as **Byt server** at the bottom of the profile menu and on the
profile selection screen. The floating gear button has been removed.

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

The existing Firebase project is `skitgubbe-cab56`, with Android package
`com.edegrangames.skitgubbe`. Keep its downloaded `google-services.json` at
`packages/web/android/app/google-services.json` (ignored). `android:doctor` checks the project,
package, app ID, sender ID, and API key and unlocks the upload key. These are local checks;
they do not prove cloud permissions or delivery to a device.

The server also needs a separate **Firebase Admin service-account credential**. The Android
`google-services.json` cannot authorize the server to send notifications. Do not embed a
service-account credential in the frontend, Android assets, or Docker image.

### One-time server configuration

1. In Firebase Console, select **skitgubbe-cab56 → Project settings → Service accounts →
   Firebase Admin SDK → Generate new private key**. Download the JSON privately. See the
   [Firebase Admin setup guide](https://firebase.google.com/docs/admin/setup).
2. On the machine running Docker Compose, store it outside the repository, for example at
   `~/.local/share/skitgubbe-firebase/firebase-service-account.json`. Restrict the directory to
   your user and the file to mode `600`. Confirm its `project_id` is `skitgubbe-cab56`; do not
   print or share its `private_key`.
3. In **Project settings → Cloud Messaging**, check that **Firebase Cloud Messaging API (V1)**
   is enabled. Follow the linked API settings if it needs enabling. Do not enable legacy FCM.
4. Add these values to the deployment's ignored `.env`, replacing the host path:

```dotenv
FIREBASE_PROJECT_ID=skitgubbe-cab56
FIREBASE_SERVICE_ACCOUNT_FILE=/home/YOUR_USER/.local/share/skitgubbe-firebase/firebase-service-account.json
```

Validate the Compose configuration and, when ready to restart the server with native push enabled,
use both files:

```sh
docker compose -f docker-compose.yml -f docker-compose.firebase.yml config --quiet
docker compose -f docker-compose.yml -f docker-compose.firebase.yml up -d server
```

Use both `-f` arguments for subsequent deployments that should retain Firebase configuration.
The overlay mounts the credential read-only at `/run/secrets/firebase-service-account.json`
and sets `GOOGLE_APPLICATION_CREDENTIALS` in the server container. The base Compose deployment
continues to work without any Firebase credential. Merely adding values to `.env` does not
mount the secret; the overlay is required. No deployment is performed by the Android build.

### Verify actual delivery

Install the internal-track build on an Android device with Google Play services. Connect to the
HTTPS game server (select the client certificate if required), select a profile, and enable
notifications. Use a second profile/device to trigger an invitation or turn notification. Verify
foreground delivery, background delivery, and tapping a notification into the correct lobby/room.
Check server logs for Firebase credential/API errors if delivery fails. An FCM configuration check
alone is not an end-to-end notification test.

Browser Web Push continues to use its existing VAPID configuration. Firebase Admin initializes
lazily when native registrations exist; invalid/unregistered FCM tokens are pruned after send
failures. The app's Android 13+ notification permission and `game-updates` channel are already wired.
Cloud signing certificate fingerprints, if required by any API-key restrictions you configure,
must cover the Play **app signing** certificate, not just the local upload certificate.

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
