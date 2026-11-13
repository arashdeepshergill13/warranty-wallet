# Backed

An iPhone app that keeps receipts and reminds you before a warranty runs out.
Everything is stored on the phone. There is no server, no account and no network access.

**Publishing it:** follow [docs/APP_STORE_LAUNCH.md](docs/APP_STORE_LAUNCH.md).

## How it works

| Part | Where | Notes |
| --- | --- | --- |
| Interface | `src/` | React, built with Vite, shown in a native web view by Capacitor 8 |
| Scanning, text recognition, Face ID | `plugins/wallet-native/` | One Swift file using Apple's VisionKit, Vision and LocalAuthentication |
| Reading a receipt | `src/lib/parser.js` | Turns recognised text into store, date, items and prices, on the device |
| Storage | `src/lib/storage.js` | JSON and JPEG files in the app's private Library folder; two copies of the data file so an interrupted save cannot lose it |
| Reminders | `src/lib/reminders.js` | iOS local notifications, rebuilt whenever data changes |
| Backup | `src/lib/backup.js` | Export and restore through the share sheet |

## Commands

```bash
npm install          # once
npm test             # receipt reader and warranty date tests
npm run dev          # the interface in a browser (no scanner there; add items by photo or by hand)
npm run build        # production build, then checks the no-network policy is present
npm run ios:setup    # first time on a Mac: create and configure the Xcode project
npm run ios          # after changes: rebuild, copy into the Xcode project, open Xcode
```

`dev/` holds a browser test harness that stands in for the native layer and walks through every screen (`node dev/build.mjs && node dev/e2e.cjs`). It needs esbuild and Playwright, which are not project dependencies.

## Security model

- The production build carries a Content-Security-Policy that blocks every outgoing connection and every script that is not part of the bundle. `scripts/check-build.mjs` fails the build if it is missing.
- Everything read from disk or from a backup file passes through `sanitizeItem` / `sanitizeSettings` before use. Photo file names are checked against a strict pattern.
- iOS encrypts the app's files at rest; the launch guide turns on Complete data protection.
- Optional app lock uses the system Face ID / Touch ID / passcode prompt.
- No analytics, ads or third-party SDKs.

After `npm install`, commit the `package-lock.json` it creates so every build uses the same package versions.
