import "dotenv/config";

const androidClientId = (process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID ?? "").trim();
const iosClientId = (process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID ?? "").trim();

const androidPrefix = androidClientId && androidClientId !== "empty" ? androidClientId.replace(".apps.googleusercontent.com", "").trim() : "";
const iosPrefix = iosClientId && iosClientId !== "empty" ? iosClientId.replace(".apps.googleusercontent.com", "").trim() : "";

// Build scheme array; Android is optional (only needed for Android Google Sign-In)
const scheme = ["snortingcode", ...(iosPrefix ? [`com.googleusercontent.apps.${iosPrefix}`] : []), ...(androidPrefix ? [`com.googleusercontent.apps.${androidPrefix}`] : [])];

export default {
  expo: {
    name: "snorting-code",
    slug: "snorting-code",
    version: "1.0.0",
    orientation: "portrait",
    icon: "./assets/images/icon.png",
    scheme,
    userInterfaceStyle: "automatic",
    newArchEnabled: true,
    ios: {
      supportsTablet: true,
      bundleIdentifier: "com.concordia.snortingcode",
    },
    android: {
      package: "com.concordia.snortingcode",
      ...(androidPrefix && {
        intentFilters: [
          {
            action: "VIEW",
            autoVerify: true,
            data: [
              {
                scheme: `com.googleusercontent.apps.${androidPrefix}`,
                host: "schedule",
              },
            ],
            category: ["BROWSABLE", "DEFAULT"],
          },
        ],
      }),
      config: {
        googleMaps: {
          apiKey: process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY,
        },
      },
      adaptiveIcon: {
        backgroundColor: "#E6F4FE",
        foregroundImage: "./assets/images/android-icon-foreground.png",
        backgroundImage: "./assets/images/android-icon-background.png",
        monochromeImage: "./assets/images/android-icon-monochrome.png",
      },
      edgeToEdgeEnabled: true,
      predictiveBackGestureEnabled: false,
    },
    web: {
      output: "static",
      favicon: "./assets/images/favicon.png",
    },
    plugins: [
      "expo-router",
      [
        "expo-location",
        {
          locationWhenInUsePermission:
            "This app uses your location to show where you are on the campus map.",
        },
      ],
      [
        "expo-splash-screen",
        {
          image: "./assets/images/splash-icon.png",
          imageWidth: 200,
          resizeMode: "contain",
          backgroundColor: "#ffffff",
          dark: {
            backgroundColor: "#000000",
          },
        },
      ],
      "expo-web-browser",
      "expo-secure-store",
    ],
    experiments: {
      typedRoutes: true,
      reactCompiler: true,
    },
  },
};