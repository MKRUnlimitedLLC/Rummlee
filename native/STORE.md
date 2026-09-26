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

**Do this on the Mac.** Full click-path: [native/MACINCLOUD.md](MACINCLOUD.md).

Matthew uses MacinCloud. Plan must include **Xcode** (not a headless-only Mac). App Store Connect: **Account Holder or Admin**, not Limited Access.

1. In a browser: confirm App ID `com.mkrunlimited.rummlee` and the Rummlee app (Apple ID 6814519476).
2. Connect the MacinCloud Mac. Open **Terminal**. Paste:

```
git clone https://github.com/MKRUnlimitedLLC/Rummlee.git
cd Rummlee
chmod +x native/ios-setup.sh
./native/ios-setup.sh
```

3. Xcode opens. Signing & Capabilities → Team = MKR Unlimited. Bundle Identifier `com.mkrunlimited.rummlee`. Version 1.0, Build 1.
4. Product → Destination → Any iOS Device. Product → Archive. Distribute App → App Store Connect → Upload.
5. App Store Connect → TestFlight → add testers. Do not submit for App Store review yet.

Camera / photo usage strings are in Info.plist. Encryption: No.

Review notes for Apple:

> Rummlee is a neighborhood resale marketplace. Buyers and sellers never share a home address. Handoff is at official partner stores (primary), public places (secondary), or person-to-person. Sign in with email. Test account: create one in-app. Privacy: rummlee.com/privacy. Delete account: You → delete.


## Android (Play Console)

Full click-path: [native/ANDROID.md](ANDROID.md).

Package `com.mkrunlimited.rummlee`. Privacy URL https://rummlee.com/privacy. Upload a **signed** AAB to Internal testing only. The GitHub Action AAB is unsigned — Play will reject it until you sign it yourself. Debug APK artifact `rummlee-android-debug` is for your own phone, not Play.

## Screenshots

Capture from rummlee.com on an iPhone 15/16 frame and a Pixel frame:

1. Home — “The good stuff, before Saturday.”
2. Listing detail with partner-store pickup
3. Sales / partner stores
4. Sell form
5. Privacy copy on You

Do not screenshot home addresses. There aren’t any.
