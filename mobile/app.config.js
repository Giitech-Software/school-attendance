import 'dotenv/config';

export default ({ config }) => ({
  ...config,

  owner: "giitech_software_systems",   // 👈 ADD THIS LINE

  name: "ASTEM Attendance Register",
  slug: "mobile",
  version: "1.0.0",

  orientation: "portrait",
  scheme: "mobile",
  userInterfaceStyle: "automatic",

  updates: {
    url: "https://u.expo.dev/39fe1569-e82e-4a40-9ee4-9c7c6f47b60b",
    fallbackToCacheTimeout: 0,
  },

  runtimeVersion: {
    policy: "appVersion",
  },

  newArchEnabled: true,
  icon: "./assets/images/icon.png",

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
   permissions: [
  "CAMERA",
  "ACCESS_FINE_LOCATION",
  "ACCESS_COARSE_LOCATION"
],
    adaptiveIcon: {
      foregroundImage: "./assets/images/adaptive-icon-foreground.png",
      backgroundColor: "#0A4FB3",
    },
  },

  plugins: [
    "expo-web-browser",
    "expo-router",
     "@react-native-community/datetimepicker",
     "expo-location",

    /*[
      "react-native-vision-camera",
      {
        cameraPermissionText: "Allow camera access for face attendance",
        enableFrameProcessors: true,
      },
    ],*/
    [
      "expo-build-properties",
      {
        android: {
          minSdkVersion: 26,
        },
      },
    ],
    [
      "expo-splash-screen",
      {
        image: "./assets/images/splash.png",
        resizeMode: "cover",
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
    FIREBASE_MESSAGING_SENDER_ID: process.env.FIREBASE_MESSAGING_SENDER_ID,
    FIREBASE_APP_ID: process.env.FIREBASE_APP_ID,
    FIREBASE_MEASUREMENT_ID: process.env.FIREBASE_MEASUREMENT_ID,

    eas: {
      projectId: "39fe1569-e82e-4a40-9ee4-9c7c6f47b60b",
    },
  },
});
