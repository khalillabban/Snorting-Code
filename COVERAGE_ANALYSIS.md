# Code Coverage Gap Analysis

## Summary

This document identifies uncovered branches, error handling, conditional logic, and useEffect dependencies across key files with low-to-zero test coverage.

---

## 1. **tests**/\_layout.test.tsx - **0% Coverage (CRITICAL - NO TESTS)**

### Implementation: app/\_layout.tsx

**Uncovered Areas:**

#### A. Smartlook Initialization Try-Catch Block

```typescript
try {
  const Smartlook = require("react-native-smartlook-analytics").default;
  Smartlook.instance.preferences.setProjectKey(projectKey);
  Smartlook.instance.start();
} catch (error) {
  console.warn("Smartlook is not available in this build.", error);
}
```

- ❌ **Success path**: Module loads and starts without error
- ❌ **Failure path**: Module doesn't load or fails to start (catch block)
- ❌ **Error logging**: console.warn is called with error

#### B. Environment Checks

```typescript
const projectKey = process.env.EXPO_PUBLIC_SMARTLOOK_PROJECT_KEY;
if (!projectKey) {
  return;
}
if (Constants.executionEnvironment === "storeClient") {
  return;
}
```

- ❌ **No projectKey**: Early return when env var is undefined
- ❌ **storeClient environment**: Early return when building for store
- ❌ **Both conditions False**: Proceeds to Smartlook setup

#### C. useEffect Dependency & Lifecycle

- ❌ **Effect runs on mount**: Empty dependency array `[]` behavior
- ❌ **Initial render**: Component renders with Stack before effect runs
- ❌ **Unmount cleanup**: No cleanup needed but should test component lifecycle

### Missing Test Cases:

1. **Test: "initializes Smartlook when projectKey exists and not in storeClient"**
   - Mock `process.env.EXPO_PUBLIC_SMARTLOOK_PROJECT_KEY`
   - Mock `Constants.executionEnvironment` to be "bare"
   - Verify Smartlook.instance.start() is called

2. **Test: "skips Smartlook initialization when projectKey is undefined"**
   - No projectKey set
   - Verify require() and Smartlook methods are NOT called

3. **Test: "skips Smartlook initialization when executionEnvironment is storeClient"**
   - Set projectKey
   - Mock `Constants.executionEnvironment` as "storeClient"
   - Verify methods NOT called

4. **Test: "logs warning when Smartlook initialization fails"**
   - Mock require() to throw error
   - Verify console.warn is called with error

5. **Test: "renders Stack navigation with correct header options"**
   - Verify Stack is rendered with proper screenOptions
   - Colors and styling applied correctly

---

## 2. IndoorMapScreen.tsx - **76.34% Coverage (14 missing, 8 partials)**

### Implementation Analysis

#### A. Error Handling Branches

**Issue 1: `performRoomSearch` error path when `normalizedBuildingPlan` is null**

```typescript
if (!normalizedBuildingPlan) {
  setSelectedRoom(null);
  setSearchError(`Room search is not available for ${buildingName}.`);
  return; // ❌ NOT TESTED
}
```

- Test exists for when room not found, but NOT when building plan is null
- Fallback for invalid building code
- Should test with `buildingName` = undefined or unmapped value

**Issue 2: `getFloorImageDimensions` fallback logic**

```typescript
width: floorImageMetadata?.width ??
  Math.max(1200, ...currentFloorRooms.map((room) => room.x + 80)),
```

- ❌ Fallback when `floorImageMetadata?.width` is null/undefined
- ❌ Max calculation with empty rooms array edge case

**Issue 3: `getFloorContentBounds` when currentFloorRooms is empty**

```typescript
if (currentFloorRooms.length === 0) {
  return {
    minX: 0,
    minY: 0,
    maxX: floorImageDimensions.width,
    maxY: floorImageDimensions.height,
  }; // ❌ BRANCH NOT EXPLICITLY TESTED
}
```

- Current tests don't explicitly verify this empty rooms path

