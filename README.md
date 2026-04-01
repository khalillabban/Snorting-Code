# Snorting Code

Snorting Code is a SOEN 390 mobile application for Concordia University. It is built with Expo and React Native and is designed to help students, faculty, staff, and visitors navigate the Loyola and Sir George Williams campuses more efficiently.

The current app combines outdoor campus maps, route guidance, shuttle support, and Google Calendar schedule import in a single mobile experience.

## Project Overview

Large university campuses are difficult to navigate, especially for new students, visitors, or anyone moving between unfamiliar buildings. Snorting Code addresses that problem with a campus-focused navigation app tailored to Concordia's SGW and Loyola campuses.

The project goal is to reduce confusion and travel time by giving users a single place to:

- View campus maps
- Navigate between buildings and campuses
- Check shuttle availability and shuttle schedules
- Import course schedules from Google Calendar
- Reuse imported schedule data to guide users to their next class

## Target Users

- Concordia University students
- Faculty and staff
- Visitors attending classes, meetings, or campus events

## Scope Notes

- The current repository focuses on outdoor maps, route guidance, shuttle information, and Google Calendar schedule import.
- The course architecture documentation also outlines future indoor-navigation concepts for later scope, but those indoor graph and state-machine modules are not implemented in this repository today.

## Features

- Interactive campus maps for the SGW and Loyola campuses
- Building selection and route guidance between locations
- Current-location support for map navigation
- Shuttle availability and shuttle schedule views
- Google Calendar integration for course schedule import
- Next-class routing based on the imported schedule cached on device

## Tech Stack

- Expo
- React Native
- TypeScript
- Expo Router
- `react-native-maps`
- `expo-location`
- Google Calendar API
- Google Maps Platform
- AsyncStorage
- Jest and React Native Testing Library
- Maestro for E2E flow coverage

## Prerequisites

Before running the app locally, make sure you have:

- Node.js LTS and npm
- Android Studio if you plan to run Android builds or use an Android emulator
- Xcode if you plan to run iOS builds or use the iOS simulator (macOS only)
- A JDK compatible with your Android Gradle toolchain
- A Google Cloud project for Google Calendar OAuth
- A Google Maps Platform API key for directions and Android map configuration

## Installation

1. Clone the repository and move into the project folder.
2. Install dependencies:

   ```bash
   npm install
   ```

