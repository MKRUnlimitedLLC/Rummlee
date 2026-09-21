import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.mkrunlimited.rummlee",
  appName: "Rummlee",
  webDir: "native/www",
  server: {
    url: "https://rummlee.com",
    androidScheme: "https",
    hostname: "rummlee.com",
    allowNavigation: ["rummlee.com", "www.rummlee.com"],
  },
  plugins: {
    SplashScreen: {
      launchAutoHide: true,
      backgroundColor: "#9C4454",
      showSpinner: false,
    },
    StatusBar: {
      style: "LIGHT",
      backgroundColor: "#9C4454",
    },
    Keyboard: {
      resize: "body",
    },
  },
  ios: {
    contentInset: "automatic",
    preferredContentMode: "mobile",
    scheme: "Rummlee",
    backgroundColor: "#9C4454",
  },
  android: {
    allowMixedContent: false,
    backgroundColor: "#9C4454",
  },
};

export default config;
