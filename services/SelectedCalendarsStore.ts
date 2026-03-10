import AsyncStorage from "@react-native-async-storage/async-storage";

const SELECTED_CALENDARS_KEY = "selectedGoogleCalendars";

export async function getSelectedCalendarIds(): Promise<string[]> {
  try {
    const raw = await AsyncStorage.getItem(SELECTED_CALENDARS_KEY);
    if (!raw) return [];
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

export async function saveSelectedCalendarIds(ids: string[]): Promise<void> {
  await AsyncStorage.setItem(SELECTED_CALENDARS_KEY, JSON.stringify(ids));
}

export async function clearSelectedCalendarIds(): Promise<void> {
  await AsyncStorage.removeItem(SELECTED_CALENDARS_KEY);
}