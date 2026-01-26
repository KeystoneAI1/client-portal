import React, { useState, useEffect } from "react";
import { View, StyleSheet, ScrollView } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHeaderHeight } from "@react-navigation/elements";
import { useRoute, RouteProp } from "@react-navigation/native";
import { Feather } from "@expo/vector-icons";

import { ThemedText } from "@/components/ThemedText";
import { StatusBadge } from "@/components/StatusBadge";
import { LoadingSpinner } from "@/components/LoadingSpinner";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius, Shadows } from "@/constants/theme";
import { storage, ServicePlan, Appliance } from "@/lib/storage";
import { RootStackParamList } from "@/navigation/RootStackNavigator";

type RouteProps = RouteProp<RootStackParamList, "ServicePlanDetail">;

export default function ServicePlanDetailScreen() {
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const { theme } = useTheme();
  const route = useRoute<RouteProps>();
  const { planId } = route.params;

  const [plan, setPlan] = useState<ServicePlan | null>(null);
  const [appliances, setAppliances] = useState<Appliance[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, [planId]);

  const loadData = async () => {
    const [plans, allAppliances] = await Promise.all([
      storage.getServicePlans(),
      storage.getAppliances(),
    ]);

    const foundPlan = plans.find((p) => p.id === planId);
    setPlan(foundPlan || null);

    if (foundPlan) {
      const coveredAppliances = allAppliances.filter((a) =>
        foundPlan.applianceIds.includes(a.id),
      );
      setAppliances(coveredAppliances);
    }

    setIsLoading(false);
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString("en-GB", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  };

  const getApplianceIcon = (type: Appliance["type"]): keyof typeof Feather.glyphMap => {
    switch (type) {
      case "boiler":
        return "thermometer";
      case "heating":
        return "sun";
      case "electrical":
        return "zap";
      case "plumbing":
        return "droplet";
      default:
        return "box";
    }
  };

  if (isLoading) {
    return (
      <View
        style={[
          styles.container,
          { backgroundColor: theme.backgroundRoot, paddingTop: headerHeight },
        ]}
      >
        <LoadingSpinner />
      </View>
    );
  }

  if (!plan) {
    return (
      <View
        style={[
          styles.container,
          styles.centered,
          { backgroundColor: theme.backgroundRoot, paddingTop: headerHeight },
        ]}
      >
        <ThemedText type="body" style={{ color: theme.textSecondary }}>
          Plan not found
        </ThemedText>
      </View>
    );
  }

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: theme.backgroundRoot }]}
      contentContainerStyle={{
        paddingTop: headerHeight + Spacing.xl,
        paddingBottom: insets.bottom + Spacing.xl,
        paddingHorizontal: Spacing.lg,
      }}
    >
      <View
        style={[
          styles.header,
          { backgroundColor: theme.backgroundDefault },
          Shadows.small,
        ]}
      >
        <View style={styles.headerTop}>
          <View
            style={[styles.iconContainer, { backgroundColor: theme.primary + "15" }]}
          >
            <Feather name="shield" size={24} color={theme.primary} />
          </View>
          <StatusBadge status={plan.status} size="medium" />
        </View>
        <ThemedText type="h2" style={styles.planName}>
          {plan.name}
        </ThemedText>
        <ThemedText
          type="body"
          style={[styles.planDates, { color: theme.textSecondary }]}
        >
          {formatDate(plan.startDate)} - {formatDate(plan.endDate)}
        </ThemedText>
      </View>

      <View style={styles.section}>
        <ThemedText type="h4" style={styles.sectionTitle}>
          Coverage Includes
        </ThemedText>
        {plan.coverage.map((item, index) => (
          <View key={index} style={styles.coverageItem}>
            <Feather name="check-circle" size={18} color={theme.success} />
            <ThemedText type="body" style={styles.coverageText}>
              {item}
            </ThemedText>
          </View>
        ))}
      </View>

      {appliances.length > 0 ? (
        <View style={styles.section}>
          <ThemedText type="h4" style={styles.sectionTitle}>
            Covered Appliances
          </ThemedText>
          {appliances.map((appliance) => (
            <View
              key={appliance.id}
              style={[
                styles.applianceCard,
                { backgroundColor: theme.backgroundDefault },
              ]}
            >
              <View
                style={[
                  styles.applianceIcon,
                  { backgroundColor: theme.primary + "15" },
                ]}
              >
                <Feather
                  name={getApplianceIcon(appliance.type)}
                  size={20}
                  color={theme.primary}
                />
              </View>
              <View style={styles.applianceInfo}>
                <ThemedText type="body" style={styles.applianceName}>
                  {appliance.name}
                </ThemedText>
                <ThemedText
                  type="small"
                  style={{ color: theme.textSecondary }}
                >
                  {appliance.model || appliance.type}
                </ThemedText>
              </View>
            </View>
          ))}
        </View>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  centered: {
    justifyContent: "center",
    alignItems: "center",
  },
  header: {
    padding: Spacing.xl,
    borderRadius: BorderRadius.lg,
    marginBottom: Spacing["2xl"],
  },
  headerTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: Spacing.lg,
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: BorderRadius.md,
    alignItems: "center",
    justifyContent: "center",
  },
  planName: {
    marginBottom: Spacing.xs,
  },
  planDates: {},
  section: {
    marginBottom: Spacing["2xl"],
  },
  sectionTitle: {
    marginBottom: Spacing.md,
  },
  coverageItem: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: Spacing.sm,
  },
  coverageText: {
    marginLeft: Spacing.md,
  },
  applianceCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    marginBottom: Spacing.sm,
  },
  applianceIcon: {
    width: 40,
    height: 40,
    borderRadius: BorderRadius.sm,
    alignItems: "center",
    justifyContent: "center",
    marginRight: Spacing.md,
  },
  applianceInfo: {
    flex: 1,
  },
  applianceName: {
    fontWeight: "500",
  },
});
