import React, { useCallback, useState } from "react";
import {
  View,
  StyleSheet,
  ScrollView,
  RefreshControl,
  Pressable,
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
  serviceperiod: number;
}

interface ServiceStatus {
  reminder: ServiceReminder;
  isDue: boolean;
  nextDueDate: Date | null;
  lastServiceDate: Date | null;
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
  const [serviceStatuses, setServiceStatuses] = useState<ServiceStatus[]>([]);
  const [demoMode, setDemoMode] = useState<"due" | "not-due">("not-due");

  const loadServiceReminders = useCallback(async () => {
    try {
      const response = await fetch(
        new URL("/api/commusoft/servicereminders", getApiUrl()).toString()
      );
      if (response.ok) {
        const data = await response.json();
        const reminders: ServiceReminder[] = data.servicereminders || [];
        
        const boilerService = reminders.find(
          (r) => r.name === "Boiler Service - Natural Gas"
        );
        
        const now = new Date();
        const statuses: ServiceStatus[] = [];
        
        const airConService = reminders.find(
          (r) => r.name === "Domestic AC Service"
        );
        if (airConService) {
          const lastService = new Date(now);
          lastService.setMonth(lastService.getMonth() - 14);
          const nextDue = new Date(lastService);
          nextDue.setMonth(nextDue.getMonth() + 12);
          statuses.push({
            reminder: airConService,
            isDue: true,
            nextDueDate: nextDue,
            lastServiceDate: lastService,
          });
        }
        
        if (boilerService) {
          let lastService: Date;
          let nextDue: Date;
          let isDue: boolean;
          
          if (demoMode === "due") {
            lastService = new Date(now);
            lastService.setMonth(lastService.getMonth() - 12);
            nextDue = new Date(now);
            nextDue.setDate(nextDue.getDate() + 7);
            isDue = true;
          } else {
            lastService = new Date(now);
            lastService.setMonth(lastService.getMonth() - 10);
            nextDue = new Date(lastService);
            nextDue.setMonth(nextDue.getMonth() + 12);
            isDue = false;
          }
          
          statuses.push({
            reminder: boilerService,
            isDue,
            nextDueDate: nextDue,
            lastServiceDate: lastService,
          });
        }
        
        setServiceStatuses(statuses);
      }
    } catch (error) {
      console.error("Failed to load service reminders:", error);
    }
  }, [demoMode]);

  const loadData = useCallback(async () => {
    const customerId = user?.accountNumber || user?.id;
    console.log("[HomeScreen] Loading data for customer:", customerId);
    
    if (customerId) {
      // Load diary events for upcoming appointments
      try {
        const diaryResponse = await fetch(
          new URL(`/api/commusoft/customer/${customerId}/diaryevents`, getApiUrl()).toString()
        );
        console.log("[HomeScreen] Diary events API response status:", diaryResponse.status);
        if (diaryResponse.ok) {
          const diaryData = await diaryResponse.json();
          console.log("[HomeScreen] Diary events data:", JSON.stringify(diaryData).substring(0, 500));
          // Commusoft API might return DiaryEvents, diaryevents, or events
          const events = diaryData.DiaryEvents || diaryData.diaryevents || diaryData.events || diaryData.diaryEvents || [];
          
          if (events.length > 0) {
            const sampleEvent = events[0];
            console.log("[HomeScreen] Sample diary event fields:", Object.keys(sampleEvent).join(", "));
          }
          
          // Find upcoming diary events (future or today)
          const now = new Date();
          const upcomingEvents = events.filter((e: any) => {
            // Check various date field names
            const eventDate = e.startdatetime || e.start || e.starttime || e.date || e.scheduleddate;
            const parsedDate = eventDate ? new Date(eventDate) : null;
            const isUpcoming = parsedDate && parsedDate >= new Date(now.toDateString());
            // Check status - exclude completed/cancelled
            const status = (e.status || "").toLowerCase();
            const isNotCompleted = status !== "completed" && status !== "cancelled";
            return isUpcoming && isNotCompleted;
          }).sort((a: any, b: any) => {
            const dateA = new Date(a.startdatetime || a.start || a.starttime || a.date);
            const dateB = new Date(b.startdatetime || b.start || b.starttime || b.date);
            return dateA.getTime() - dateB.getTime();
          });
          
          console.log("[HomeScreen] Upcoming diary events found:", upcomingEvents.length);
          if (upcomingEvents.length > 0) {
            const nextEvent = upcomingEvents[0];
            console.log("[HomeScreen] Next diary event:", nextEvent);
            const eventDate = nextEvent.startdatetime || nextEvent.start || nextEvent.starttime || nextEvent.date;
            setUpcomingJob({
              id: nextEvent.id || nextEvent.jobid || nextEvent.diaryeventid,
              description: nextEvent.description || nextEvent.title || nextEvent.jobdescription || "Scheduled Appointment",
              scheduledDate: eventDate,
              status: "scheduled",
              engineerName: nextEvent.engineername || nextEvent.engineer || "",
              property: "",
            });
          } else {
            setUpcomingJob(null);
          }
        }
      } catch (error) {
        console.error("Failed to load diary events from API:", error);
        // Fall back to checking jobs endpoint
        setUpcomingJob(null);
      }

      // Load service plans from customer data
      try {
        const customerResponse = await fetch(
          new URL(`/api/commusoft/customer/${customerId}`, getApiUrl()).toString()
        );
        console.log("[HomeScreen] Customer API response status:", customerResponse.status);
        if (customerResponse.ok) {
          const customerData = await customerResponse.json();
          console.log("[HomeScreen] Customer data servicePlans:", JSON.stringify(customerData.Customer?.servicePlans || []).substring(0, 500));
          const servicePlans = customerData.Customer?.servicePlans || [];
          
          if (servicePlans.length > 0) {
            // Find active plan (not expired)
            const now = new Date();
            const activePlanData = servicePlans.find((p: any) => {
              const expireDate = p.expiredate ? new Date(p.expiredate) : null;
              return !expireDate || expireDate > now;
            }) || servicePlans[0];
            
            setActivePlan({
              id: activePlanData.id || activePlanData.servicePlanId || "plan-1",
              name: activePlanData.description || activePlanData.name || "Service Plan",
              status: "active",
              startDate: new Date().toISOString(),
              endDate: activePlanData.expiredate || new Date().toISOString(),
              coverage: [],
              price: 0,
            });
          } else {
            setActivePlan(null);
          }
        }
      } catch (error) {
        console.error("Failed to load customer data from API:", error);
        setActivePlan(null);
      }
    }

    // Load invoices from local storage
    const invoices = await storage.getInvoices();
    const pending = invoices.filter(
      (i) => i.status === "pending" || i.status === "overdue",
    );
    setPendingInvoices(pending);
  }, [user]);

