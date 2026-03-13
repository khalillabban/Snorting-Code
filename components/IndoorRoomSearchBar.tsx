import React from "react";
import { StyleSheet, Text, TextInput, View } from "react-native";
import { colors, spacing, typography } from "../constants/theme";
import type {
  IndoorRoomSearchQueryMode,
} from "../hooks/useIndoorRoomSearch";

export type IndoorRoomSearchBarProps = Readonly<{
  value: string;
  mode?: IndoorRoomSearchQueryMode;
  placeholder?: string;
  errorMessage?: string | null;
  isSearching?: boolean;
  onChangeText?: (next: string) => void;
  onSubmit?: () => void;
}>;

/**
 * Skeleton search bar for US-4.4 room lookup.
 *
 * This component intentionally keeps layout and basic styling only.
 * Parent screens are expected to:
 * - Control the `value` and `onChangeText`.
 * - Call `onSubmit` to trigger a search.
 * - Pass through any validation or "room not found" messages.
 */
export function IndoorRoomSearchBar({
  value,
  mode = "auto",
  placeholder = "Search room by number or name",
  errorMessage,
  isSearching = false,
  onChangeText,
  onSubmit,
}: IndoorRoomSearchBarProps) {
  const helperText =
    mode === "number"
      ? "Search by room number (e.g. H837)."
      : mode === "name"
        ? "Search by room name (e.g. Computer Lab)."
        : "Search by room number or name.";

  return (
    <View style={styles.container}>
      <Text style={styles.label}>Find a specific room</Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        onSubmitEditing={onSubmit}
        placeholder={placeholder}
        autoCorrect={false}
        autoCapitalize="none"
        style={styles.input}
        testID="indoor-room-search-input"
        returnKeyType="search"
        editable={!isSearching}
      />
      <Text style={styles.helperText}>
        {isSearching ? "Searching…" : helperText}
      </Text>
      {!!errorMessage && (
        <Text style={styles.errorText}>{errorMessage}</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: colors.offWhite,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.gray300,
    gap: spacing.xs,
  },
  label: {
    fontSize: typography.body.fontSize,
    fontWeight: typography.body.fontWeight,
    color: colors.secondaryDark,
  },
  input: {
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.gray300,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    backgroundColor: colors.white,
    fontSize: typography.body.fontSize,
  },
  helperText: {
    fontSize: typography.caption.fontSize,
    color: colors.gray500,
  },
  errorText: {
    fontSize: typography.caption.fontSize,
    color: colors.error,
  },
});

export default IndoorRoomSearchBar;

