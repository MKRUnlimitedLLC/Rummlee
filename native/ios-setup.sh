#!/bin/bash
# Run on a Mac with Xcode 16+ and an Apple Developer account.
set -euo pipefail
cd "$(dirname "$0")/.."
npm install
npx cap add ios
npx cap sync ios

PLIST="ios/App/App/Info.plist"
if [[ -f "$PLIST" ]]; then
  /usr/libexec/PlistBuddy -c "Add :NSCameraUsageDescription string 'Rummlee uses the camera so you can photograph an item you’re listing.'" "$PLIST" 2>/dev/null || true
  /usr/libexec/PlistBuddy -c "Add :NSPhotoLibraryUsageDescription string 'Rummlee uses your photos so you can list an item.'" "$PLIST" 2>/dev/null || true
  /usr/libexec/PlistBuddy -c "Add :NSPhotoLibraryAddUsageDescription string 'Rummlee can save a listing photo to your library if you choose.'" "$PLIST" 2>/dev/null || true
  /usr/libexec/PlistBuddy -c "Add :ITSAppUsesNonExemptEncryption bool false" "$PLIST" 2>/dev/null || true
fi

npx cap open ios
echo "In Xcode: Team = your Apple Developer team, bundle com.mkrunlimited.rummlee, Archive → App Store Connect."
