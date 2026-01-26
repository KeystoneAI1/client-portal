import React from "react";
import { View, StyleSheet } from "react-native";
import { ThemedText } from "@/components/ThemedText";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius, Colors } from "@/constants/theme";

type StatusType =
  | "active"
  | "expired"
  | "pending"
  | "scheduled"
  | "in_progress"
  | "completed"
  | "cancelled"
  | "paid"
  | "overdue";

interface StatusBadgeProps {
  status: StatusType;
  size?: "small" | "medium";
}

const statusConfig: Record<
  StatusType,
  { label: string; lightBg: string; darkBg: string; lightText: string; darkText: string }
> = {
  active: {
    label: "Active",
    lightBg: Colors.light.success + "20",
    darkBg: Colors.dark.success + "30",
    lightText: Colors.light.success,
    darkText: Colors.dark.success,
  },
  expired: {
    label: "Expired",
    lightBg: Colors.light.error + "20",
    darkBg: Colors.dark.error + "30",
    lightText: Colors.light.error,
    darkText: Colors.dark.error,
  },
  pending: {
    label: "Pending",
    lightBg: Colors.light.warning + "20",
    darkBg: Colors.dark.warning + "30",
    lightText: Colors.light.warning,
    darkText: Colors.dark.warning,
  },
  scheduled: {
    label: "Scheduled",
    lightBg: Colors.light.primary + "20",
    darkBg: Colors.dark.primary + "30",
    lightText: Colors.light.primary,
    darkText: Colors.dark.primary,
  },
  in_progress: {
    label: "In Progress",
    lightBg: Colors.light.warning + "20",
    darkBg: Colors.dark.warning + "30",
    lightText: Colors.light.warning,
    darkText: Colors.dark.warning,
  },
  completed: {
    label: "Completed",
    lightBg: Colors.light.success + "20",
    darkBg: Colors.dark.success + "30",
    lightText: Colors.light.success,
    darkText: Colors.dark.success,
  },
  cancelled: {
    label: "Cancelled",
    lightBg: Colors.light.textSecondary + "20",
    darkBg: Colors.dark.textSecondary + "30",
    lightText: Colors.light.textSecondary,
    darkText: Colors.dark.textSecondary,
  },
  paid: {
    label: "Paid",
    lightBg: Colors.light.success + "20",
    darkBg: Colors.dark.success + "30",
    lightText: Colors.light.success,
    darkText: Colors.dark.success,
  },
  overdue: {
    label: "Overdue",
    lightBg: Colors.light.error + "20",
    darkBg: Colors.dark.error + "30",
    lightText: Colors.light.error,
    darkText: Colors.dark.error,
  },
};

export function StatusBadge({ status, size = "small" }: StatusBadgeProps) {
  const { isDark } = useTheme();
  const config = statusConfig[status];

  return (
    <View
      style={[
        styles.badge,
        size === "medium" && styles.badgeMedium,
        { backgroundColor: isDark ? config.darkBg : config.lightBg },
      ]}
    >
      <ThemedText
        type="small"
        style={[
          styles.text,
          size === "medium" && styles.textMedium,
          { color: isDark ? config.darkText : config.lightText },
        ]}
      >
        {config.label}
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.xs,
    alignSelf: "flex-start",
  },
  badgeMedium: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
  },
  text: {
    fontWeight: "600",
    fontSize: 11,
  },
  textMedium: {
    fontSize: 13,
  },
});