#### B. ConditionalBranches

**Issue 4: Room on different floor vs same floor**

```typescript
const selectedRoomOnCurrentFloor = useMemo(() => {
  if (!selectedRoom || selectedRoom.floor !== selectedFloor) return null; // ❌ PARTIAL
  return {
    ...selectedRoom,
    x: selectedRoom.x * coordinateScale,
    y: selectedRoom.y * coordinateScale,
  };
}, [coordinateScale, selectedFloor, selectedRoom]);
```

- ✅ Room on different floor is tested
- ❌ Behavior when room coordinate scaling happens not fully verified
- ❌ coordinateScale edge cases (0, very large values)

**Issue 5: Navigation attempt without building name**

```typescript
const handleNavigate = useCallback(async () => {
  if (!buildingName) return;  // ❌ NOT TESTED - returns early
  // ... rest of logic
```

- No test for calling handleNavigate with undefined buildingName

**Issue 6: Room search query normalization**

```typescript
const initialRoomQuery = trimParam(roomQuery);

function trimParam(val: unknown): string {
  return typeof val === "string" ? val.trim() : ""; // ❌ Non-string PARTIAL COVERAGE
}
```

- Tests don't check behavior when roomQuery is null, number, or object

#### C. useEffect Dependencies

**Issue 7: `useInitialRoomQuery` effect timing**

```typescript
useEffect(() => {
  if (!initialRoomQuery) return;
  setSearchQuery(initialRoomQuery);
  performRoomSearch(initialRoomQuery, availableFloors[0] || 1);
}, [availableFloors, initialRoomQuery, performRoomSearch, setSearchQuery]);
```

- ❌ Not tested: Effect doesn't run when initialRoomQuery is empty
- ❌ Not tested: Effect reruns when availableFloors change
- ❌ Partial: performRoomSearch is available but its errors not caught

**Issue 8: `useFloorSync` floor validation**

```typescript
useEffect(() => {
  if (availableFloors.length > 0 && !availableFloors.includes(selectedFloor)) {
    setSelectedFloor(availableFloors[0] || 1);
  }
}, [availableFloors, selectedFloor, setSelectedFloor]);
```

- ✅ Test exists for floor reset when invalid
- ❌ Not tested: availableFloors becomes empty array after having floors
- ❌ Not tested: selectedFloor never changes when it's already valid

**Issue 9: `useNavAutoTrigger` async navigation**

```typescript
useEffect(() => {
  if (buildingName && trimParam(navOrigin) && trimParam(navDest)) {
    handleNavigate();
  }
}, []); // ❌ Empty dependency array - runs once on mount
```

- ❌ Not tested: Effect with empty deps should run once
- ❌ Not tested: handleNavigate called from effect catch blocks not tested
- Errors from handleNavigate not handled (async without await)

#### D. Analytics/Logging Branches

**Issue 10: POI filtering analytics**

```typescript
logUsabilityEvent("indoor_poi_category_toggled", {...}).catch((error) => {
  console.error("Firebase Analytics Error: ", error);  // ❌ NOT TESTED
});
```

- ❌ logUsabilityEvent error case not caught in tests
- ❌ console.error calls in catch blocks never tested

### Missing Test Cases:

1. **Test: "handles room search when building plan is not available"**
2. **Test: "uses fallback dimensions when floor image metadata is missing"**
3. **Test: "handles empty rooms array in floor bounds calculation"**
4. **Test: "doesn't show marker when room is on different floor"**
5. **Test: "doesn't navigate when buildingName is undefined"**
6. **Test: "handles roomQuery as non-string value"**
7. **Test: "auto-trigger navigation doesn't run when dependencies present but empty"**
8. **Test: "handles floor change when availableFloors becomes empty"**
9. **Test: "logs analytics errors gracefully"**
10. **Test: "coordinates scaling with zero or extreme values"**

---

## 3. CampusMapScreen.tsx - **81.48% Coverage (15 missing, 5 partials)**