3. Create a `.env` file in the project root (see [Environment Variables](#environment-variables) section).
4. Download Firebase credential files from the Discord `#shared-credentials` channel and place them in the project root:
   - `google-services.json` for Android
   - `GoogleService-Info.plist` for iOS
5. Add the required environment variables to `.env`.
6. Start Expo:

   ```bash
   npm run start
   ```

## Environment Variables

| Variable | Required | Purpose |
| --- | --- | --- |
| `EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID` | Yes | Required for Android Google Calendar sign-in. The current `app.config.js` also expects this value at startup. |
| `EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID` | Required for iOS | Required for native Google Calendar sign-in on iOS. |
| `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID` | Optional | Only needed if you want a web or Expo proxy OAuth client configuration. |
| `EXPO_PUBLIC_GOOGLE_MAPS_API_KEY` | Yes | Used for route generation and Android Google Maps configuration. |
| `EXPO_PUBLIC_SMARTLOOK_PROJECT_KEY` | Required for Smartlook | Smartlook project key used in `app/_layout.tsx` to initialize session recording in development builds. |

Important notes:

- `.env` is ignored by Git and should not be committed.
- Any change to `.env` requires restarting Expo.
- Changes to Google client IDs affect native configuration in `app.config.js`, so you should rebuild the native app after updating them.
- See `.env.example` for a template of all required variables.

## Firebase Credential Files

This project uses Firebase for analytics. Two credential files are required for native builds:

- **`google-services.json`** (Android): Placed in the project root. Used by `app.config.js` for Android configuration.
- **`GoogleService-Info.plist`** (iOS): Placed in the project root. Used by `app.config.js` for iOS configuration.

Both files are in `.gitignore` and should **not** be committed to the repository.

### Getting Firebase Credentials

Download both files from the team's Discord `#shared-credentials` channel:

1. Go to Discord `#shared-credentials` channel.
2. Find the Firebase credential files (`google-services.json` and `GoogleService-Info.plist`).
3. Download both files.
4. Place them in the project root (the same level as `package.json`).
5. Rebuild the native app after adding the files:

   ```bash
   npm run android
   ```

   or

   ```bash
   npm run ios
   ```

## Usability Testing Setup

This project already includes Firebase Analytics and Smartlook integration for usability sessions.

### Prerequisites

- Firebase credential files (`google-services.json` and `GoogleService-Info.plist`) placed in the project root (see [Firebase Credential Files](#firebase-credential-files)).
- `EXPO_PUBLIC_SMARTLOOK_PROJECT_KEY` added to `.env` (available in the Discord `#shared-credentials` channel).

### Installation

1. Install dependencies (if not already installed):

    ```bash
    npm install @react-native-firebase/app @react-native-firebase/analytics
    npx expo install react-native-smartlook-analytics expo-constants
    ```

2. Add `EXPO_PUBLIC_SMARTLOOK_PROJECT_KEY` to `.env` and restart Expo.

3. If you are building for iOS, run CocoaPods in the iOS project and update the Podfile:

   ```bash
   cd ios
   pod install
   ```

   Then open [ios/Podfile](ios/Podfile) and add this line directly underneath `prepare_react_native_project!`:

   ```ruby
   use_modular_headers!
   ```

4. Build and run a native dev build with the credential files in place:

    ```bash
    npm run android
    ```

    or

    ```bash
    npm run ios
    ```

### Firebase DebugView

Firebase usability events are easiest to validate in `Analytics -> DebugView`.

**Android:**

```bash
adb shell setprop debug.firebase.analytics.app com.concordia.snortingcode
```

Then run your app and interact with it. Events should appear in DebugView within 10-30 seconds.

**iOS (Xcode recommended):**

1. Open the iOS project in Xcode.
2. Go to `Product -> Scheme -> Edit Scheme...`.
3. Select `Run` then `Arguments`.
4. Add `-FIRDebugEnabled` under "Arguments Passed On Launch".
5. Run the app from Xcode.

Interact with the app and check `Firebase Console -> Analytics -> DebugView` for events.

**iOS CLI alternative:**

```bash
npx react-native run-ios -- --args="-FIRDebugEnabled"
```

## Google Calendar OAuth Setup

The schedule screen uses Google OAuth with the Google Calendar API. Follow the steps below to configure the required client IDs.

### 1. Create a Google Cloud project

1. Go to `https://console.cloud.google.com/`.
2. Create a new Google Cloud project.
3. Open `APIs & Services`.
4. Go to `Library`.
5. Enable `Google Calendar API`.

### 2. Configure the OAuth consent screen

Google will require an OAuth consent screen before you can create OAuth client IDs.

1. Open `APIs & Services -> OAuth consent screen`.
2. Select `External`.
3. Fill in the required app details.
4. Add yourself as a test user using the Google account you will use for sign-in.
5. Add the scope:

   ```text
   https://www.googleapis.com/auth/calendar.readonly
   ```

### 3. Create the iOS OAuth client ID

This client ID is required for native iOS authentication.

1. Open `APIs & Services -> Credentials`.
2. Select `Create Credentials -> OAuth client ID`.
3. Set `Application type` to `iOS`.
4. Use this bundle ID:

   ```text
   com.concordia.snortingcode
   ```

5. Create the credential.
6. Copy the generated client ID into `.env`:

   ```env
   EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID="your-ios-client-id.apps.googleusercontent.com"
   ```

### 4. Create the Android OAuth client ID

This client ID is required for Android authentication and is currently required for the Expo config to load.

1. Open `APIs & Services -> Credentials`.
2. Select `Create Credentials -> OAuth client ID`.
3. Set `Application type` to `Android`.
4. Use this package name:

   ```text
   com.concordia.snortingcode
   ```

5. Generate the SHA-1 fingerprint from the local Android project.

   PowerShell:

   ```powershell
   cd android
   .\gradlew signingReport
   ```

   macOS or Linux:

   ```bash
   cd android
   ./gradlew signingReport
   ```

6. Copy the SHA-1 fingerprint for the build variant you are using. For local development, the `debug` variant is usually the correct choice.
7. Create the credential.
8. Copy the generated client ID into `.env`:

   ```env
   EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID="your-android-client-id.apps.googleusercontent.com"
   ```

If `signingReport` fails, the most common cause is a JDK or Gradle version mismatch in the local Android toolchain.

### 5. Create the optional web OAuth client ID

This step is optional. The current mobile flow uses native redirects with `useProxy: false`, but a web client ID can still be useful for browser or proxy-based auth experiments.

1. Open `APIs & Services -> Credentials`.
2. Select `Create Credentials -> OAuth client ID`.
3. Set `Application type` to `Web application`.
4. Add this redirect URI, replacing `your-expo-username` with the Expo account that owns the app:

   ```text
   https://auth.expo.io/@your-expo-username/snorting-code
   ```

5. Create the credential.
6. Copy the generated client ID into `.env`:

   ```env
   EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID="your-web-client-id.apps.googleusercontent.com"
   ```

### 6. Rebuild after updating OAuth values

The app derives native URL schemes from the Google client IDs in `app.config.js`. After updating any Google client ID:

1. Stop Expo.
2. Start it again.
3. Rebuild the native app:

   ```bash
   npm run android
   ```

   or

   ```bash
   npm run ios
   ```

## Google Maps API Setup

Route generation depends on a Google Maps Platform API key.

1. In Google Cloud, enable the APIs you need for this app.
2. At minimum, enable:
   - `Directions API`
   - `Maps SDK for Android`
3. Create an API key.
4. Add it to `.env`:

   ```env
   EXPO_PUBLIC_GOOGLE_MAPS_API_KEY="your-google-maps-api-key"
   ```

If this key is missing, route generation will fail and Android map configuration will be incomplete.

## Running the App

Use the scripts defined in `package.json`:

- Start Expo:

  ```bash
  npm run start
  ```

- Start Expo with a tunnel:

  ```bash
  npm run start:tunnel
  ```

- Build and run Android:

  ```bash
  npm run android
  ```

- Build and run iOS:

  ```bash
  npm run ios
  ```

- Run the web build:

  ```bash
  npm run web
  ```

For Google Calendar authentication on mobile, prefer a native development build instead of relying on Expo Go. The current auth flow is configured for native redirects.

## Testing and Linting

- Run the test suite:

  ```bash
  npm test
  ```

- Run the linter:

  ```bash
  npm run lint
  ```

- End-to-end flows are stored in `.maestro/`. If you have the Maestro CLI installed locally, you can run an individual flow with a command such as:

  ```bash
  maestro test .maestro/us-2.6-shuttle-schedule.yaml
  ```

## Schedule Import Behavior

The schedule screen does not import every event in the Google account automatically. The current implementation has a few project-specific rules:

- It reads from the `primary` Google Calendar.
- It only loads events inside the semester window defined in `constants/semesterConfig.ts`.
- It filters imported events to those whose title contains `LEC`, `TUT`, or `LAB`.
- Imported schedule items are cached locally and reused by the campus map for next-class navigation.

If no classes appear after a successful sign-in, verify that your Concordia schedule was exported to Google Calendar and that the events match the rules above.

## Project Structure

Key folders in this repository:

- `app/`: Expo Router screens and navigation entry points
- `components/`: Shared UI components such as the campus map, schedule calendar, and shuttle panels
- `services/`: API and authentication services
- `constants/`: Static app data and configuration values
- `utils/`: Parsing, geometry, and schedule helper utilities
- `__tests__/`: Jest test coverage for screens, services, components, and utilities

## Architecture Overview

The application is organized around a thin screen layer, reusable components, service adapters for external integrations, and utility modules for parsing and persistence.

### Runtime Flow

- `app/index.tsx` is the entry point for campus selection and navigation into the map and schedule screens.
- `app/CampusMapScreen.tsx` composes the map, route controls, shuttle UI, and next-class helpers.
- `components/CampusMap.tsx` renders campus geometry and requests route data from the directions service.
- `app/schedule.tsx` manages Google OAuth, pulls calendar events, parses them into schedule items, and caches them for later reuse.
- `utils/parseCourseEvents.ts` converts raw Google Calendar events into app-specific `ScheduleItem` records and persists them to local storage.

### Design Patterns Used in the Current Codebase

- Persistence pattern: `utils/parseCourseEvents.ts` exposes `saveSchedule`, `loadCachedSchedule`, and `getNextClass` as the contract for schedule persistence while hiding direct AsyncStorage details from callers.
- Strategy pattern: `services/Routing.ts` defines the `RouteStrategy` interface and `constants/strategies.ts` provides interchangeable implementations for walking, biking, driving, transit, and shuttle routing.
- Facade pattern: `services/GoogleDirectionsService.ts` hides URL construction, API key validation, response parsing, HTML cleanup, and polyline decoding behind `getOutdoorRoute` and `getOutdoorRouteWithSteps`.

### Planned Architecture from the Course Documentation

- Composite pattern: the architecture notes propose an indoor map hierarchy built from buildings, floors, rooms, and points of interest so search and filtering can operate uniformly across the tree.
- State pattern: the architecture notes also propose a navigation state machine for indoor, floor-transition, and outdoor states to avoid deeply nested screen logic during cross-building navigation.

These two planned patterns are documented in the project wiki for EPIC 4, but the corresponding indoor-navigation implementation is not present in this repository today.

## Technical Decisions

- Mobile framework: React Native with Expo was chosen to keep one codebase for Android and iOS while reducing development overhead.
- Map rendering: the current app uses `react-native-maps` for outdoor campus visualization, markers, polygons, and route polylines.
- Location services: `expo-location` is used for foreground permissions and current-location access.
- Outdoor directions: the app uses the Google Maps Directions API through `services/GoogleDirectionsService.ts`.
- Shuttle support: the shuttle option is modeled as a project-specific route strategy that combines walking legs with a shuttle leg between predefined Concordia shuttle stops.
- Calendar integration: Google Calendar API is the only calendar source currently wired into the application.
- Persistence: AsyncStorage is used for cached schedule data and small local state rather than a heavier embedded database.
- Backend: the current MVP works without a dedicated backend server for campus navigation and schedule caching.
- UI approach: the current repository uses custom React Native components and shared theme constants rather than a third-party UI component library.

## Release Summary

- Sprint 1 established the CI/CD pipeline, system architecture, personas, and UI design groundwork.
- Sprint 2 delivered the foundational map interface and visual identity work for the SGW and Loyola campuses. The documented velocity was 11 story points.
- Sprint 3 delivered the main wave of outdoor navigation work. The documented velocity was 19 story points.
- Sprint 4 delivered transportation-method support, shuttle-related work, and Google Calendar schedule functionality. The documented velocity was 49 story points.
- Sprint 5 and Sprint 6 are listed in the project wiki, but the material provided for this README did not include their detailed summaries.

## Troubleshooting

### Expo fails with a missing Android client ID

`app.config.js` currently throws an error if `EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID` is not set. Add the value to `.env` and restart Expo.

### Google sign-in opens but schedule import fails

Check the following:

- The Google Calendar API is enabled.
- The OAuth consent screen includes your account as a test user.
- The scope `https://www.googleapis.com/auth/calendar.readonly` is configured.
- The iOS bundle ID matches `com.concordia.snortingcode`.
- The Android package name and SHA-1 fingerprint match the build you are running.

### Google sign-in succeeds but no classes appear

Check the following:

- Your class schedule was exported to Google Calendar.
- The events exist in the `primary` calendar.
- The events fall within the configured semester range in `constants/semesterConfig.ts`.
- The event titles contain `LEC`, `TUT`, or `LAB`.

### `gradlew signingReport` fails

This usually points to a local JDK or Gradle mismatch. Fix the Java setup first, then rerun the command.

### Routes do not appear on the map

Make sure `EXPO_PUBLIC_GOOGLE_MAPS_API_KEY` is present and that the required Google Maps APIs are enabled in Google Cloud.

## Team

The project was developed by an 11-person software engineering team working across mobile development, UI and UX, architecture, and testing.

- Khalil Al Labban - 40282892
- Zachary Corber - 40246724
- Jessica Codreanu - 40262017
- Jingnan Wang - 40282296
- Philippe Nikolov - 40245641
- Clark Long - 40183902
- Yousef Bisharah - 40151411
- Nicholas Gallacher - 40248681
- Chris Egener - 40196182
- Nicolas Landry - 40263725
- Frew Weldemariam - 40036623
