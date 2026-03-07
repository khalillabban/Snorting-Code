# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
# Start dev server
npm start

# Run on simulator/device
npm run ios
npm run android

# Lint
npm run lint

# Run all tests
npm test

# Run a single test file
npm test -- --testPathPattern=CampusMap

# Run tests with coverage
npm test -- --coverage
```

## Environment Variables

Create a `.env` file at the root with:

```
EXPO_PUBLIC_GOOGLE_MAPS_API_KEY=...
EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID=...
EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID=...
EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID=...   # optional
```

`app.config.js` reads these at build time and will throw if `EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID` is missing.

## Architecture

This is a **React Native / Expo** app (SDK 54) using **Expo Router** for file-based routing. It is a campus navigation app for Concordia University (SGW and Loyola campuses).

### Screens (`app/`)

| File | Route | Purpose |
|------|-------|---------|
| `index.tsx` | `/` | Home — campus selector |
| `CampusMapScreen.tsx` | `/CampusMapScreen` | Main map + navigation UI |
| `schedule.tsx` | `/schedule` | Google Calendar schedule viewer |
| `oauthredirect.tsx` | `/oauthredirect` | OAuth deep-link callback |

### Component layer (`components/`)

- `CampusMap` — wraps `react-native-maps`, renders building polygons, active route polyline, and shuttle bus marker
- `NavigationBar` — bottom sheet for selecting start/destination buildings and transport strategy
- `DirectionStepsPanel` — shows turn-by-turn steps for an active route
- `ShuttleBusTracker` — polls the shuttle position
- `ShuttleSchedulePanel` — displays the shuttle timetable
- `ScheduleCalendar` — renders a weekly calendar grid from parsed `ScheduleItem[]`

### Service layer (`services/`)

- `GoogleDirectionsService.ts` — calls the Google Directions API; handles all `TransportMode` values including `shuttle` (which chains walk→drive→walk)
- `GoogleCalendarService.ts` — fetches calendar events for a date range using an access token
- `GoogleAuthService.ts` — `useGoogleCalendarAuth` hook wrapping `expo-auth-session`
- `TokenStore.ts` — persists the Google OAuth access token in `expo-secure-store`
- `Routing.ts` — defines the `RouteStrategy` interface and `TransportMode` type

### Constants (`constants/`)

- `type.ts` — shared TypeScript interfaces (`Buildings`, `Location`, `RouteStep`, `ScheduleItem`, etc.)
- `buildings.ts` — `BUILDINGS` array with coordinates, bounding polygons, departments, and services for every campus building
- `campuses.ts` — `CAMPUSES` record keyed by `CampusKey` (`"sgw" | "loyola"`)
- `strategies.ts` — pre-built `RouteStrategy` objects (`WALKING_STRATEGY`, `SHUTTLE_STRATEGY`, `ALL_STRATEGIES`, …)
- `shuttle.ts` — `BUSSTOP` array (two stops, one per campus)
- `semesterConfig.ts` — `SEMESTER_START` / `SEMESTER_END` dates used by the schedule screen
- `theme.ts` — `colors`, `spacing`, `typography`, `borderRadius` design tokens

### Utils (`utils/`)

- `pointInPolygon.ts` — `getDistanceToPolygon` used to find the nearest building to the user's GPS position
- `parseCourseEvents.ts` — transforms raw Google Calendar events into `ScheduleItem[]`; also handles AsyncStorage persistence and `getNextClass()`
- `shuttleAvailability.ts` — pure logic for determining if the shuttle runs at a given time

### Hooks (`hooks/`)

- `useShuttleAvailability.ts` — React hook that watches the current time and campus to expose shuttle availability state

### Tests (`__tests__/`)

All test files live in `__tests__/` and use `jest-expo` + `@testing-library/react-native`. The jest config maps `utils/*` and `constants/*` module aliases.

### Data flow for directions

`CampusMapScreen` holds route state → user picks buildings + strategy in `NavigationBar` → `handleConfirmRoute` sets `selectedRoute` + `selectedStrategy` → `CampusMap` calls `getOutdoorRouteWithSteps` from `GoogleDirectionsService` → polyline and `RouteStep[]` are lifted back up via `onRouteSteps` → `DirectionStepsPanel` displays them.

### Schedule data flow

`schedule.tsx` calls `useGoogleCalendarAuth` → user taps "Connect Google Calendar" → OAuth flow → access token stored via `TokenStore` → `fetchCalendarEventsInRange` fetches events → `parseCourseEvents` filters to `LEC/TUT/LAB` events and maps to `ScheduleItem[]` → saved to `AsyncStorage` → displayed in `ScheduleCalendar`.
