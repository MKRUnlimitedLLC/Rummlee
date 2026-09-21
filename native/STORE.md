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

## iOS on MacinCloud (TestFlight)

Matthew uses MacinCloud. Plan must include **Xcode** (not a headless-only Mac).

1. In a browser (your iPad is fine): [developer.apple.com/account](https://developer.apple.com/account) → Identifiers → App IDs → Register `com.mkrunlimited.rummlee`. Then [appstoreconnect.apple.com](https://appstoreconnect.apple.com) → Apps → New → Rummlee, bundle `com.mkrunlimited.rummlee`, SKU `rummlee`, category Shopping.
2. Connect the MacinCloud Mac. Open **Terminal**. Paste:

```
git clone https://github.com/MKRUnlimitedLLC/Rummlee.git
cd Rummlee
chmod +x native/ios-setup.sh
./native/ios-setup.sh
```

3. Xcode opens. Signing & Capabilities → Team = MKR Unlimited (your Apple Developer team). Bundle Identifier `com.mkrunlimited.rummlee`. Version 1.0, Build 1.
4. Product → Destination → Any iOS Device. Product → Archive. Distribute App → App Store Connect → Upload.
5. App Store Connect → TestFlight → add testers. Listing screenshots and privacy nutrition can wait until after internal TestFlight.

Camera / photo usage strings are written by the script. Encryption: No.

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
