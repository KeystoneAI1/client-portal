import React from "react";
import { View, StyleSheet, Pressable } from "react-native";
import { Feather } from "@expo/vector-icons";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from "react-native-reanimated";

import { ThemedText } from "@/components/ThemedText";
import { StatusBadge } from "@/components/StatusBadge";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius, Shadows } from "@/constants/theme";

interface SummaryCardProps {
  icon: keyof typeof Feather.glyphMap;
  title: string;
  subtitle: string;
  status?: "active" | "expired" | "pending" | "scheduled" | "completed";
  value?: string;
  onPress?: () => void;
  testID?: string;
}

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export function SummaryCard({
  icon,
  title,
  subtitle,
  status,
  value,
  onPress,
  testID,
}: SummaryCardProps) {
  const { theme } = useTheme();
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const handlePressIn = () => {
    scale.value = withSpring(0.98);
  };

  const handlePressOut = () => {
    scale.value = withSpring(1);
  };

  return (
    <AnimatedPressable
      onPress={onPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      style={[
        styles.container,
        { backgroundColor: theme.backgroundDefault },
        Shadows.small,
        animatedStyle,
      ]}
      testID={testID}
    >
      <View style={styles.header}>
        <View
          style={[styles.iconContainer, { backgroundColor: theme.primary + "15" }]}
        >
          <Feather name={icon} size={20} color={theme.primary} />
        </View>
        {status ? <StatusBadge status={status} /> : null}
        {value ? (
          <ThemedText type="h3" style={{ color: theme.primary }}>
            {value}
          </ThemedText>
        ) : null}
      </View>
      <ThemedText type="body" style={styles.title}>
        {title}
      </ThemedText>
      <ThemedText
        type="small"
        style={[styles.subtitle, { color: theme.textSecondary }]}
      >
        {subtitle}
      </ThemedText>
    </AnimatedPressable>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: Spacing.lg,
    borderRadius: BorderRadius.lg,
    marginBottom: Spacing.md,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: Spacing.md,
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: BorderRadius.sm,
    alignItems: "center",
    justifyContent: "center",
  },
  title: {
    fontWeight: "600",
    marginBottom: 2,
  },
  subtitle: {},
});
