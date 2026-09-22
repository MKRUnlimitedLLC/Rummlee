# MacinCloud → TestFlight (do this on the Mac)

The live site is already https://rummlee.com. This step only wraps it in an iPhone app and puts it on TestFlight. **Do not submit for App Store review yet** — beta uses test credits, not real money.

## App Store Connect access

Sign in as **Account Holder** or **Admin**. Limited Access cannot create identifiers, upload builds, or add TestFlight testers.

| | |
|---|---|
| App | Rummlee (already created) |
| Bundle ID | `com.mkrunlimited.rummlee` |
| Apple ID | `6814519476` |
| SKU | Rummlee |
| Category | Shopping |

If the App ID is missing: [developer.apple.com/account](https://developer.apple.com/account) → Identifiers → App IDs → Register `com.mkrunlimited.rummlee`.

## MacinCloud plan

You need a Mac **with Xcode** (Dedicated or a GUI plan). A headless / SSH-only server cannot Archive.

1. Connect to the Mac (their app or browser desktop).
2. Open **Xcode** once. If it asks to install extra components, agree. Quit it.
3. Xcode → Settings → Accounts → **+** → your **Apple Developer** Apple ID (same as App Store Connect Account Holder).
4. Open **Terminal**. Paste this whole block:

```
git clone https://github.com/MKRUnlimitedLLC/Rummlee.git
cd Rummlee
chmod +x native/ios-setup.sh
./native/ios-setup.sh
```

If the folder already exists from a previous try:

```
cd ~/Rummlee
git pull
./native/ios-setup.sh
```

The script installs Node if needed, syncs the iOS project, and opens Xcode.

## In Xcode (5 clicks)

1. Left sidebar → **App** target (blue icon).
2. **Signing & Capabilities** → Team = **MKR Unlimited**. Automatically manage signing = on. Bundle Identifier = `com.mkrunlimited.rummlee`.
3. Toolbar destination → **Any iOS Device (arm64)** — not a simulator.
4. Menu **Product → Archive**. Wait until the Organizer window appears.
5. **Distribute App → App Store Connect → Upload**. Defaults are fine. Upload.

Processing takes 5–20 minutes. Then: [appstoreconnect.apple.com](https://appstoreconnect.apple.com) → Rummlee → **TestFlight**.

- **Internal testers** (your App Store Connect users) can install immediately.
- **External testers** need a short Beta App Review the first time — that’s still not the public App Store.

Encryption question: **No** (already set in the project).

## If something fails

| You see | Do this |
|---|---|
| “No Xcode” | This MacinCloud plan is headless. Switch to one that includes Xcode. |
| Signing team empty | Xcode → Settings → Accounts → add your Apple ID. Then pick the team. |
| Failed to register bundle ID | Create `com.mkrunlimited.rummlee` under Certificates, Identifiers & Profiles, then retry Archive. |
| “No devices” | Destination must be **Any iOS Device**, not a simulator. |
| Upload succeeded, TestFlight empty | Wait. Email from Apple when processing finishes. |

Review notes if Apple asks (TestFlight external only):

> Rummlee is a neighborhood resale marketplace in beta. Listings are sample items. Pay is simulated test credits — no real money. Buyers and sellers never share a home address. Handoff is at official partner stores (primary), public places (secondary), or person-to-person. Sign in with email. Privacy: rummlee.com/privacy. Delete account: You → delete.

When TestFlight is on your iPhone, tell Grok “TestFlight is in” and we do Android / Play next.