### Implementation Analysis

#### A. Error Handling Branches

**Issue 1: Location permission failure**

```typescript
const getUserBuilding = async () => {
  const { status } = await Location.requestForegroundPermissionsAsync();
  if (status !== "granted") return; // ❌ NOT TESTED - permission denied
  // ... rest of logic
};
```

- ❌ Permission denied case never tested
- ❌ `findNearestBuilding` logic skipped when permission denied
- ❌ `autoStartBuilding` stays null when permission denied

**Issue 2: Location coordinates edge cases**

```typescript
const { latitude, longitude } = loc.coords;
const building = findNearestBuilding(latitude, longitude);
```

- ❌ Never tested: findNearestBuilding with null/invalid coordinates
- ❌ Never tested: Building distance calculation with extreme values

**Issue 3: `findNearestBuilding` filtering by bounding box**

```typescript
for (const b of BUILDINGS) {
  if (!b.boundingBox || b.boundingBox.length < 3) continue; // ❌ BRANCH NOT TESTED
  const d = getDistanceToPolygon(userPoint, b.boundingBox);
  if (d < minDist) {
    minDist = d;
    nearest = b;
  }
}
```

- ✅ Tests mock buildings with valid bounding boxes
- ❌ Never tested: Building with null/invalid boundingBox (skipped)
- ❌ Never tested: All buildings have invalid bounding boxes (default to BUILDINGS[0])

**Issue 4: Route generation error handling**

```typescript
const handleConfirmRoute = useCallback(
  async (
    start: Buildings | null,
    dest: Buildings | null,
    strategy: RouteStrategy,
    startRoom?: IndoorRoomRecord | null,
    endRoom?: IndoorRoomRecord | null,
    accessible?: boolean,
  ): Promise<void> => {
    setAccessibleOnly(!!accessible);

    if (start?.name && dest?.name && start.name === dest.name && startRoom && endRoom) {
      setIsNavVisible(false);
      openIndoorMap(...);
      return;  // ✅ Tested
    }

    if (start?.name && dest?.name && start.name === dest.name && endRoom) {
      setIsNavVisible(false);
      openIndoorMap(...);
      return;  // ✅ Tested
    }

    setSelectedRoute({ start, dest });  // ❌ When NONE of the above conditions match
```

- ❌ When `start?.name !== dest?.name` (cross-building route), logic continues
- ❌ When start or dest is null but route still needs handling
- ❌ Errors from logUsabilityEvent not handled

#### B. Conditional Branches

**Issue 5: Campus selection state sync**

```typescript
useEffect(() => {
  const campusValue = campus === "loyola" ? "loyola" : "sgw";
  setCurrentCampus(campusValue);
  setFocusTarget((prev) => {
    if (prev === "user") return prev; // ❌ PARTIAL - stays as "user"
    return campusValue;
  });
}, [campus]);
```

- ✅ When prev is "user" it doesn't change
- ❌ Never tested: campusValue changes while focusTarget is "user"
- ❌ Never tested: campus param undefined behavior detailed

**Issue 6: Shuttle status availability checks**

```typescript
useEffect(() => {
  if (!shuttleStatus.available && showShuttle) setShowShuttle(false);
}, [shuttleStatus.available, showShuttle]);
```

- ❌ Never tested: shuttleStatus.available becomes false mid-session
- ❌ Never tested: No cleanup when component unmounts

**Issue 7: Indoor access filtering**

```typescript
const nextClassIndoorAccess = useMemo(
  () => getIndoorAccessState(nextClass?.building),
  [nextClass?.building],
);
const canOpenNextClassIndoorMap = Boolean(
  nextClassIndoorAccess.hasSearchableRooms && nextClass?.room.trim(), // ❌ PARTIAL
);
```

- ✅ Basic boolean logic tested
- ❌ Never tested: When nextClass is null (early return)
- ❌ Never tested: When nextClass.room is whitespace only
- ❌ Never tested: When getIndoorAccessState returns false

