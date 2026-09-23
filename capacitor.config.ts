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
      backgroundColor: "#C8101E",
      showSpinner: false,
    },
    StatusBar: {
      style: "LIGHT",
      backgroundColor: "#C8101E",
    },
    Keyboard: {
      resize: "body",
    },
  },
  ios: {
    contentInset: "automatic",
    preferredContentMode: "mobile",
    scheme: "Rummlee",
    backgroundColor: "#C8101E",
  },
  android: {
    allowMixedContent: false,
    backgroundColor: "#C8101E",
  },
};

export default config;
