Known limitations and gotchas when integrating `@onramper/onramper-react-native`. For the full integration walkthrough — install, usage, error handling, API reference — see [Getting started](doc:headless-react-native-getting-started).

---

## App Attest in the simulator
Always returns `attestationFailed`. Apple's `DCAppAttestService` only works on physical iOS 14+ devices. Use a real device for any end-to-end test.

## Xcode 16+/26 Swift modules
The app target's "Emit Swift module" phase can fail with `module map file ... not found` for the Swift pods. Disable explicit Swift modules (`SWIFT_ENABLE_EXPLICIT_MODULES = NO`) — see [iOS build setup](doc:ios-build-setup) for the Podfile snippet. Expo apps get this from the config plugin.

## Android
Stub-only. All Android calls throw `platformUnsupported`. A native Android SDK is not part of this release.

## Local development via `file:` symlink (contributors only)
If you link the wrapper into a host app via `"@onramper/onramper-react-native": "file:.."`, Metro can resolve `react-native-nitro-modules` and `react-native` from BOTH the host app and the wrapper repo's own node_modules — two parallel module instances, which break native view/registry lookups.

Fix it in the host app's `metro.config.js` (force a single copy):

```js
config.resolver.disableHierarchicalLookup = true;
config.resolver.nodeModulesPaths = [path.resolve(__dirname, 'node_modules')];
```

On a **bare RN (Community CLI)** host, the `file:..` symlink also hides the package from CLI autolinking; add a `react-native.config.js` in the host app pointing at the package root and its podspec. Registry installs hit neither issue — there's no symlink.


## SDK logs (1.3.0+)

`logLevel` controls native diagnostics. Provide `logHandler` in client configuration
to receive structured records in JavaScript as well as the native Console. Each
record has `timestamp` (Unix milliseconds), `level`, `category`, `event`, `context`,
and `message`. Logging defaults to `off`; callback exceptions are isolated from
checkout, and records queued after `destroy()` are ignored.

The bare demo records SDK logs by default from initialization, including in bundled
Release builds. **Settings → Diagnostic logs** lists daily UTC files such as
`onramper-sdk-2026-10-13.log`, newest first, with their sizes. Tap a file for a
selectable text preview (the latest 200 KB), or **Share** to export that day's file.
**Refresh** reloads the list; **Delete all logs** asks for confirmation.
A saved off choice is respected across launches and upgrades; turn recording back
on before reproducing an issue if you previously disabled it.

Records are readable timestamped lines, stored in `Library/Application Support/Logs`
and excluded from backups. Each launch adds app version, build, iOS version and
hardware model (no device identifier). Disk I/O runs on a serial native queue after
records reach the JavaScript callback. The on-screen event panel remains separate.

Files older than seven days are pruned on append/list/read/export. Retained files
are capped at 5 MiB: older days are removed first; an oversized single day keeps
its latest complete lines with a truncation notice. Export creates an independent
snapshot with the dated filename, so ongoing writes or deletion cannot change it
while the share sheet is open. Snapshot files are removed when sharing finishes.
After an interrupted share, abandoned snapshots older than 24 hours are cleaned
up when the native store initializes or another export starts. Current-process
exports are protected from cleanup while sharing, including across bridge reloads.
The 5 MiB cap applies to saved logs; temporary share snapshots are separate.

Run `npm run test:logs` in `example/` on macOS for Foundation-only file-store tests.
Records use the released SDK's sanitization, but provider messages may retain
personal data after best-effort redaction. Review logs before sharing.

The Expo example displays the callback records in its bounded on-screen log.
Integrators own persistent storage and export; the library adds no storage dependency.