#### C. useEffect Dependencies & Async Issues

**Issue 8: Initial campus loading**

```typescript
useEffect(() => {
  loadCachedSchedule()
    .then((items) => {
      if (items) setScheduleItems(items);
    })
    .catch(() => {
      setScheduleItems([]); // ❌ Catch-all with no error logging
    });
}, []);
```

- ❌ Never tested: loadCachedSchedule rejection path
- ❌ Never tested: loadCachedSchedule returns null
- ❌ Never tested: Race condition if component unmounts during load

**Issue 9: User location detection race condition**

```typescript
useEffect(() => {
  const getUserBuilding = async () => {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== "granted") return; // ❌ Permission denied
    const loc = await Location.getCurrentPositionAsync({});
    // ...
  };
  getUserBuilding();
}, [findNearestBuilding]);
```

- ⚠️ `findNearestBuilding` dependency changes every render (recreated in useCallback)
- ❌ Never tested: Location.getCurrentPositionAsync throws error
- ❌ Never tested: getUserBuilding called multiple times if dependency changes

#### D. Accessibility Label Branches

**Issue 10: Shuttle button label logic**

```typescript
let accessibilityLabel: string;
if (!shuttleStatus.available) {
  accessibilityLabel = "Shuttle not available";
} else if (showShuttle) {
  accessibilityLabel = "Hide shuttle";
} else {
  accessibilityLabel = "Show shuttle"; // ❌ PARTIAL
}
```

- ❌ Never explicitly tested: All three branches with different states
- ❌ Never tested: Rapid shuttle toggles with different statuses

### Missing Test Cases:

1. **Test: "logs analytics error when permission denied for location"**
2. **Test: "handles location request rejection gracefully"**
3. **Test: "uses first building as default when all have invalid bounding boxes"**
4. **Test: "finds nearest building with valid bounding box when others invalid"**
5. **Test: "doesn't show shuttle button when status.available is false"**
6. **Test: "handles loadCachedSchedule rejection"**
7. **Test: "handles Location.getCurrentPositionAsync error"**
8. **Test: "sets accessibility label for each shuttle state correctly"**
9. **Test: "prevents indoor map open when room has only whitespace"**
10. **Test: "handles rapid campus switching"**
11. **Test: "unsets focusTarget from 'user' when campus changes"**

---

## 4. schedule.tsx - **87.95% Coverage (4 missing, 6 partials)**

### Implementation Analysis

#### A. Error Handling Branches

**Issue 1: Stale cache sync 410 error with retry**

```typescript
try {
  await runSync(
    useIncremental ? (cachedEntry?.syncToken ?? undefined) : undefined,
  );
} catch (error) {
  if (
    error instanceof GoogleCalendarApiError &&
    error.status === 410 && // ❌ PARTIAL - specific error condition
    !force
  ) {
    await clearCachedGoogleCalendarEvents(calendarId);
    await runSync(); // Retry without sync token
    return;
  }
  throw error;
}
```

