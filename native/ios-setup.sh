#!/bin/bash
# MacinCloud / any Mac with Xcode. Signs nothing — Xcode Archive does that.
# Capacitor 8 uses Swift Package Manager. CocoaPods is not required.
set -euo pipefail
cd "$(dirname "$0")/.."

if ! xcodebuild -version >/dev/null 2>&1; then
  if [[ -d /Applications/Xcode.app ]]; then
    echo "Selecting Xcode. Enter the Mac password if asked."
    sudo xcode-select -s /Applications/Xcode.app/Contents/Developer
  else
    echo "This MacinCloud plan has no Xcode. Switch to a plan that includes Xcode (GUI), then rerun."
    exit 1
  fi
fi

if ! command -v node >/dev/null; then
  if command -v brew >/dev/null; then
    brew install node
  else
    echo "Install Node from https://nodejs.org (LTS), then rerun this script."
    exit 1
  fi
fi

npm install
npx cap add ios 2>/dev/null || true
npx cap sync ios

PLIST="ios/App/App/Info.plist"
if [[ -f "$PLIST" ]]; then
  /usr/libexec/PlistBuddy -c "Add :NSCameraUsageDescription string 'Rummlee uses the camera so you can photograph an item you are listing.'" "$PLIST" 2>/dev/null || true
  /usr/libexec/PlistBuddy -c "Add :NSPhotoLibraryUsageDescription string 'Rummlee uses your photos so you can list an item.'" "$PLIST" 2>/dev/null || true
  /usr/libexec/PlistBuddy -c "Add :NSPhotoLibraryAddUsageDescription string 'Rummlee can save a listing photo to your library if you choose.'" "$PLIST" 2>/dev/null || true
  /usr/libexec/PlistBuddy -c "Add :ITSAppUsesNonExemptEncryption bool false" "$PLIST" 2>/dev/null || true
fi

npx cap open ios
echo
echo "In Xcode:"
echo "  1. Signing & Capabilities → Team = MKR Unlimited (your Apple ID). Automatic signing on."
echo "  2. Bundle Identifier = com.mkrunlimited.rummlee"
echo "  3. Destination = Any iOS Device (arm64)"
echo "  4. Product → Archive → Distribute App → App Store Connect → Upload"
echo "  5. Stop at TestFlight. Do not submit for App Store review yet."
