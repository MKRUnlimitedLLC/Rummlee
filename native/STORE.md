# Rummlee native apps

Capacitor shells for the live site at https://rummlee.com.

| | |
|---|---|
| Display name | Rummlee |
| Bundle / application id | `com.mkrunlimited.rummlee` |
| Company | MKR Unlimited LLC |
| Category | Shopping |
| Age | 4+ |
| Privacy | https://rummlee.com/privacy |
| Support | https://rummlee.com/support |
| Marketing | https://rummlee.com |

The web app stays the source of truth. Store binaries load rummlee.com, so copy and listings ship without a new binary.

This Linux sandbox cannot produce a signed App Store IPA (needs a Mac + your Apple Developer certs). Android Studio / GitHub Actions produce the Play upload.

## iOS (App Store / TestFlight)

On a Mac with Xcode 16+ and your Apple Developer account:

```
git clone https://github.com/MKRUnlimitedLLC/Rummlee.git
cd Rummlee
npm install
npx cap add ios
npx cap sync ios
npx cap open ios
```

In Xcode:

1. Signing & Capabilities → Team = your Apple Developer team.
2. Bundle Identifier = `com.mkrunlimited.rummlee` (register it at developer.apple.com if new).
3. Version 1.0, Build 1.
4. Add usage strings if Xcode did not pick them up:
   - Privacy - Camera Usage Description: `Rummlee uses the camera so you can photograph an item you’re listing.`
   - Privacy - Photo Library Usage Description: `Rummlee uses your photos so you can list an item.`
5. Product → Archive → Distribute App → App Store Connect → Upload.
6. In App Store Connect: create the app, attach this bundle id, add screenshots (6.7" and 6.1" iPhone), privacy nutrition labels (User Content, Photos — linked to the user), review notes below.

ITSAppUsesNonExemptEncryption: No (HTTPS only).

Review notes for Apple:

> Rummlee is a neighborhood resale marketplace. Buyers and sellers never share a home address. Handoff is at official partner stores (primary), public places (secondary), or person-to-person. Sign in with email. Test account: create one in-app. Privacy: rummlee.com/privacy. Delete account: You → delete.

## Android (Play Console)

```
npm install
npx cap add android
npx cap sync android
npx cap open android
```

In Android Studio: Build → Generate Signed App Bundle. Package `com.mkrunlimited.rummlee`.

Or run the `Native Android` GitHub Action on `main` and download the AAB artifact, then sign with Play App Signing.

Permissions already requested: CAMERA, READ_MEDIA_IMAGES. Keep the store listing privacy URL https://rummlee.com/privacy.

## Screenshots

Capture from rummlee.com on an iPhone 15/16 frame and a Pixel frame:

1. Home — “The good stuff, before Saturday.”
2. Listing detail with partner-store pickup
3. Sales / partner stores
4. Sell form
5. Privacy copy on You

Do not screenshot home addresses. There aren’t any.
