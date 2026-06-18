import 'dotenv/config';

export default ({ config }) => ({
  ...config,

  owner: "giitech_software_systems",

  name: "M'Salem Attendance Register",
  slug: "mobile",
  version: "2.0.0",

  orientation: "portrait",
  scheme: "mobile",
  userInterfaceStyle: "automatic",

  // ✅ Smaller + faster JS runtime
  jsEngine: "hermes",

  // ✅ Disable OTA updates for APK-only distribution (reduces overhead)
  updates: {
    enabled: false,
  },

  runtimeVersion: {
    policy: "appVersion",
  },

  // ⚠️ Turn OFF if you face issues with camera/ML libs
  newArchEnabled: true,

  icon: "./assets/images/icon.png",

  splash: {
    image: "./assets/images/splash.png",
    resizeMode: "contain",
    backgroundColor: "#E6F4FE",
  },

  ios: {
    supportsTablet: true,
    bundleIdentifier: "com.giitechsoftwaresystems.mobile",
    infoPlist: {
      ITSAppUsesNonExemptEncryption: false,
      NSCameraUsageDescription:
        "Camera access is required for face attendance",
      NSLocationWhenInUseUsageDescription:
        "Location is required to verify school attendance inside campus.",
    },
  },

  android: {
    package: "com.giitech_software_systems.mobile",

    edgeToEdgeEnabled: true,
    predictiveBackGestureEnabled: false,
    softwareKeyboardLayoutMode: "resize",

    // ✅ Shrinks APK size significantly
    enableProguardInReleaseBuilds: true,

    permissions: [
      "CAMERA",
      "ACCESS_FINE_LOCATION",
      "ACCESS_COARSE_LOCATION",
    ],

    adaptiveIcon: {
      foregroundImage: "./assets/images/adaptive-icon-foreground.png",
      backgroundColor: "#FFFFFF",
    },
  },

  plugins: [
    "expo-web-browser",
    "expo-router",
    "@react-native-community/datetimepicker",
    "expo-location",

    // ❌ REMOVE vision camera unless absolutely needed
    // (major APK size increase)
    /*
    [
      "react-native-vision-camera",
      {
        cameraPermissionText: "Allow camera access for face attendance",
        enableFrameProcessors: true,
      },
    ],
    */

    [
      "expo-build-properties",
      {
        android: {
          minSdkVersion: 26,

          // ✅ Further size reduction
          enableProguardInReleaseBuilds: true,
          enableShrinkResources: true,
        },
      },
    ],

    [
      "expo-splash-screen",
      {
        image: "./assets/images/splash.png",
        resizeMode: "contain",
        imageWidth: 260,
        backgroundColor: "#E6F4FE",
      },
    ],

    "expo-secure-store",
  ],

  web: {
    output: "static",
    favicon: "./assets/images/favicon.png",
  },

  experiments: {
    typedRoutes: true,
    reactCompiler: true,
  },

  extra: {
    FIREBASE_API_KEY: process.env.FIREBASE_API_KEY,
    FIREBASE_AUTH_DOMAIN: process.env.FIREBASE_AUTH_DOMAIN,
    FIREBASE_PROJECT_ID: process.env.FIREBASE_PROJECT_ID,
    FIREBASE_STORAGE_BUCKET: process.env.FIREBASE_STORAGE_BUCKET,
    FIREBASE_MESSAGING_SENDER_ID:
      process.env.FIREBASE_MESSAGING_SENDER_ID,
    FIREBASE_APP_ID: process.env.FIREBASE_APP_ID,
    FIREBASE_MEASUREMENT_ID:
      process.env.FIREBASE_MEASUREMENT_ID,

    eas: {
      projectId: "39fe1569-e82e-4a40-9ee4-9c7c6f47b60b",
    },
  },
});
