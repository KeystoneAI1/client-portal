import React from "react";
import { View, StyleSheet, Pressable } from "react-native";
import { Feather } from "@expo/vector-icons";
import { ThemedText } from "@/components/ThemedText";
import { useTheme } from "@/hooks/useTheme";
import { Spacing } from "@/constants/theme";

interface SectionHeaderProps {
  title: string;
  actionLabel?: string;
  onAction?: () => void;
}

export function SectionHeader({
  title,
  actionLabel,
  onAction,
}: SectionHeaderProps) {
  const { theme } = useTheme();

  return (
    <View style={styles.container}>
      <ThemedText type="h4">{title}</ThemedText>
      {actionLabel && onAction ? (
        <Pressable onPress={onAction} style={styles.action}>
          <ThemedText type="body" style={{ color: theme.primary }}>
            {actionLabel}
          </ThemedText>
          <Feather
            name="chevron-right"
            size={16}
            color={theme.primary}
            style={styles.chevron}
          />
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: Spacing.md,
    marginTop: Spacing.lg,
  },
  action: {
    flexDirection: "row",
    alignItems: "center",
  },
  chevron: {
    marginLeft: 2,
  },
});
