import React, { useCallback, useState } from "react";
import {
  View,
  StyleSheet,
  ScrollView,
  RefreshControl,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHeaderHeight } from "@react-navigation/elements";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useFocusEffect } from "@react-navigation/native";

import { ThemedText } from "@/components/ThemedText";
import { SectionHeader } from "@/components/SectionHeader";
import { QuickActionCard } from "@/components/QuickActionCard";
import { SummaryCard } from "@/components/SummaryCard";
import { PropertySelector } from "@/components/PropertySelector";
import { useTheme } from "@/hooks/useTheme";
import { useAuth } from "@/hooks/useAuth";
import { useProperty } from "@/lib/propertyContext";
import { Spacing } from "@/constants/theme";
import { storage, ServicePlan, Job, Invoice } from "@/lib/storage";
import { RootStackParamList } from "@/navigation/RootStackNavigator";
import { getApiUrl } from "@/lib/query-client";

interface ServiceReminder {
  id: number;
  name: string;
  settingsjobdescriptionid: number;
}

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const tabBarHeight = useBottomTabBarHeight();
  const { theme } = useTheme();
  const { user } = useAuth();
  const { selectedProperty, refreshProperties } = useProperty();
  const navigation = useNavigation<NavigationProp>();

  const [refreshing, setRefreshing] = useState(false);
  const [activePlan, setActivePlan] = useState<ServicePlan | null>(null);
  const [upcomingJob, setUpcomingJob] = useState<Job | null>(null);
  const [pendingInvoices, setPendingInvoices] = useState<Invoice[]>([]);
  const [dueReminder, setDueReminder] = useState<ServiceReminder | null>(null);

  const loadServiceReminders = useCallback(async () => {
    try {
      const response = await fetch(
        new URL("/api/commusoft/servicereminders", getApiUrl()).toString()
      );
      if (response.ok) {
        const data = await response.json();
        const reminders = data.servicereminders || [];
        const boilerService = reminders.find(
          (r: ServiceReminder) => r.name === "Boiler Service - Natural Gas"
        );
        if (boilerService) {
          setDueReminder(boilerService);
        }
      }
    } catch (error) {
      console.error("Failed to load service reminders:", error);
    }
  }, []);

  const loadData = useCallback(async () => {
    const [plans, jobs, invoices] = await Promise.all([
      storage.getServicePlans(),
      storage.getJobs(),
      storage.getInvoices(),
    ]);

    const active = plans.find((p) => p.status === "active") || null;
    setActivePlan(active);

    const upcoming = jobs.find(
      (j) => j.status === "scheduled" || j.status === "in_progress",
    ) || null;
    setUpcomingJob(upcoming);

    const pending = invoices.filter(
      (i) => i.status === "pending" || i.status === "overdue",
    );
    setPendingInvoices(pending);

    await loadServiceReminders();
  }, [loadServiceReminders]);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData]),
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([loadData(), refreshProperties()]);
    setRefreshing(false);
  };

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return "Good morning";
    if (hour < 18) return "Good afternoon";
    return "Good evening";
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString("en-GB", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  };

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: theme.backgroundRoot }]}
      contentContainerStyle={{
        paddingTop: headerHeight + Spacing.xl,
        paddingBottom: tabBarHeight + Spacing.xl,
        paddingHorizontal: Spacing.lg,
      }}
      scrollIndicatorInsets={{ bottom: insets.bottom }}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
      }
    >
      <View style={styles.greeting}>
        <ThemedText type="h2">
          {getGreeting()}, {user?.name?.split(" ")[0] || "there"}
        </ThemedText>
        <ThemedText
          type="body"
          style={[styles.greetingSubtitle, { color: theme.textSecondary }]}
        >
          Here's your account overview
        </ThemedText>
        <View style={styles.propertySelector}>
          <PropertySelector />
        </View>
      </View>

      {dueReminder ? (
        <>
          <SectionHeader title="Service Due" />
          <SummaryCard
            icon="bell"
            title={dueReminder.name}
            subtitle="Your annual service is due - tap to book"
            status="pending"
            onPress={() =>
              navigation.navigate("BookService", {
                preselectedJobDescriptionId: dueReminder.settingsjobdescriptionid,
                serviceName: dueReminder.name,
              })
            }
            testID="card-service-due"
          />
        </>
      ) : null}

      <SectionHeader title="Quick Actions" />
      <View style={styles.quickActions}>
        <QuickActionCard
          icon="calendar"
          title="Book Service"
          subtitle="Schedule"
          color={theme.accent}
          onPress={() => navigation.navigate("BookService", {})}
          testID="action-book-service"
        />
        <View style={styles.quickActionSpacer} />
        <QuickActionCard
          icon="message-circle"
          title="Ask Tech Agent"
          subtitle="Get help"
          color={theme.primary}
          onPress={() => navigation.navigate("Main", { screen: "AITab" })}
          testID="action-ask-vai"
        />
      </View>

      <SectionHeader
        title="Active Plans"
        actionLabel="View all"
        onAction={() => navigation.navigate("Main", { screen: "ServicesTab" })}
      />
      {activePlan ? (
        <SummaryCard
          icon="shield"
          title={activePlan.name}
          subtitle={`Valid until ${formatDate(activePlan.endDate)}`}
          status="active"
          onPress={() =>
            navigation.navigate("ServicePlanDetail", { planId: activePlan.id })
          }
          testID="card-active-plan"
        />
      ) : (
        <SummaryCard
          icon="shield-off"
          title="No Active Plan"
          subtitle="Get covered with a service plan"
          onPress={() => navigation.navigate("Main", { screen: "ServicesTab" })}
        />
      )}

      <SectionHeader
        title="Upcoming Jobs"
        actionLabel="View all"
        onAction={() => navigation.navigate("Main", { screen: "ServicesTab" })}
      />
      {upcomingJob ? (
        <SummaryCard
          icon="tool"
          title={upcomingJob.description}
          subtitle={`Scheduled for ${formatDate(upcomingJob.scheduledDate)}`}
          status={upcomingJob.status as any}
          onPress={() =>
            navigation.navigate("JobDetail", { jobId: upcomingJob.id })
          }
          testID="card-upcoming-job"
        />
      ) : (
        <SummaryCard
          icon="check-circle"
          title="No Upcoming Jobs"
          subtitle="All caught up!"
        />
      )}

      {pendingInvoices.length > 0 ? (
        <>
          <SectionHeader
            title="Pending Invoices"
            actionLabel="View all"
            onAction={() => navigation.navigate("Main", { screen: "ServicesTab" })}
          />
          <SummaryCard
            icon="file-text"
            title={`${pendingInvoices.length} invoice${pendingInvoices.length > 1 ? "s" : ""} pending`}
            subtitle={`Total: £${pendingInvoices.reduce((sum, i) => sum + i.amount, 0).toFixed(2)}`}
            status="pending"
            onPress={() => navigation.navigate("Main", { screen: "ServicesTab" })}
            testID="card-pending-invoices"
          />
        </>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  greeting: {
    marginBottom: Spacing.md,
  },
  greetingSubtitle: {
    marginTop: Spacing.xs,
  },
  propertySelector: {
    marginTop: Spacing.md,
  },
  quickActions: {
    flexDirection: "row",
  },
  quickActionSpacer: {
    width: Spacing.md,
  },
});
