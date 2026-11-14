#!/bin/bash
# One command to go from a fresh clone to an Xcode project that is ready to run.
# Run it on a Mac, from the repository folder:  bash scripts/setup-ios.sh
# It is safe to run again at any time.
set -euo pipefail
cd "$(dirname "$0")/.."

if [[ "$(uname)" != "Darwin" ]]; then
  echo "This needs a Mac: iPhone apps can only be built with Xcode." >&2
  exit 1
fi
if ! xcodebuild -version >/dev/null 2>&1; then
  echo "Xcode is not installed yet. Install it from the Mac App Store, open it once, then run this again." >&2
  exit 1
fi

echo "1/5  Installing packages"
npm install

echo "2/5  Running tests"
npm test

echo "3/5  Building the app"
npm run build

echo "4/5  Creating the iPhone project"
if [[ ! -d ios ]]; then
  npx cap add ios --packagemanager SPM
fi
npx cap sync ios

echo "5/5  Applying icon, permissions and privacy settings"
node scripts/apply-ios-resources.mjs

echo
echo "Done. Opening Xcode. Next steps are in docs/APP_STORE_LAUNCH.md (step 2)."
npx cap open ios
