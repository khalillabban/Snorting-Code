import { MaterialCommunityIcons } from "@expo/vector-icons";
import React, { useMemo } from "react";
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { borderRadius, spacing, typography } from "../constants/theme";
import { useColorAccessibility } from "../contexts/ColorAccessibilityContext";

function createStyles(colors: ReturnType<typeof useColorAccessibility>["colors"]) {
  return StyleSheet.create({
    backdrop: {
      flex: 1,
      backgroundColor: "rgba(0,0,0,0.45)",
      justifyContent: "flex-end",
    },
    sheet: {
      backgroundColor: colors.white,
      borderTopLeftRadius: 24,
      borderTopRightRadius: 24,
      paddingTop: spacing.sm,
      paddingBottom: spacing.lg,
      paddingHorizontal: spacing.md,
      maxHeight: "82%",
    },
    handle: {
      alignSelf: "center",
      width: 48,
      height: 5,
      borderRadius: 999,
      backgroundColor: colors.gray100,
      marginBottom: spacing.sm,
    },
    header: {
      gap: 6,
      marginBottom: spacing.md,
    },
    title: {
      ...typography.heading,
      color: colors.primaryDark,
    },
    subtitle: {
      ...typography.body,
      color: colors.gray700,
    },
    list: {
      gap: spacing.sm,
    },
    option: {
      borderRadius: borderRadius.lg,
      borderWidth: 1,
      borderColor: colors.gray100,
      padding: spacing.md,
      backgroundColor: colors.offWhite,
      flexDirection: "row",
      alignItems: "flex-start",
      gap: spacing.sm,
    },
    optionSelected: {
      borderColor: colors.primary,
      backgroundColor: colors.primaryTransparent,
    },
    optionCopy: {
      flex: 1,
      gap: 3,
    },
    optionLabelRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
    },
    optionLabel: {
      ...typography.button,
      color: colors.primaryDark,
      flexShrink: 1,
    },
    optionDescription: {
      ...typography.body,
      color: colors.gray700,
      lineHeight: 19,
    },
    footer: {
      marginTop: spacing.md,
      flexDirection: "row",
      justifyContent: "flex-end",
    },
    closeButton: {
      paddingHorizontal: spacing.lg,
      paddingVertical: 12,
      borderRadius: borderRadius.md,
      backgroundColor: colors.primary,
    },
    closeText: {
      ...typography.button,
      color: colors.white,
    },
    checkIcon: {
      marginTop: 2,
    },
  });
}

type ColorAccessibilitySettingsModalProps = {
  visible: boolean;
  onClose: () => void;
};

export function ColorAccessibilitySettingsModal({
  visible,
  onClose,
}: Readonly<ColorAccessibilitySettingsModalProps>) {
  const { mode, colors, options, setMode } = useColorAccessibility();
  const styles = useMemo(() => createStyles(colors), [colors]);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <Pressable testID="color-settings-backdrop" style={styles.backdrop} onPress={onClose}>
        <Pressable testID="color-settings-sheet" style={styles.sheet} onPress={(event) => event.stopPropagation()}>
          <View style={styles.handle} />
          <View style={styles.header}>
            <Text style={styles.title}>Color accessibility</Text>
            <Text style={styles.subtitle}>
              Pick the palette that is easiest to read. The choice is saved on this device.
            </Text>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.list} testID="color-options-list">
            {options.map((option) => {
              const selected = option.value === mode;
              return (
                <Pressable
                  key={option.value}
                  testID={`color-option-${option.value}`}
                  style={[styles.option, selected && styles.optionSelected]}
                  onPress={() => setMode(option.value)}
                  accessibilityRole="radio"
                  accessibilityState={{ selected }}
                  accessibilityLabel={option.label}
                >
                  <View style={styles.optionCopy}>
                    <View style={styles.optionLabelRow}>
                      <Text style={styles.optionLabel}>{option.label}</Text>
                      {selected ? (
                        <MaterialCommunityIcons
                          name="check-circle"
                          size={20}
                          color={colors.primary}
                          style={styles.checkIcon}
                        />
                      ) : null}
                    </View>
                    <Text style={styles.optionDescription}>{option.description}</Text>
                  </View>
                </Pressable>
              );
            })}
          </ScrollView>

          <View style={styles.footer}>
            <Pressable style={styles.closeButton} onPress={onClose} testID="color-settings-done-button" accessibilityRole="button" accessibilityLabel="Close color accessibility settings">
              <Text style={styles.closeText}>Done</Text>
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