  useFocusEffect(
    useCallback(() => {
      loadData();
      loadServiceReminders();
    }, [loadData, loadServiceReminders]),
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

      <View style={styles.servicesHeader}>
        <SectionHeader title="Your Services" />
        <Pressable
          style={[
            styles.demoToggle,
            { backgroundColor: demoMode === "due" ? theme.warning : theme.success },
          ]}
          onPress={() => setDemoMode(demoMode === "due" ? "not-due" : "due")}
          testID="demo-toggle"
        >
          <ThemedText style={styles.demoToggleText}>
            Demo: {demoMode === "due" ? "Due" : "Not Due"}
          </ThemedText>
        </Pressable>
      </View>
      {serviceStatuses.length > 0 ? (
        serviceStatuses.map((status) => (
          <SummaryCard
            key={status.reminder.id}
            icon={status.isDue ? "bell" : "clock"}
            title={status.reminder.name}
            subtitle={
              status.isDue
                ? `Due ${status.nextDueDate ? formatDate(status.nextDueDate.toISOString()) : "now"} - tap to book`
                : `Next due: ${status.nextDueDate ? formatDate(status.nextDueDate.toISOString()) : "Not scheduled"}`
            }
            status={status.isDue ? "overdue" : "active"}
            onPress={
              status.isDue
                ? () =>
                    navigation.navigate("BookService", {
                      preselectedJobDescriptionId: status.reminder.settingsjobdescriptionid,
                      serviceName: status.reminder.name,
                      serviceReminderId: status.reminder.id,
                    })
                : undefined
            }
            testID={status.isDue ? "card-service-due" : "card-service-upcoming"}
          />
        ))
      ) : (
        <SummaryCard
          icon="check-circle"
          title="No Services Scheduled"
          subtitle="Your services are up to date"
        />
      )}

      <SectionHeader title="Quick Actions" />
      <View style={styles.quickActions}>
        <QuickActionCard
          icon="calendar"
          title="Book Service"
          subtitle={serviceStatuses.some((s) => s.isDue) ? "Schedule" : "No services due"}
          color={theme.accent}
          onPress={() => navigation.navigate("BookService", {})}
          testID="action-book-service"
          disabled={!serviceStatuses.some((s) => s.isDue)}
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
  servicesHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  demoToggle: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderRadius: 12,
  },
  demoToggleText: {
    fontSize: 11,
    fontWeight: "600",
    color: "#fff",
  },
  quickActions: {
    flexDirection: "row",
  },
  quickActionSpacer: {
    width: Spacing.md,
  },
});