- ✅ Some error path tested
- ❌ Never tested: Exactly when status === 410 and !force (retry path)
- ❌ Never tested: When status === 410 but force === true (doesn't retry)
- ❌ Never tested: Other GoogleCalendarApiError statuses

**Issue 2: Race condition with requestId tracking**

```typescript
const syncAndRefresh = useCallback(
  async (
    token: string,
    calendarIds: string[],
    calendarIdsToSync: string[],
    force: boolean,
    requestId: number,
  ) => {
    await Promise.all(
      calendarIdsToSync.map((calendarId) =>
        syncSingleCalendar(token, calendarId, force),
      ),
    );
    if (scheduleSyncRequestRef.current !== requestId) return;  // ❌ Race check
    // ...
  },
```

- ❌ Never tested: requestId mismatch (newer request supersedes older)
- ❌ Never tested: Rapid sync requests with cancellation
- ❌ Never tested: What happens if sync succeeds after requestId check fails

#### B. Conditional Branches

**Issue 3: Calendar selection auto-default logic**

```typescript
const shouldAutoSelect =
  accessToken &&
  shouldAutoSelectDefaultRef.current &&
  visibleCalendars.length > 0; // ❌ PARTIAL
if (!shouldAutoSelect) return;
```

- ✅ Test exists for auto-select with primary calendar
- ❌ Never tested: accessToken is null (no auto-select)
- ❌ Never tested: shouldAutoSelectDefaultRef.current is false (no auto-select)
- ❌ Never tested: visibleCalendars.length === 0 (no auto-select)

**Issue 4: Token expiration check**

```typescript
async function resolveAccessToken(
  saved: Awaited<ReturnType<typeof getGoogleAccessToken>>,
): Promise<string | null> {
  if (!saved.accessToken || !isTokenLikelyExpired(saved.meta))
    // ❌ PARTIAL
    return saved.accessToken;
  await deleteGoogleAccessToken();
  return null;
}
```

- ❌ Never tested: saved.accessToken is null/undefined
- ❌ Never tested: isTokenLikelyExpired returns false (token still valid)
- ❌ Never tested: isTokenLikelyExpired returns true (token expired)

**Issue 5: Event deduplication with cancelled events**

```typescript
function buildScheduleItems(
  events: GoogleCalendarEvent[],
  rangeStart: Date,
  rangeEnd: Date,
): ScheduleItem[] {
  const deduped = new Map<string, GoogleCalendarEvent>();
  for (const event of events) {
    if (event.status === "cancelled") continue;  // ❌ PARTIAL
    if (!eventOverlapsRange(event, rangeStart, rangeEnd)) continue;  // ❌ PARTIAL
    const key = getEventDedupKey(event);
    if (!key) continue;  // ❌ PARTIAL
    deduped.set(key, event);
  }
```

- ✅ Test exists for cancelled events
- ❌ Never tested: eventOverlapsRange with events at range boundaries
- ❌ Never tested: getEventDedupKey returning null (no key)
- ❌ Never tested: Duplicate events with same key (overwrites)

#### C. useEffect Dependencies

**Issue 6: AppState listener setup**

```typescript
useEffect(() => {
  const handleURL = ({ url }: { url: string }) => {
    if (url.includes("oauthredirect")) WebBrowser.maybeCompleteAuthSession();
  };
  const subscription = Linking.addEventListener("url", handleURL);
  Linking.getInitialURL().then((url) => {
    if (url?.includes("oauthredirect")) WebBrowser.maybeCompleteAuthSession();
  });
  return () => subscription.remove(); // ✅ Cleanup
}, []);
```

- ✅ Cleanup function exists
- ❌ Never tested: getInitialURL throws error
- ❌ Never tested: subscription.remove() called on unmount
- ❌ Never tested: Both getInitialURL and addEventListener fired simultaneously

**Issue 7: Schedule initialization cleanup**

```typescript
useEffect(() => {
  const cancelledRef = { current: false };
  initializeSchedule(cancelledRef);
  return () => {
    cancelledRef.current = true; // ✅ Cleanup
  };
}, [initializeSchedule]);
```

- ✅ Cleanup sets cancelled flag
- ❌ Never tested: Cancelled cleanup while async work in progress
- ❌ Never tested: Component remount triggers new initialization

**Issue 8: Response handler race condition**

```typescript
useEffect(() => {
  const run = async () => {
    const res = getResultFromResponse();
    if (!res) return;

    if (!res.ok) {
      if (res.reason === "cancelled") {
        // ...
        if (ui.status === "ready" || ui.status === "empty") return;
        setUi({ status: "idle" });
        return; // ❌ Early exit path
      }
      // ...
    }
    // ... success path
  };
  run();
}, [getResultFromResponse, ui.status, request]);
```

- ❌ Never tested: Multiple concurrent calls to run()
- ❌ Never tested: res.ok === false but reason !== "cancelled"
- ❌ Never tested: ui.status changes before run() executes

### Missing Test Cases:

1. **Test: "retries sync without token on 410 error when not force"**
2. **Test: "doesn't retry sync on 410 error when force is true"**
3. **Test: "cancels previous sync request when new request comes in"**
4. **Test: "doesn't auto-select calendars when accessToken is null"**
5. **Test: "doesn't auto-select calendars when visibleCalendars is empty"**
6. **Test: "returns null token when isTokenLikelyExpired is true"**
7. **Test: "filters out events with no dedup key"**
8. **Test: "handles getInitialURL error gracefully"**
9. **Test: "cleans up listeners on unmount"**
10. **Test: "cancels initialization if component unmounts during async work"**

---

## 5. usabilityAnalytics.ts - **60% Coverage (2 missing)**

### Implementation Analysis

```typescript
export async function logUsabilityEvent(
  eventName: string,
  params: Record<string, unknown> = {},
): Promise<void> {
  if (!USABILITY_TESTING_ENABLED) return; // ❌ Early return not tested
  try {
    const analytics = require("@react-native-firebase/analytics").default;
    await analytics().logEvent(eventName, params); // ✅ Path exists
  } catch (e) {} // ❌ Error suppression - empty catch
}
```

#### A. Uncovered Branches:

**Issue 1: Early return when not enabled**

- ❌ Never tested: USABILITY_TESTING_ENABLED is false
- ❌ Never tested: Function returns early without calling Firebase
- ❌ Never tested: Promise doesn't resolve when disabled

**Issue 2: Error suppression in catch block**

- ❌ Never tested: Firebase throws error (network, permission, etc.)
- ❌ Never tested: require() throws error when analytics package missing
- ❌ Never tested: analytics().logEvent() throws error
- ❌ Never tested: Error is silently caught (intentional but untested)

### Missing Test Cases:

1. **Test: "returns without calling Firebase when USABILITY_TESTING_ENABLED is false"**
   - Mock USABILITY_TESTING_ENABLED = false
   - Verify function returns without calling require() or logEvent()

2. **Test: "logs event when USABILITY_TESTING_ENABLED is true"**
   - Mock USABILITY_TESTING_ENABLED = true
   - Mock analytics().logEvent()
   - Verify called with correct parameters

3. **Test: "silently catches Firebase errors"**
   - Mock analytics().logEvent() to throw error
   - Verify function completes without throwing
   - Verify no error is re-thrown

4. **Test: "silently catches require error when Firebase not available"**
   - Mock require() to throw error
   - Verify function completes without throwing

---

## Summary Table

| File                  | Coverage | Missing | Partials | Critical Gaps                                     |
| --------------------- | -------- | ------- | -------- | ------------------------------------------------- |
| \_layout.tsx          | 0%       | 11      | 0        | ✅ NO TESTS, Smartlook init untested              |
| IndoorMapScreen.tsx   | 76.34%   | 14      | 8        | Async error handling, room search failures        |
| CampusMapScreen.tsx   | 81.48%   | 15      | 5        | Location permission errors, coordinate edge cases |
| schedule.tsx          | 87.95%   | 4       | 6        | 410 retry logic, race conditions, token expiry    |
| usabilityAnalytics.ts | 60%      | 2       | 0        | Feature flag branch, error suppression            |

---

## Recommendations by Priority

### P0 (Critical)

1. **Create \_layout.test.tsx** - 0% coverage, file has error handling and env checks
2. Add error path tests to **IndoorMapScreen.test.tsx** - room search failures, navigation errors
3. Add permission error tests to **CampusMapScreen.test.tsx** - location request failures

### P1 (High Impact)

1. Add 410 retry logic test to **Schedule.test.tsx**
2. Add race condition/cancellation tests to **schedule.tsx**
3. Add feature flag and error suppression tests to **usabilityAnalytics.ts**

### P2 (Medium)

1. Add coordinate scaling edge cases to IndoorMapScreen tests
2. Add bounding box filtering edge cases to CampusMapScreen tests
3. Add token expiration path tests to schedule tests
