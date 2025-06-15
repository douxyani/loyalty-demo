export default {
  name: "Loyalty Rewards",
  slug: "loyalty-rewards",
  version: "1.0.0",
  orientation: "portrait",
  icon: "./assets/icon.png",
  splash: {
    image: "./assets/splash.png",
    resizeMode: "contain",
    backgroundColor: "#ffffff"
  },
  scheme: "loyaltyapp",
  extra: {
    EXPO_PUBLIC_SUPABASE_URL: process.env.EXPO_PUBLIC_SUPABASE_URL,
    EXPO_PUBLIC_SUPABASE_ANON_KEY: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY,
    EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID,
  },
  plugins: [
    [
      "expo-camera",
      {
        "cameraPermission": "Allow $(PRODUCT_NAME) to access camera for scanning."
      }
    ]
  ],
  ios: {
    supportsTablet: true,
    bundleIdentifier: "com.anonymous.loyaltyrewards",
    infoPlist: {
      NSCameraUsageDescription: "This app needs camera access to scan QR codes."
    }
  },
  android: {
    package: "com.anonymous.loyaltyrewards",
    permissions: ["CAMERA"]
  }
};
