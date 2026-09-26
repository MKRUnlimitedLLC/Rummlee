# Rummlee Android — Play Internal testing

Capacitor shell. The app opens https://rummlee.com. Package `com.mkrunlimited.rummlee`. Display name **Rummlee**.

## What you upload

| | |
|---|---|
| Play Console app name | Rummlee |
| Package name | `com.mkrunlimited.rummlee` |
| Privacy policy | https://rummlee.com/privacy |
| Track | **Internal testing only** — do not submit production review yet |

## Signed AAB (your computer)

Do this on a computer with **Android Studio**. Create the upload keystore yourself and keep it on your SSD. Bots never generate or store a keystore.

```bash
git clone https://github.com/MKRUnlimitedLLC/Rummlee.git
cd Rummlee
npm ci
npx cap sync android
```

Then in Android Studio: open the `android/` folder → **Build → Generate Signed App Bundle**.

Upload that signed AAB to Play Console → **Internal testing**. Play will reject the unsigned AAB from GitHub Actions.

## Debug APK (phone tryout)

The **Native Android** GitHub Action uploads artifact `rummlee-android-debug`. Install that APK on your own phone to try the shell. It is not a Play upload.

## Permissions

INTERNET and CAMERA only. Photo pick uses the system picker. Do **not** request `READ_MEDIA_IMAGES`, storage, location, contacts, or notification permissions.
