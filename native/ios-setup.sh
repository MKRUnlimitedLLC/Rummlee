#!/bin/bash
# MacinCloud / any Mac with Xcode. Signs nothing — Xcode Archive does that.
set -euo pipefail
cd "$(dirname "$0")/.."

if ! xcodebuild -version >/dev/null 2>&1; then
  echo "Open Xcode once, then: sudo xcode-select -s /Applications/Xcode.app"
  exit 1
fi

if ! command -v node >/dev/null; then
  if command -v brew >/dev/null; then
    brew install node
  else
    echo "Install Node 22 from https://nodejs.org then rerun."
    exit 1
  fi
fi

if ! command -v pod >/dev/null; then
  sudo gem install cocoapods
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
echo "Xcode: Signing Team = your Apple Developer team. Bundle com.mkrunlimited.rummlee. Product → Archive → Distribute → App Store Connect."
